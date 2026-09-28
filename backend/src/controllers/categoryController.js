import prisma from '../config/db.js';

export const getCategories = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const where = {};
    if (activeOnly === 'true') {
      where.active = true;
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener categorías.', error: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre de la categoría es obligatorio.' });
    }

    const existing = await prisma.category.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      return res.status(400).json({ message: 'Ya existe una categoría con este nombre.' });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
      },
    });

    res.status(201).json({ message: 'Categoría creada con éxito', category });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear categoría.', error: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, active } = req.body;

    const catId = parseInt(id, 10);
    const existing = await prisma.category.findUnique({ where: { id: catId } });
    if (!existing) {
      return res.status(404).json({ message: 'Categoría no encontrada.' });
    }

    if (name && name.trim() !== existing.name) {
      const nameTaken = await prisma.category.findUnique({ where: { name: name.trim() } });
      if (nameTaken) return res.status(400).json({ message: 'Ese nombre de categoría ya existe.' });
    }

    const updated = await prisma.category.update({
      where: { id: catId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description ? description.trim() : null }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });

    res.json({ message: 'Categoría actualizada con éxito', category: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar categoría.', error: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const catId = parseInt(id, 10);

    const category = await prisma.category.findUnique({
      where: { id: catId },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada.' });
    }

    if (category._count.products > 0) {
      // Si tiene productos, cambiar a inactiva
      await prisma.category.update({
        where: { id: catId },
        data: { active: false },
      });
      return res.json({
        message: 'La categoría tiene productos asignados. Se desactivó lógicamente.',
      });
    }

    await prisma.category.delete({ where: { id: catId } });
    res.json({ message: 'Categoría eliminada con éxito.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar categoría.', error: error.message });
  }
};
