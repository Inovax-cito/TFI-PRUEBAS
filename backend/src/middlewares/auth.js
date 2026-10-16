import jwt from 'jsonwebtoken';
import prisma from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sistema_autogestion_jwt_secret_key_pro_2026';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Acceso no autorizado. Token requerido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        lastName: true,
        username: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado.' });
    }

    if (!user.status) {
      return res.status(403).json({ message: 'Cuenta desactivada. Contacte al administrador.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido o expirado.', error: error.message });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMINISTRADOR') {
    return res.status(403).json({
      message: 'Acceso denegado. Se requieren permisos de Administrador.',
    });
  }
  next();
};

export const requireStaff = (req, res, next) => {
  if (!req.user || !['ADMINISTRADOR', 'EMPLEADO'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Esta función está disponible para el personal del comercio.' });
  }
  next();
};
