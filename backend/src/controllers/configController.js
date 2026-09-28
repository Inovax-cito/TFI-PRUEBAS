import prisma from '../config/db.js';

export const getConfig = async (req, res) => {
  try {
    let config = await prisma.businessConfig.findFirst();

    if (!config) {
      config = await prisma.businessConfig.create({
        data: {
          businessName: 'Sistema de Autogestión Administrativo',
          cuit: '20-00000000-0',
          address: 'Av. Comercial 1000',
          phone: '+54 11 0000-0000',
          email: 'contacto@comercio.com',
          currencyCode: 'ARS',
          currencySymbol: '$',
          receiptFooter: '¡Gracias por su compra! Comprobante interno.',
          allowNegativeStock: false,
        },
      });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener configuración general.', error: error.message });
  }
};

export const updateConfig = async (req, res) => {
  try {
    const {
      businessName,
      cuit,
      address,
      phone,
      email,
      currencyCode,
      currencySymbol,
      receiptFooter,
      allowNegativeStock,
    } = req.body;

    let config = await prisma.businessConfig.findFirst();

    if (!config) {
      config = await prisma.businessConfig.create({
        data: {
          businessName: businessName || 'Sistema de Autogestión',
          cuit,
          address,
          phone,
          email,
          currencyCode: currencyCode || 'ARS',
          currencySymbol: currencySymbol || '$',
          receiptFooter,
          allowNegativeStock: Boolean(allowNegativeStock),
        },
      });
    } else {
      config = await prisma.businessConfig.update({
        where: { id: config.id },
        data: {
          ...(businessName && { businessName: businessName.trim() }),
          ...(cuit !== undefined && { cuit: cuit ? cuit.trim() : null }),
          ...(address !== undefined && { address: address ? address.trim() : null }),
          ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
          ...(email !== undefined && { email: email ? email.trim() : null }),
          ...(currencyCode && { currencyCode: currencyCode.trim() }),
          ...(currencySymbol && { currencySymbol: currencySymbol.trim() }),
          ...(receiptFooter !== undefined && { receiptFooter: receiptFooter ? receiptFooter.trim() : '' }),
          ...(allowNegativeStock !== undefined && { allowNegativeStock: Boolean(allowNegativeStock) }),
        },
      });
    }

    res.json({ message: 'Configuración actualizada exitosamente.', config });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar configuración.', error: error.message });
  }
};

export const getPaymentMethods = async (req, res) => {
  try {
    const methods = await prisma.paymentMethod.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(methods);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener métodos de pago.', error: error.message });
  }
};

export const createPaymentMethod = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre del método de pago es requerido.' });
    }

    const existing = await prisma.paymentMethod.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      return res.status(400).json({ message: 'Ya existe este método de pago.' });
    }

    const pm = await prisma.paymentMethod.create({
      data: { name: name.trim(), active: true, isDefault: false },
    });

    res.status(201).json({ message: 'Método de pago creado con éxito.', paymentMethod: pm });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear método de pago.', error: error.message });
  }
};

export const togglePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const pmId = parseInt(id, 10);

    const pm = await prisma.paymentMethod.findUnique({ where: { id: pmId } });
    if (!pm) {
      return res.status(404).json({ message: 'Método de pago no encontrado.' });
    }

    const updated = await prisma.paymentMethod.update({
      where: { id: pmId },
      data: { active: !pm.active },
    });

    res.json({ message: `Método de pago ${updated.active ? 'activado' : 'desactivado'}.`, paymentMethod: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar estado.', error: error.message });
  }
};
