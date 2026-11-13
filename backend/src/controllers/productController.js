import prisma from '../config/db.js';

export const getProducts = async (req, res) => {
  try {
    const { search, categoryId, active, sortBy, order } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (categoryId) {
      where.categoryId = parseInt(categoryId, 10);
    }

    if (active !== undefined && active !== '') {
      where.active = active === 'true';
    }

    let orderBy = { name: 'asc' };
    if (sortBy) {
      const direction = order === 'desc' ? 'desc' : 'asc';
      if (['name', 'salePrice', 'purchasePrice', 'currentStock', 'createdAt'].includes(sortBy)) {
        orderBy = { [sortBy]: direction };
      }
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy,
    });
    if (req.user.role === 'EMPRENDEDOR') {
      return res.json(products.map(({ id, name, sku, salePrice, currentStock, unit, active, category }) => ({
        id, name, sku, salePrice, currentStock, unit, active, category,
      })));
    }
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos.', error: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        priceHistory: {
          include: {
            user: { select: { id: true, name: true, lastName: true } },
          },
          orderBy: { changedAt: 'desc' },
          take: 10,
        },
        inventoryMovements: {
          include: {
            user: { select: { id: true, name: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    if (req.user.role === 'EMPRENDEDOR') {
      return res.json({
        id: product.id, name: product.name, sku: product.sku, salePrice: product.salePrice,
        currentStock: product.currentStock, unit: product.unit, active: product.active,
        category: { id: product.category.id, name: product.category.name },
      });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener producto.', error: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      sku,
      categoryId,
      purchasePrice,
      salePrice,
      currentStock,
      minStock,
      unit,
    } = req.body;

    if (!name || !sku || !categoryId || purchasePrice === undefined || salePrice === undefined) {
      return res.status(400).json({ message: 'Nombre, SKU, categoría y precios son obligatorios.' });
    }

    const numPurchase = parseFloat(purchasePrice);
    const numSale = parseFloat(salePrice);
    const stock = parseInt(currentStock || 0, 10);
    const min = parseInt(minStock || 5, 10);

    if (numPurchase < 0 || numSale < 0) {
      return res.status(400).json({ message: 'Los precios no pueden ser negativos.' });
    }
    if (stock < 0 || min < 0) {
      return res.status(400).json({ message: 'El stock no puede ser negativo.' });
    }

    const existingSku = await prisma.product.findUnique({
      where: { sku: sku.trim() },
    });
    if (existingSku) {
      return res.status(400).json({ message: 'El código / SKU ya se encuentra registrado.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: name.trim(),
          description: description ? description.trim() : null,
          sku: sku.trim(),
          categoryId: parseInt(categoryId, 10),
          purchasePrice: numPurchase,
          salePrice: numSale,
          currentStock: stock,
          minStock: min,
          unit: unit ? unit.trim() : 'unidad',
          active: true,
        },
        include: {
          category: true,
        },
      });

      // Registrar historial inicial de precio
      await tx.priceHistory.create({
        data: {
          productId: product.id,
          oldPrice: numSale,
          newPrice: numSale,
          userId: req.user.id,
        },
      });

      // Si tiene stock inicial, registrar movimiento
      if (stock > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            type: 'AJUSTE_POSITIVO',
            quantity: stock,
            previousStock: 0,
            resultStock: stock,
            reason: 'Stock inicial al dar de alta el producto',
            userId: req.user.id,
          },
        });
      }

      // Si el stock inicial ya está por debajo del mínimo, generar notificación
      if (stock <= min) {
        await tx.notification.create({
          data: {
            type: 'STOCK_BAJO',
            link: '#tab:inventory',
            title: `Stock bajo en nuevo producto: ${product.name}`,
            description: `Se dio de alta con ${stock} unidades (mínimo: ${min}).`,
          },
        });
      }

      return product;
    });

    res.status(201).json({ message: 'Producto registrado exitosamente', product: result });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ message: 'Error al registrar producto.', error: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);
    const {
      name,
      description,
      sku,
      categoryId,
      purchasePrice,
      salePrice,
      minStock,
      unit,
      active,
    } = req.body;

    const currentProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!currentProduct) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    if (sku && sku.trim() !== currentProduct.sku) {
      const skuTaken = await prisma.product.findUnique({
        where: { sku: sku.trim() },
      });
      if (skuTaken) {
        return res.status(400).json({ message: 'El código / SKU ya pertenece a otro producto.' });
      }
    }

    const numPurchase = purchasePrice !== undefined ? parseFloat(purchasePrice) : Number(currentProduct.purchasePrice);
    const numSale = salePrice !== undefined ? parseFloat(salePrice) : Number(currentProduct.salePrice);
    const min = minStock !== undefined ? parseInt(minStock, 10) : currentProduct.minStock;

    if (numPurchase < 0 || numSale < 0 || min < 0) {
      return res.status(400).json({ message: 'Los precios y el stock mínimo no pueden ser negativos.' });
    }

    const priceChanged = Number(currentProduct.salePrice) !== numSale;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          ...(name && { name: name.trim() }),
          ...(description !== undefined && { description: description ? description.trim() : null }),
          ...(sku && { sku: sku.trim() }),
          ...(categoryId && { categoryId: parseInt(categoryId, 10) }),
          purchasePrice: numPurchase,
          salePrice: numSale,
          minStock: min,
          ...(unit && { unit: unit.trim() }),
          ...(active !== undefined && { active: Boolean(active) }),
        },
        include: { category: true },
      });

      // Si el precio de venta cambió, registrar en PriceHistory
      if (priceChanged) {
        await tx.priceHistory.create({
          data: {
            productId: updated.id,
            oldPrice: currentProduct.salePrice,
            newPrice: numSale,
            userId: req.user.id,
          },
        });
      }

      return updated;
    });

    res.json({ message: 'Producto actualizado con éxito', product: result });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar producto.', error: error.message });
  }
};

export const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { active: !product.active },
    });

    res.json({
      message: `Producto ${updated.active ? 'activado' : 'desactivado'} con éxito.`,
      product: updated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar estado del producto.', error: error.message });
  }
};

export const getPriceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);

    const history = await prisma.priceHistory.findMany({
      where: { productId },
      include: {
        user: { select: { id: true, name: true, lastName: true, username: true } },
      },
      orderBy: { changedAt: 'desc' },
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener historial de precios.', error: error.message });
  }
};
