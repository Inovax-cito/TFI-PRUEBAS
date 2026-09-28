import prisma from '../config/db.js';

export const getSales = async (req, res) => {
  try {
    const {
      search,
      startDate,
      endDate,
      paymentMethod,
      status,
      userId,
      page = 1,
      limit = 15,
    } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { saleNumber: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { lastName: { contains: search } } },
      ];
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = parseInt(userId, 10);
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

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, lastName: true, username: true } },
          cancelledByUser: { select: { id: true, name: true, lastName: true } },
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
      sales,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener historial de ventas.', error: error.message });
  }
};

export const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const saleId = parseInt(id, 10);

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        user: { select: { id: true, name: true, lastName: true, username: true } },
        cancelledByUser: { select: { id: true, name: true, lastName: true } },
        details: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: true, category: true },
            },
          },
        },
      },
    });

    if (!sale) {
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }

    const config = await prisma.businessConfig.findFirst();

    res.json({ sale, businessConfig: config });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener detalle de venta.', error: error.message });
  }
};

export const createSale = async (req, res) => {
  try {
    const { items, paymentMethod, discount = 0 } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'La venta debe contener al menos un producto.' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ message: 'El método de pago es requerido.' });
    }

    const config = await prisma.businessConfig.findFirst();
    const allowNegative = config ? config.allowNegativeStock : false;

    // Verificar productos y stock
    const productIds = items.map((i) => parseInt(i.productId, 10));
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (dbProducts.length !== productIds.length) {
      return res.status(400).json({ message: 'Uno o más productos no existen en el catálogo.' });
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Validar existencias y calcular subtotales
    let subtotalGeneral = 0;
    const itemsToProcess = [];

    for (const item of items) {
      const pid = parseInt(item.productId, 10);
      const qty = parseInt(item.quantity, 10);
      const prod = productMap.get(pid);

      if (!prod.active) {
        return res.status(400).json({ message: `El producto "${prod.name}" se encuentra inactivo.` });
      }

      if (qty <= 0) {
        return res.status(400).json({ message: `Cantidad inválida para "${prod.name}".` });
      }

      if (prod.currentStock < qty && !allowNegative) {
        return res.status(400).json({
          message: `Stock insuficiente para "${prod.name}". Disponible: ${prod.currentStock}, Solicitado: ${qty}.`,
        });
      }

      const unitPrice = item.unitPrice !== undefined ? parseFloat(item.unitPrice) : Number(prod.salePrice);
      const unitCost = Number(prod.purchasePrice);
      const subtotal = qty * unitPrice;
      subtotalGeneral += subtotal;

      itemsToProcess.push({
        productId: prod.id,
        productName: prod.name,
        minStock: prod.minStock,
        quantity: qty,
        unitPrice,
        unitCost,
        subtotal,
        currentStock: prod.currentStock,
      });
    }

    const discountAmount = Math.max(0, parseFloat(discount) || 0);
    const totalAmount = Math.max(0, subtotalGeneral - discountAmount);

    // Ejecutar transacción atómica
    const saleResult = await prisma.$transaction(async (tx) => {
      // 1. Generar número correlativo
      const lastSale = await tx.sale.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true },
      });
      const nextId = (lastSale ? lastSale.id : 0) + 1;
      const saleNumber = `VTA-${String(nextId).padStart(6, '0')}`;

      // 2. Crear cabecera de venta
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          total: totalAmount,
          discount: discountAmount,
          paymentMethod,
          status: 'COMPLETADA',
          userId: req.user.id,
        },
      });

      // 3. Crear detalles y descontar stock
      for (const item of itemsToProcess) {
        // Guardar detalle
        await tx.saleDetail.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            subtotal: item.subtotal,
          },
        });

        // Actualizar stock del producto
        const newStock = item.currentStock - item.quantity;
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: newStock },
        });

        // Registrar movimiento de inventario
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'SALIDA_VENTA',
            quantity: item.quantity,
            previousStock: item.currentStock,
            resultStock: newStock,
            reason: `Venta N° ${saleNumber}`,
            userId: req.user.id,
          },
        });

        // Notificación de stock bajo si cruzó umbral
        if (newStock <= item.minStock) {
          await tx.notification.create({
            data: {
              type: 'STOCK_BAJO',
              title: `Alerta de Stock Bajo: ${item.productName}`,
              description: `Stock remanente: ${newStock} unidades tras la venta ${saleNumber} (mínimo: ${item.minStock}).`,
            },
          });
        }
      }

      // 4. Si es Efectivo y la caja está abierta, registrar movimiento de caja
      if (paymentMethod === 'Efectivo') {
        const openCashRegister = await tx.cashRegister.findFirst({
          where: { status: 'ABIERTA' },
          orderBy: { openedAt: 'desc' },
        });

        if (openCashRegister) {
          await tx.cashMovement.create({
            data: {
              cashRegisterId: openCashRegister.id,
              type: 'INGRESO',
              category: 'VENTA',
              amount: totalAmount,
              concept: `Cobro de Venta N° ${saleNumber} en Efectivo`,
              userId: req.user.id,
            },
          });
        }
      }

      return sale;
    });

    const fullSale = await prisma.sale.findUnique({
      where: { id: saleResult.id },
      include: {
        user: { select: { id: true, name: true, lastName: true } },
        details: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
          },
        },
      },
    });

    res.status(201).json({
      message: 'Venta registrada con éxito',
      sale: fullSale,
      businessConfig: config,
    });
  } catch (error) {
    console.error('Error al registrar venta:', error);
    res.status(500).json({ message: 'Error al procesar la venta.', error: error.message });
  }
};

export const cancelSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const saleId = parseInt(id, 10);

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { details: { include: { product: true } } },
    });

    if (!sale) {
      return res.status(404).json({ message: 'Venta no encontrada.' });
    }

    if (sale.status === 'CANCELADA') {
      return res.status(400).json({ message: 'Esta venta ya fue cancelada con anterioridad.' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Modificar estado de la venta
      await tx.sale.update({
        where: { id: saleId },
        data: {
          status: 'CANCELADA',
          cancelReason: reason ? reason.trim() : 'Cancelación solicitada por usuario',
          cancelledAt: new Date(),
          cancelledByUserId: req.user.id,
        },
      });

      // 2. Restituir existencias y asentar movimientos
      for (const item of sale.details) {
        const prod = item.product;
        const previousStock = prod.currentStock;
        const resultStock = previousStock + item.quantity;

        await tx.product.update({
          where: { id: prod.id },
          data: { currentStock: resultStock },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: prod.id,
            type: 'DEVOLUCION',
            quantity: item.quantity,
            previousStock,
            resultStock,
            reason: `Restitución por cancelación de Venta N° ${sale.saleNumber}`,
            userId: req.user.id,
          },
        });
      }

      // 3. Revertir dinero si se cobró en efectivo y hay caja abierta
      if (sale.paymentMethod === 'Efectivo') {
        const openRegister = await tx.cashRegister.findFirst({
          where: { status: 'ABIERTA' },
          orderBy: { openedAt: 'desc' },
        });

        if (openRegister) {
          await tx.cashMovement.create({
            data: {
              cashRegisterId: openRegister.id,
              type: 'EGRESO',
              category: 'CANCELACION_VENTA',
              amount: sale.total,
              concept: `Reintegro por Cancelación de Venta N° ${sale.saleNumber}`,
              userId: req.user.id,
            },
          });
        }
      }

      // 4. Notificación de auditoría
      await tx.notification.create({
        data: {
          type: 'OPERACION_IMPORTANTE',
          title: `Venta anulada: ${sale.saleNumber}`,
          description: `El usuario ${req.user.name} ${req.user.lastName} canceló la venta ${sale.saleNumber} por un total de $${sale.total}.`,
        },
      });
    });

    res.json({ message: `Venta ${sale.saleNumber} cancelada exitosamente y stock restituido.` });
  } catch (error) {
    res.status(500).json({ message: 'Error al cancelar la venta.', error: error.message });
  }
};
