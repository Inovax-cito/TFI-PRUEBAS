import prisma from '../config/db.js';

export const getInventorySummary = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minStock: true,
        purchasePrice: true,
        salePrice: true,
      },
    });

    let totalValuationCost = 0;
    let totalValuationSale = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      const stock = p.currentStock;
      const cost = Number(p.purchasePrice);
      const sale = Number(p.salePrice);

      totalValuationCost += stock * cost;
      totalValuationSale += stock * sale;

      if (stock === 0) {
        outOfStockCount++;
      } else if (stock <= p.minStock) {
        lowStockCount++;
      }
    });

    res.json({
      totalProducts: products.length,
      lowStockCount,
      outOfStockCount,
      totalValuationCost,
      totalValuationSale,
      potentialProfit: totalValuationSale - totalValuationCost,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener resumen de inventario.', error: error.message });
  }
};

export const getInventoryMovements = async (req, res) => {
  try {
    const { productId, type, startDate, endDate, page = 1, limit = 20 } = req.query;

    const where = {};
    if (productId) {
      where.productId = parseInt(productId, 10);
    }
    if (type) {
      where.type = type;
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

    const [total, movements] = await Promise.all([
      prisma.inventoryMovement.count({ where }),
      prisma.inventoryMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          user: { select: { id: true, name: true, lastName: true, username: true } },
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
      movements,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener movimientos de inventario.', error: error.message });
  }
};

export const createAdjustment = async (req, res) => {
  try {
    const { productId, type, quantity, reason } = req.body;

    if (!productId || !type || !quantity || !reason) {
      return res.status(400).json({ message: 'Producto, tipo de ajuste, cantidad y motivo son obligatorios.' });
    }

    const qty = parseInt(quantity, 10);
    if (qty <= 0) {
      return res.status(400).json({ message: 'La cantidad del ajuste debe ser mayor a 0.' });
    }

    if (!['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'].includes(type)) {
      return res.status(400).json({ message: 'Tipo de ajuste no válido.' });
    }

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId, 10) },
    });
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    const config = await prisma.businessConfig.findFirst();
    const allowNegative = config ? config.allowNegativeStock : false;

    const previousStock = product.currentStock;
    let resultStock = previousStock;

    if (type === 'AJUSTE_POSITIVO') {
      resultStock = previousStock + qty;
    } else {
      resultStock = previousStock - qty;
      if (resultStock < 0 && !allowNegative) {
        return res.status(400).json({
          message: `Stock insuficiente. El stock resultante sería ${resultStock} y no está permitido stock negativo.`,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Actualizar producto
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { currentStock: resultStock },
      });

      // 2. Registrar movimiento
      const movement = await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          type,
          quantity: qty,
          previousStock,
          resultStock,
          reason: reason.trim(),
          userId: req.user.id,
        },
        include: {
          product: true,
          user: { select: { id: true, name: true, lastName: true } },
        },
      });

      // 3. Notificación de stock bajo si cruzó el umbral
      if (resultStock <= product.minStock) {
        await tx.notification.create({
          data: {
            type: 'STOCK_BAJO',
            title: `Alerta por ajuste: Stock bajo en ${product.name}`,
            description: `El stock se ajustó a ${resultStock} unidades (mínimo: ${product.minStock}).`,
          },
        });
      }

      return { product: updatedProduct, movement };
    });

    res.status(201).json({
      message: 'Ajuste de inventario aplicado exitosamente',
      ...result,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar ajuste de inventario.', error: error.message });
  }
};

export const getLowStockProducts = async (req, res) => {
  try {
    // Productos donde currentStock <= minStock
    const products = await prisma.product.findMany({
      where: {
        active: true,
      },
      include: {
        category: true,
      },
      orderBy: { currentStock: 'asc' },
    });

    const lowStock = products.filter((p) => p.currentStock <= p.minStock);

    res.json(lowStock);
  } catch (error) {
    res.status(500).json({ message: 'Error al consultar productos con stock bajo.', error: error.message });
  }
};
