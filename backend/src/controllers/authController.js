import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sistema_autogestion_jwt_secret_key_pro_2026';

export const register = async (req, res) => {
  try {
    const { name, lastName, username, email, password } = req.body;
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
      data: { name: name.trim(), lastName: lastName.trim(), username: cleanUsername, email: cleanEmail, password: passwordHash, role: 'EMPRENDEDOR' },
      select: { id: true, name: true, lastName: true, username: true, email: true, role: true },
    });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    const businessConfig = await prisma.businessConfig.findFirst();
    res.status(201).json({ message: 'Cuenta creada.', token, user, businessConfig });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo crear la cuenta.' });
  }
};

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
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

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas. Verifique los datos.' });
    }

    if (!user.status) {
      return res.status(403).json({ message: 'Este usuario está inactivo. Consulte al administrador.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas. Verifique los datos.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const config = await prisma.businessConfig.findFirst();

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        name: user.name,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      businessConfig: config,
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión.', error: error.message });
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
        createdAt: true,
      },
    });

    const businessConfig = await prisma.businessConfig.findFirst();

    res.json({ user, businessConfig });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener datos de sesión.', error: error.message });
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
