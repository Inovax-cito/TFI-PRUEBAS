import prisma from '../config/db.js';
import { UploadError, publicFileUrl, storeUpload, uploadPublicSelect } from '../config/uploads.js';

const MAX_PHOTOS = 8;
const MAX_PRODUCTS = 300;
const ORDER_STATUSES = ['PENDIENTE', 'CONFIRMADO', 'ENTREGADO', 'CANCELADO'];
const ORDER_CHANNELS = ['PRESENCIAL', 'WHATSAPP', 'REDES', 'FERIA', 'OTRO'];
export const PAYMENT_METHODS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADO_PAGO', 'OTRO'];
// Transiciones permitidas: un pedido entregado solo puede cancelarse (se devuelve el stock).
const ORDER_TRANSITIONS = {
  PENDIENTE: ['CONFIRMADO', 'ENTREGADO', 'CANCELADO'],
  CONFIRMADO: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: ['CANCELADO'],
  CANCELADO: [],
};

class BusinessError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const fail = (res, error, fallback) => {
  if (error instanceof BusinessError) return res.status(error.status).json({ message: error.message });
  if (error instanceof UploadError) return res.status(400).json({ message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ message: fallback });
};

const requireBusiness = async (userId) => {
  const business = await prisma.businessProfile.findUnique({ where: { ownerUserId: userId } });
  if (!business) throw new BusinessError('Completá primero los datos de tu emprendimiento.', 400);
  return business;
};

const money = (value) => Math.round(Number(value) * 100) / 100;

const serializePhoto = (photo) => ({ id: photo.id, position: photo.position, url: publicFileUrl(photo.upload) });
const serializeProduct = (product) => ({
  id: product.id, name: product.name, description: product.description, price: Number(product.price),
  stock: product.stock, active: product.active, photoUrl: publicFileUrl(product.photo), updatedAt: product.updatedAt,
});
const serializeOrder = (order) => ({
  ...order, total: Number(order.total),
  items: order.items?.map((item) => ({ ...item, unitPrice: Number(item.unitPrice), subtotal: Number(item.subtotal) })),
});

// ---- Resumen (KPI + gráfico semanal) ----

export const getOverview = async (req, res) => {
  try {
    const business = await prisma.businessProfile.findUnique({
      where: { ownerUserId: req.user.id },
      include: { photos: { include: { upload: { select: uploadPublicSelect } }, orderBy: { position: 'asc' } } },
    });
    if (!business) return res.json({ business: null });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weeksBack = 8;
    const chartStart = new Date(now);
    chartStart.setHours(0, 0, 0, 0);
    chartStart.setDate(chartStart.getDate() - chartStart.getDay() - (weeksBack - 1) * 7);

    const [delivered, pendingCount, activeProducts, applications, recentOrders] = await Promise.all([
      prisma.businessOrder.findMany({
        where: { businessId: business.id, status: 'ENTREGADO', deliveredAt: { gte: chartStart < monthStart ? chartStart : monthStart } },
        select: { total: true, deliveredAt: true },
      }),
      prisma.businessOrder.count({ where: { businessId: business.id, status: { in: ['PENDIENTE', 'CONFIRMADO'] } } }),
      prisma.businessProduct.count({ where: { businessId: business.id, active: true } }),
      prisma.eventApplication.groupBy({ by: ['status'], where: { businessId: business.id }, _count: { _all: true } }),
      prisma.businessOrder.findMany({
        where: { businessId: business.id }, include: { items: true, event: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' }, take: 5,
      }),
    ]);

    const monthSales = delivered.filter((order) => order.deliveredAt >= monthStart);
    const monthTotal = money(monthSales.reduce((sum, order) => sum + Number(order.total), 0));
    const weeks = Array.from({ length: weeksBack }, (_, index) => {
      const start = new Date(chartStart);
      start.setDate(start.getDate() + index * 7);
      return { start, total: 0, orders: 0 };
    });
    for (const order of delivered) {
      const index = Math.floor((order.deliveredAt - chartStart) / (7 * 24 * 60 * 60 * 1000));
      if (index >= 0 && index < weeksBack) { weeks[index].total += Number(order.total); weeks[index].orders += 1; }
    }
    const applicationCounts = Object.fromEntries(applications.map((row) => [row.status, row._count._all]));

    const { photos, ...profile } = business;
    res.json({
      business: profile,
      photos: photos.map(serializePhoto),
      kpis: {
        monthSales: monthTotal,
        monthOrders: monthSales.length,
        averageTicket: monthSales.length ? money(monthTotal / monthSales.length) : 0,
        pendingOrders: pendingCount,
        activeProducts,
        approvedApplications: applicationCounts.APROBADA || 0,
        activeApplications: (applicationCounts.ENVIADA || 0) + (applicationCounts.EN_REVISION || 0),
      },
      weeklySales: weeks.map((week) => ({
        week: week.start.toISOString().slice(0, 10), total: money(week.total), orders: week.orders,
      })),
      recentOrders: recentOrders.map(serializeOrder),
    });
  } catch (error) {
    fail(res, error, 'No se pudo cargar el resumen del emprendimiento.');
  }
};

// ---- Fotos del emprendimiento ----

export const uploadBusinessPhoto = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    const count = await prisma.businessPhoto.count({ where: { businessId: business.id } });
    if (count >= MAX_PHOTOS) throw new BusinessError(`Podés tener hasta ${MAX_PHOTOS} fotos. Eliminá alguna para subir otra.`);
    const photo = await prisma.$transaction(async (tx) => {
      const upload = await storeUpload({ file: req.file, ownerUserId: req.user.id, purpose: 'BUSINESS_PHOTO', kind: 'image' }, tx);
      return tx.businessPhoto.create({ data: { businessId: business.id, uploadId: upload.id, position: count }, include: { upload: { select: uploadPublicSelect } } });
    });
    res.status(201).json({ message: 'Foto agregada.', photo: serializePhoto(photo) });
  } catch (error) {
    fail(res, error, 'No se pudo subir la foto.');
  }
};

export const deleteBusinessPhoto = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    const photo = await prisma.businessPhoto.findUnique({ where: { id: Number(req.params.id) } });
    if (!photo || photo.businessId !== business.id) throw new BusinessError('Foto no encontrada.', 404);
    await prisma.upload.delete({ where: { id: photo.uploadId } });
    res.json({ message: 'Foto eliminada.' });
  } catch (error) {
    fail(res, error, 'No se pudo eliminar la foto.');
  }
};

// ---- Productos propios ----

const productDataFromBody = (body) => {
  const name = body.name?.trim();
  if (!name) throw new BusinessError('Ingresá el nombre del producto.');
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0 || price > 100000000) throw new BusinessError('Ingresá un precio válido.');
  const stock = body.stock === '' || body.stock === null || body.stock === undefined ? null : Number(body.stock);
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 1000000)) throw new BusinessError('El stock debe ser un número entero mayor o igual a cero, o quedar vacío.');
  return { name: name.slice(0, 120), description: body.description?.trim().slice(0, 1000) || null, price: money(price), stock };
};

export const listProducts = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    const products = await prisma.businessProduct.findMany({
      where: { businessId: business.id }, include: { photo: { select: uploadPublicSelect } }, orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    res.json(products.map(serializeProduct));
  } catch (error) {
    fail(res, error, 'No se pudieron cargar los productos.');
  }
};

export const createProduct = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    if (await prisma.businessProduct.count({ where: { businessId: business.id } }) >= MAX_PRODUCTS) {
      throw new BusinessError(`Podés cargar hasta ${MAX_PRODUCTS} productos.`);
    }
    const product = await prisma.businessProduct.create({
      data: { ...productDataFromBody(req.body), businessId: business.id }, include: { photo: { select: uploadPublicSelect } },
    });
    res.status(201).json({ message: 'Producto agregado.', product: serializeProduct(product) });
  } catch (error) {
    fail(res, error, 'No se pudo guardar el producto.');
  }
};

const loadOwnProduct = async (userId, productId) => {
  const business = await requireBusiness(userId);
  const product = await prisma.businessProduct.findUnique({ where: { id: Number(productId) } });
  if (!product || product.businessId !== business.id) throw new BusinessError('Producto no encontrado.', 404);
  return product;
};

export const updateProduct = async (req, res) => {
  try {
    const current = await loadOwnProduct(req.user.id, req.params.id);
    const data = productDataFromBody({ ...current, price: Number(current.price), ...req.body });
    const product = await prisma.businessProduct.update({
      where: { id: current.id },
      data: { ...data, ...(typeof req.body.active === 'boolean' ? { active: req.body.active } : {}) },
      include: { photo: { select: uploadPublicSelect } },
    });
    res.json({ message: 'Producto actualizado.', product: serializeProduct(product) });
  } catch (error) {
    fail(res, error, 'No se pudo actualizar el producto.');
  }
};

export const uploadProductPhoto = async (req, res) => {
  try {
    const current = await loadOwnProduct(req.user.id, req.params.id);
    const product = await prisma.$transaction(async (tx) => {
      const upload = await storeUpload({ file: req.file, ownerUserId: req.user.id, purpose: 'PRODUCT_PHOTO', kind: 'image' }, tx);
      const updated = await tx.businessProduct.update({
        where: { id: current.id }, data: { photoUploadId: upload.id }, include: { photo: { select: uploadPublicSelect } },
      });
      if (current.photoUploadId) await tx.upload.delete({ where: { id: current.photoUploadId } });
      return updated;
    });
    res.json({ message: 'Foto del producto actualizada.', product: serializeProduct(product) });
  } catch (error) {
    fail(res, error, 'No se pudo subir la foto del producto.');
  }
};

// ---- Pedidos y ventas ----

export const listOrders = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    const where = { businessId: business.id };
    if (ORDER_STATUSES.includes(req.query.status)) where.status = req.query.status;
    const orders = await prisma.businessOrder.findMany({
      where, include: { items: true, event: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 200,
    });
    res.json(orders.map(serializeOrder));
  } catch (error) {
    fail(res, error, 'No se pudieron cargar los pedidos.');
  }
};

// Mueve el stock de los productos con control de inventario: -1 al entregar, +1 al cancelar algo entregado.
const applyStock = async (tx, items, direction) => {
  for (const item of items) {
    if (!item.productId) continue;
    const product = await tx.businessProduct.findUnique({ where: { id: item.productId } });
    if (!product || product.stock === null) continue;
    if (direction < 0 && product.stock < item.quantity) {
      throw new BusinessError(`Stock insuficiente de "${product.name}": quedan ${product.stock}.`);
    }
    await tx.businessProduct.update({ where: { id: product.id }, data: { stock: { increment: direction * item.quantity } } });
  }
};

export const createOrder = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    const customerName = req.body.customerName?.trim() || 'Consumidor final';
    const status = ORDER_STATUSES.includes(req.body.status) ? req.body.status : 'PENDIENTE';
    if (status === 'CANCELADO') throw new BusinessError('No se puede crear un pedido cancelado.');
    const channel = ORDER_CHANNELS.includes(req.body.channel) ? req.body.channel : 'PRESENCIAL';
    const paymentMethod = PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : (status === 'ENTREGADO' ? 'EFECTIVO' : null);
    const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 50) : [];
    if (!items.length) throw new BusinessError('Agregá al menos un producto al pedido.');

    let eventId = null;
    if (req.body.eventId) {
      eventId = Number(req.body.eventId);
      const approved = await prisma.eventApplication.findFirst({ where: { eventId, businessId: business.id, status: 'APROBADA' } });
      if (!approved) throw new BusinessError('Solo podés asociar ventas a eventos donde tu postulación fue aprobada.', 403);
    }

    const productIds = items.map((item) => Number(item.productId)).filter(Number.isInteger);
    const products = await prisma.businessProduct.findMany({ where: { id: { in: productIds }, businessId: business.id } });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const lines = items.map((item) => {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw new BusinessError('Las cantidades deben ser números enteros mayores que cero.');
      const product = productMap.get(Number(item.productId));
      if (!product) throw new BusinessError('Uno de los productos no pertenece a tu catálogo.');
      if (!product.active) throw new BusinessError(`"${product.name}" está pausado.`);
      const unitPrice = Number(product.price);
      return { productId: product.id, productName: product.name, quantity, unitPrice, subtotal: money(unitPrice * quantity) };
    });
    const total = money(lines.reduce((sum, line) => sum + line.subtotal, 0));

    const order = await prisma.$transaction(async (tx) => {
      if (status === 'ENTREGADO') await applyStock(tx, lines, -1);
      return tx.businessOrder.create({
        data: {
          businessId: business.id, customerName: customerName.slice(0, 120),
          customerContact: req.body.customerContact?.trim().slice(0, 120) || null,
          channel, status, total, paymentMethod, notes: req.body.notes?.trim().slice(0, 1000) || null, eventId,
          deliveredAt: status === 'ENTREGADO' ? new Date() : null,
          items: { create: lines },
        },
        include: { items: true, event: { select: { id: true, name: true } } },
      });
    });
    res.status(201).json({ message: status === 'ENTREGADO' ? 'Venta registrada.' : 'Pedido registrado.', order: serializeOrder(order) });
  } catch (error) {
    fail(res, error, 'No se pudo registrar el pedido.');
  }
};

export const setOrderStatus = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    const order = await prisma.businessOrder.findUnique({ where: { id: Number(req.params.id) }, include: { items: true } });
    if (!order || order.businessId !== business.id) throw new BusinessError('Pedido no encontrado.', 404);
    const { status } = req.body;
    if (!ORDER_TRANSITIONS[order.status]?.includes(status)) throw new BusinessError('Ese cambio de estado no está permitido.');
    const updated = await prisma.$transaction(async (tx) => {
      if (status === 'ENTREGADO') await applyStock(tx, order.items, -1);
      if (order.status === 'ENTREGADO' && status === 'CANCELADO') await applyStock(tx, order.items, 1);
      return tx.businessOrder.update({
        where: { id: order.id },
        data: {
          status,
          ...(status === 'ENTREGADO' ? { deliveredAt: new Date(), paymentMethod: PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : order.paymentMethod || 'EFECTIVO' } : {}),
        },
        include: { items: true, event: { select: { id: true, name: true } } },
      });
    });
    res.json({ message: 'Estado del pedido actualizado.', order: serializeOrder(updated) });
  } catch (error) {
    fail(res, error, 'No se pudo actualizar el pedido.');
  }
};
