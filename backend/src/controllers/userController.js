import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';

export const getUsers = async (req, res) => {
  try {
    const { search, role, status } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { lastName: { contains: search } },
        { username: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (role) {
      where.role = role;
    }
    if (status !== undefined && status !== '') {
      where.status = status === 'true';
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        lastName: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            sales: true,
            purchases: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar usuarios.', error: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, lastName, username, email, password, role } = req.body;

    if (!name || !lastName || !username || !email || !password) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username: username.trim() },
    });
    if (existingUsername) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso.' });
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existingEmail) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: role === 'ADMINISTRADOR' ? 'ADMINISTRADOR' : 'EMPLEADO',
        status: true,
      },
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

    res.status(201).json({ message: 'Usuario creado exitosamente', user: newUser });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear usuario.', error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, lastName, username, email, role, status, password } = req.body;

    const userId = parseInt(id, 10);
    if (role && !['ADMINISTRADOR', 'EMPLEADO', 'EMPRENDEDOR', 'ORGANIZADOR'].includes(role)) {
      return res.status(400).json({ message: 'Rol no válido.' });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Comprobar unicidad si cambiaron
    if (username && username.trim() !== user.username) {
      const exists = await prisma.user.findUnique({ where: { username: username.trim() } });
      if (exists) return res.status(400).json({ message: 'El nombre de usuario ya está en uso.' });
    }

    if (email && email.trim().toLowerCase() !== user.email) {
      const exists = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (exists) return res.status(400).json({ message: 'El correo electrónico ya está en uso.' });
    }

    const dataToUpdate = {
      ...(name && { name: name.trim() }),
      ...(lastName && { lastName: lastName.trim() }),
      ...(username && { username: username.trim() }),
      ...(email && { email: email.trim().toLowerCase() }),
      ...(role && { role, onboardingCompleted: true }),
      ...(status !== undefined && { status: Boolean(status) }),
    };

    if (password && password.trim().length >= 6) {
      dataToUpdate.password = await bcrypt.hash(password.trim(), 10);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
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

    res.json({ message: 'Usuario actualizado correctamente', user: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario.', error: error.message });
  }
};

export const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'No puede desactivar su propia cuenta de usuario.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: !user.status },
      select: { id: true, username: true, status: true },
    });

    res.json({
      message: `Usuario ${updated.status ? 'activado' : 'desactivado'} con éxito.`,
      user: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar estado del usuario.', error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'No puede eliminar su propia cuenta.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { sales: true, purchases: true, inventoryMovements: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Si tiene operaciones asociadas, no eliminar físicamente, desactivar lógicamente
    if (user._count.sales > 0 || user._count.purchases > 0 || user._count.inventoryMovements > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { status: false },
      });
      return res.json({
        message: 'El usuario posee operaciones registradas. Se ha realizado una baja lógica (desactivación) para preservar la integridad histórica.',
      });
    }

    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'Usuario eliminado físicamente con éxito.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar usuario.', error: error.message });
  }
};
