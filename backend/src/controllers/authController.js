import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/db.js';
import { signSessionToken } from '../config/security.js';
import {
  GOOGLE_CLIENT_ID, GoogleAuthError, createGoogleNonce, isGoogleEnabled, verifyGoogleCredential,
} from '../config/google.js';

const toPublicUser = (user) => ({
  id: user.id, name: user.name, lastName: user.lastName, username: user.username, email: user.email, role: user.role,
  onboardingCompleted: user.onboardingCompleted !== false,
});
// Roles que una persona puede elegir por sí misma. ADMINISTRADOR y EMPLEADO solo los asigna la administración.
const SELF_SERVICE_ROLES = ['EMPRENDEDOR', 'ORGANIZADOR'];
// Hash ficticio para que el tiempo de respuesta no revele si un usuario existe.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

export const register = async (req, res) => {
  try {
    const { name, lastName, username, email, password } = req.body;
    const role = req.body.role || 'EMPRENDEDOR';
    if (!SELF_SERVICE_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Elegí si vas a usar Emprende como emprendedor o como administrador de espacios.' });
    }
    if (!name?.trim() || !lastName?.trim() || !username?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'Completá nombre, apellido, usuario, correo y contraseña.' });
    }
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
      return res.status(400).json({ message: 'El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ message: 'Ingresá un correo electrónico válido.' });
    if (password.length < 8) return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' });
    const existing = await prisma.user.findFirst({ where: { OR: [{ username: cleanUsername }, { email: cleanEmail }] } });
    if (existing) return res.status(409).json({ message: 'Ese usuario o correo ya está registrado. Probá iniciar sesión.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name: name.trim().slice(0, 80), lastName: lastName.trim().slice(0, 80), username: cleanUsername, email: cleanEmail.slice(0, 120), password: passwordHash, role, onboardingCompleted: true },
    });
    const token = signSessionToken(user);
    const businessConfig = await prisma.businessConfig.findFirst();
    res.status(201).json({ message: 'Cuenta creada.', token, user: toPublicUser(user), businessConfig });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo crear la cuenta.' });
  }
};

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) {
      return res.status(400).json({ message: 'Debe ingresar usuario o correo y contraseña.' });
    }

    // Buscar por username o por email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier.trim() },
          { email: identifier.trim().toLowerCase() },
        ],
      },
    });

    // Las cuentas creadas con Google no tienen contraseña: se comparan contra un hash ficticio.
    const isMatch = await bcrypt.compare(password, user?.password || DUMMY_HASH);
    if (!user || !user.password || !isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas. Verifique los datos.' });
    }

    if (!user.status) {
      return res.status(403).json({ message: 'Este usuario está inactivo. Consulte al administrador.' });
    }

    const token = signSessionToken(user);

    const config = await prisma.businessConfig.findFirst();

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: toPublicUser(user),
      businessConfig: config,
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión.' });
  }
};

/** Configuración pública para el botón de Google y un nonce de un solo uso. */
export const googleConfig = (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!isGoogleEnabled()) return res.json({ enabled: false });
  const { nonce, nonceToken } = createGoogleNonce();
  res.json({ enabled: true, clientId: GOOGLE_CLIENT_ID, nonce, nonceToken });
};

const buildUniqueUsername = async (email) => {
  const base = (email.split('@')[0] || 'usuario').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 22) || 'usuario';
  const padded = base.length >= 3 ? base : `${base}usr`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = attempt === 0 ? padded : `${padded}_${crypto.randomInt(1000, 99999)}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `usuario_${crypto.randomBytes(5).toString('hex')}`;
};

export const googleLogin = async (req, res) => {
  try {
    const { credential, nonceToken } = req.body || {};
    const profile = await verifyGoogleCredential(credential, nonceToken);

    let user = await prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
      if (byEmail?.googleId) {
        // El correo ya está vinculado a otra cuenta de Google distinta.
        return res.status(409).json({ message: 'Este correo ya está vinculado a otra cuenta de Google.' });
      }
      if (byEmail) {
        // Google verificó el correo: se vincula la cuenta existente a esta identidad de Google.
        user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleId: profile.googleId } });
      } else {
        user = await prisma.user.create({
          data: {
            name: profile.name || 'Usuario',
            lastName: profile.lastName || '-',
            username: await buildUniqueUsername(profile.email),
            email: profile.email,
            googleId: profile.googleId,
            password: null,
            role: 'EMPRENDEDOR',
            onboardingCompleted: false,
          },
        });
      }
    }

    if (!user.status) {
      return res.status(403).json({ message: 'Este usuario está inactivo. Consulte al administrador.' });
    }

    const businessConfig = await prisma.businessConfig.findFirst();
    res.json({ message: 'Inicio de sesión exitoso', token: signSessionToken(user), user: toPublicUser(user), businessConfig });
  } catch (error) {
    if (error instanceof GoogleAuthError) return res.status(401).json({ message: error.message });
    if (error?.code === 'P2002') return res.status(409).json({ message: 'La cuenta ya existe. Intentá nuevamente.' });
    console.error('Error en login con Google:', error);
    res.status(500).json({ message: 'No se pudo iniciar sesión con Google.' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        lastName: true,
        username: true,
        email: true,
        role: true,
        status: true,
        onboardingCompleted: true,
        createdAt: true,
      },
    });

    const businessConfig = await prisma.businessConfig.findFirst();

    res.json({ user, businessConfig });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener datos de sesión.', error: error.message });
  }
};

/** Primer ingreso con Google: la persona elige su rol una sola vez. */
export const completeOnboarding = async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!SELF_SERVICE_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Elegí emprendedor o administrador de espacios.' });
    }
    const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { onboardingCompleted: true } });
    if (current.onboardingCompleted) {
      return res.status(409).json({ message: 'Tu cuenta ya tiene un rol asignado. Si necesitás cambiarlo, contactá a la administración.' });
    }
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { role, onboardingCompleted: true } });
    res.json({ message: 'Listo.', token: signSessionToken(user), user: toPublicUser(user) });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo guardar tu elección.' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, lastName, email } = req.body;

    if (!name || !lastName || !email) {
      return res.status(400).json({ message: 'Nombre, apellido y correo son obligatorios.' });
    }

    // Validar si el email ya pertenece a otro usuario
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        id: { not: req.user.id },
      },
    });

    if (existingEmail) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado por otro usuario.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      },
      select: {
        id: true,
        name: true,
        lastName: true,
        username: true,
        email: true,
        role: true,
      },
    });

    res.json({ message: 'Perfil actualizado con éxito', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar perfil.', error: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Debe ingresar la contraseña actual y la nueva contraseña.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user.password) {
      return res.status(400).json({ message: 'Tu cuenta ingresa con Google y no tiene contraseña propia.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'La contraseña actual ingresada es incorrecta.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: newHash },
    });

    res.json({ message: 'Contraseña modificada correctamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar contraseña.', error: error.message });
  }
};
