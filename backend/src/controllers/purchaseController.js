import prisma from '../config/db.js';

export const getPurchases = async (req, res) => {
  try {
    const { search, supplierId, status, startDate, endDate, page = 1, limit = 15 } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { purchaseNumber: { contains: search } },
        { supplier: { name: { contains: search } } },
      ];
    }

    if (supplierId) {
      where.supplierId = parseInt(supplierId, 10);
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;

    const [total, purchases] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, cuit: true, phone: true } },
          user: { select: { id: true, name: true, lastName: true } },
          _count: { select: { details: true } },
          details: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    res.json({
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
      purchases,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener compras.', error: error.message });
  }
};

export const getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const purchaseId = parseInt(id, 10);

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        supplier: true,
        user: { select: { id: true, name: true, lastName: true } },
        details: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: true, category: true, currentStock: true },
            },
          },
        },
      },
    });

    if (!purchase) {
      return res.status(404).json({ message: 'Compra no encontrada.' });
    }

    res.json(purchase);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener detalle de la compra.', error: error.message });
  }
};

export const createPurchase = async (req, res) => {
  try {
    const { supplierId, items, notes, status = 'PENDIENTE', payFromCash = false } = req.body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Proveedor y al menos un producto son requeridos.' });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(supplierId, 10) },
    });
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }

    // Calcular totales y validar items
    let total = 0;
    const itemsData = [];

    for (const item of items) {
      const pid = parseInt(item.productId, 10);
      const qty = parseInt(item.quantity, 10);
      const cost = parseFloat(item.unitCost);

      if (qty <= 0 || cost < 0) {
        return res.status(400).json({ message: 'Cantidad y costo unitario deben ser mayores a 0.' });
      }

      const prod = await prisma.product.findUnique({ where: { id: pid } });
      if (!prod) {
        return res.status(404).json({ message: `Producto con ID ${pid} no encontrado.` });
      }

      const subtotal = qty * cost;
      total += subtotal;

      itemsData.push({
        productId: pid,
        productName: prod.name,
        quantity: qty,
        unitCost: cost,
        subtotal,
        currentStock: prod.currentStock,
      });
    }

    const isReceivedImmediately = status === 'RECIBIDA';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Número correlativo
      const lastPurchase = await tx.purchase.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true },
      });
      const nextId = (lastPurchase ? lastPurchase.id : 0) + 1;
      const purchaseNumber = `COM-${String(nextId).padStart(6, '0')}`;

      // 2. Crear cabecera de compra
      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: supplier.id,
          total,
          status: isReceivedImmediately ? 'RECIBIDA' : 'PENDIENTE',
          notes: notes ? notes.trim() : null,
          userId: req.user.id,
          receivedAt: isReceivedImmediately ? new Date() : null,
          details: {
            create: itemsData.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              subtotal: i.subtotal,
            })),
          },
        },
      });

      // 3. Si se marca como recibida inmediatamente, impactar stock
      if (isReceivedImmediately) {
        for (const item of itemsData) {
          const newStock = item.currentStock + item.quantity;

          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: newStock,
              purchasePrice: item.unitCost, // Actualizar costo de adquisición
            },
          });

          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              type: 'INGRESO_COMPRA',
              quantity: item.quantity,
              previousStock: item.currentStock,
              resultStock: newStock,
              reason: `Recepción de Compra N° ${purchaseNumber}`,
              userId: req.user.id,
            },
          });
        }

        // Si se solicitó debitar de caja y hay una caja abierta
        if (payFromCash) {
          const openRegister = await tx.cashRegister.findFirst({
            where: { status: 'ABIERTA' },
            orderBy: { openedAt: 'desc' },
          });

          if (openRegister) {
            await tx.cashMovement.create({
              data: {
                cashRegisterId: openRegister.id,
                type: 'EGRESO',
                category: 'COMPRA',
                amount: total,
                concept: `Pago por Compra N° ${purchaseNumber} a ${supplier.name}`,
                userId: req.user.id,
              },
            });
          }
        }
      } else {
        // Notificación de compra pendiente
        await tx.notification.create({
          data: {
            type: 'COMPRA_PENDIENTE',
            title: `Nueva compra pendiente: ${purchaseNumber}`,
            description: `Se registró orden de compra a ${supplier.name} por $${total}. Pendiente de recepción.`,
          },
        });
      }

      return purchase;
    });

    res.status(201).json({ message: 'Compra registrada exitosamente', purchase: result });
  } catch (error) {
    console.error('Error al registrar compra:', error);
    res.status(500).json({ message: 'Error al registrar la compra.', error: error.message });
  }
};

export const receivePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const { payFromCash = false } = req.body;
    const purchaseId = parseInt(id, 10);

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        supplier: true,
        details: { include: { product: true } },
      },
    });

    if (!purchase) {
      return res.status(404).json({ message: 'Compra no encontrada.' });
    }

    if (purchase.status !== 'PENDIENTE') {
      return res.status(400).json({
        message: `Esta compra ya tiene estado "${purchase.status}" y no puede recibirse nuevamente.`,
      });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Actualizar estado
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          status: 'RECIBIDA',
          receivedAt: new Date(),
        },
      });

      // 2. Incrementar stock y asentar movimientos
      for (const item of purchase.details) {
        const prod = item.product;
        const newStock = prod.currentStock + item.quantity;

        await tx.product.update({
          where: { id: prod.id },
          data: {
            currentStock: newStock,
            purchasePrice: item.unitCost, // Actualizar costo
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: prod.id,
            type: 'INGRESO_COMPRA',
            quantity: item.quantity,
            previousStock: prod.currentStock,
            resultStock: newStock,
            reason: `Recepción de mercadería de Compra N° ${purchase.purchaseNumber}`,
            userId: req.user.id,
          },
        });
      }

      // 3. Opcional: salida de caja si se pagó en efectivo
      if (payFromCash) {
        const openRegister = await tx.cashRegister.findFirst({
          where: { status: 'ABIERTA' },
          orderBy: { openedAt: 'desc' },
        });

        if (openRegister) {
          await tx.cashMovement.create({
            data: {
              cashRegisterId: openRegister.id,
              type: 'EGRESO',
              category: 'COMPRA',
              amount: purchase.total,
              concept: `Pago por Recepción de Compra N° ${purchase.purchaseNumber} a ${purchase.supplier.name}`,
              userId: req.user.id,
            },
          });
        }
      }

      // 4. Notificación
      await tx.notification.create({
        data: {
          type: 'OPERACION_IMPORTANTE',
          title: `Mercadería recibida: Compra ${purchase.purchaseNumber}`,
          description: `Se incorporó al stock la mercadería proveniente de ${purchase.supplier.name}.`,
        },
      });
    });

    res.json({ message: `Compra ${purchase.purchaseNumber} recibida e inventario actualizado con éxito.` });
  } catch (error) {
    res.status(500).json({ message: 'Error al recepcionar compra.', error: error.message });
  }
};

export const cancelPurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const purchaseId = parseInt(id, 10);

    const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) {
      return res.status(404).json({ message: 'Compra no encontrada.' });
    }

    if (purchase.status === 'RECIBIDA') {
      return res.status(400).json({
        message: 'No se puede cancelar una compra que ya fue recibida y cargada al stock.',
      });
    }

    const updated = await prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: 'CANCELADA' },
    });

    res.json({ message: `Compra ${updated.purchaseNumber} cancelada correctamente.` });
  } catch (error) {
    res.status(500).json({ message: 'Error al cancelar compra.', error: error.message });
  }
};
