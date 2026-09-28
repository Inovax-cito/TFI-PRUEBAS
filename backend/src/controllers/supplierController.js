import prisma from '../config/db.js';

export const getSuppliers = async (req, res) => {
  try {
    const { search, active } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { cuit: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (active !== undefined && active !== '') {
      where.active = active === 'true';
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: { purchases: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener proveedores.', error: error.message });
  }
};

export const getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;
    const supplierId = parseInt(id, 10);

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        purchases: {
          include: {
            user: { select: { id: true, name: true, lastName: true } },
            _count: { select: { details: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }

    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener proveedor.', error: error.message });
  }
};

export const createSupplier = async (req, res) => {
  try {
    const { name, cuit, phone, email, address, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'La razón social o nombre es obligatorio.' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        cuit: cuit ? cuit.trim() : null,
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        notes: notes ? notes.trim() : null,
      },
    });

    res.status(201).json({ message: 'Proveedor registrado con éxito', supplier });
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar proveedor.', error: error.message });
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplierId = parseInt(id, 10);
    const { name, cuit, phone, email, address, notes, active } = req.body;

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(name && { name: name.trim() }),
        ...(cuit !== undefined && { cuit: cuit ? cuit.trim() : null }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        ...(email !== undefined && { email: email ? email.trim() : null }),
        ...(address !== undefined && { address: address ? address.trim() : null }),
        ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });

    res.json({ message: 'Proveedor actualizado con éxito', supplier: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar proveedor.', error: error.message });
  }
};

export const toggleSupplierStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const supplierId = parseInt(id, 10);

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: { active: !supplier.active },
    });

    res.json({
      message: `Proveedor ${updated.active ? 'activado' : 'desactivado'} con éxito.`,
      supplier: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar estado del proveedor.', error: error.message });
  }
};
