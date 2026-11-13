import prisma from '../config/db.js';
import { PAYMENT_METHODS } from './businessController.js';

// Caja del día del emprendimiento. Reúne en un período (apertura → cierre):
// ventas entregadas por medio de pago, gastos, alquiler de puestos pagado y lo que queda.

class CashError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (res, error, fallback) => {
  if (error instanceof CashError) return res.status(error.status).json({ message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ message: fallback });
};
const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const requireBusiness = async (userId) => {
  const business = await prisma.businessProfile.findUnique({ where: { ownerUserId: userId } });
  if (!business) throw new CashError('Completá primero los datos de tu emprendimiento.');
  return business;
};

const approvedEvent = async (businessId, rawEventId) => {
  if (rawEventId === undefined || rawEventId === null || rawEventId === '') return null;
  const eventId = Number(rawEventId);
  const approved = await prisma.eventApplication.findFirst({ where: { eventId, businessId, status: 'APROBADA' } });
  if (!approved) throw new CashError('Solo podés asociar la caja a ferias donde fuiste aprobado.', 403);
  return eventId;
};

/** Calcula el resumen de una caja (abierta o cerrada). */
const summarize = async (day) => {
  const from = day.openedAt;
  const to = day.closedAt || new Date();
  const [orders, expenses, rents] = await Promise.all([
    prisma.businessOrder.findMany({
      where: { businessId: day.businessId, status: 'ENTREGADO', deliveredAt: { gte: from, lte: to } },
      select: { id: true, total: true, paymentMethod: true, customerName: true, deliveredAt: true, channel: true, items: { select: { productName: true, quantity: true } } },
      orderBy: { deliveredAt: 'desc' },
    }),
    prisma.businessExpense.findMany({ where: { cashDayId: day.id }, orderBy: { createdAt: 'desc' } }),
    // Alquiler de puestos pagado en el período (pago simulado, transferencia o efectivo confirmado).
    prisma.eventApplication.findMany({
      where: { businessId: day.businessId, paymentStatus: 'CONFIRMADO', paymentConfirmedAt: { gte: from, lte: to } },
      select: { id: true, paymentMethod: true, paymentConfirmedAt: true, event: { select: { name: true, standFee: true } } },
    }),
  ]);
  const byMethod = Object.fromEntries(PAYMENT_METHODS.map((method) => [method, 0]));
  for (const order of orders) byMethod[order.paymentMethod || 'EFECTIVO'] = money((byMethod[order.paymentMethod || 'EFECTIVO'] || 0) + Number(order.total));
  const sales = money(orders.reduce((sum, order) => sum + Number(order.total), 0));
  const expensesTotal = money(expenses.reduce((sum, item) => sum + Number(item.amount), 0));
  const rent = money(rents.reduce((sum, item) => sum + Number(item.event.standFee || 0), 0));
  const cashExpenses = expenses.filter((item) => item.method === 'EFECTIVO').reduce((sum, item) => sum + Number(item.amount), 0);
  const cashRent = rents.filter((item) => item.paymentMethod === 'EFECTIVO').reduce((sum, item) => sum + Number(item.event.standFee || 0), 0);
  const expectedCash = money(Number(day.openingCash) + byMethod.EFECTIVO - cashExpenses - cashRent);
  return {
    sales, salesCount: orders.length, byMethod, expenses: expensesTotal, rent,
    net: money(sales - expensesTotal - rent),
    expectedCash,
    countedCash: day.countedCash === null ? null : Number(day.countedCash),
    difference: day.countedCash === null ? null : money(Number(day.countedCash) - expectedCash),
    movements: [
      ...orders.map((order) => ({ kind: 'VENTA', id: `v${order.id}`, at: order.deliveredAt, amount: Number(order.total), method: order.paymentMethod || 'EFECTIVO', label: order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ') || order.customerName })),
      ...expenses.map((item) => ({ kind: 'GASTO', id: `g${item.id}`, at: item.createdAt, amount: -Number(item.amount), method: item.method, label: item.concept })),
      ...rents.map((item) => ({ kind: 'ALQUILER', id: `a${item.id}`, at: item.paymentConfirmedAt, amount: -Number(item.event.standFee || 0), method: item.paymentMethod || 'OTRO', label: `Puesto en ${item.event.name}` })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)),
  };
};

const serializeDay = async (day) => ({
  id: day.id, status: day.status, openedAt: day.openedAt, closedAt: day.closedAt, notes: day.notes,
  openingCash: Number(day.openingCash), event: day.event || null,
  summary: await summarize(day),
});

const dayInclude = { event: { select: { id: true, name: true } } };

export const getCurrentDay = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    const day = await prisma.businessCashDay.findFirst({ where: { businessId: business.id, status: 'ABIERTA' }, include: dayInclude });
    const now = new Date();
    // Ferias aprobadas de hoy o próximas: para asociar la caja a una feria.
    const events = await prisma.marketEvent.findMany({
      where: { endsAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, applications: { some: { businessId: business.id, status: 'APROBADA' } } },
      select: { id: true, name: true, startsAt: true }, orderBy: { startsAt: 'asc' }, take: 10,
    });
    res.json({ day: day ? await serializeDay(day) : null, events, paymentMethods: PAYMENT_METHODS });
  } catch (error) {
    fail(res, error, 'No se pudo cargar la caja del día.');
  }
};

export const openDay = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    const existing = await prisma.businessCashDay.findFirst({ where: { businessId: business.id, status: 'ABIERTA' } });
    if (existing) throw new CashError('Ya tenés una caja abierta. Cerrala antes de abrir otra.', 409);
    const openingCash = Number(req.body?.openingCash || 0);
    if (!Number.isFinite(openingCash) || openingCash < 0 || openingCash > 100000000) throw new CashError('Ingresá el efectivo inicial (puede ser 0).');
    const eventId = await approvedEvent(business.id, req.body?.eventId);
    const day = await prisma.businessCashDay.create({ data: { businessId: business.id, eventId, openingCash: money(openingCash) }, include: dayInclude });
    res.status(201).json({ message: 'Caja abierta. Las ventas que entregues desde ahora se suman acá.', day: await serializeDay(day) });
  } catch (error) {
    fail(res, error, 'No se pudo abrir la caja.');
  }
};

export const closeDay = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    const day = await prisma.businessCashDay.findFirst({ where: { businessId: business.id, status: 'ABIERTA' }, include: dayInclude });
    if (!day) throw new CashError('No hay una caja abierta.');
    const countedCash = Number(req.body?.countedCash);
    if (req.body?.countedCash === '' || !Number.isFinite(countedCash) || countedCash < 0) throw new CashError('Contá el efectivo que tenés y escribí el total.');
    const closedAt = new Date();
    const summary = await summarize({ ...day, closedAt });
    const closed = await prisma.businessCashDay.update({
      where: { id: day.id },
      data: { status: 'CERRADA', closedAt, countedCash: money(countedCash), expectedCash: summary.expectedCash, notes: String(req.body?.notes || '').trim().slice(0, 500) || null },
      include: dayInclude,
    });
    const result = await serializeDay(closed);
    const diff = result.summary.difference;
    res.json({ message: diff === 0 ? 'Caja cerrada. El efectivo coincide.' : `Caja cerrada. Diferencia de efectivo: ${diff > 0 ? '+' : ''}${diff}.`, day: result });
  } catch (error) {
    fail(res, error, 'No se pudo cerrar la caja.');
  }
};

export const listDays = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    const days = await prisma.businessCashDay.findMany({ where: { businessId: business.id, status: 'CERRADA' }, include: dayInclude, orderBy: { openedAt: 'desc' }, take: 30 });
    const result = await Promise.all(days.map(async (day) => {
      const { movements, ...summary } = await summarize(day);
      return { id: day.id, openedAt: day.openedAt, closedAt: day.closedAt, event: day.event, openingCash: Number(day.openingCash), notes: day.notes, summary: { ...summary, movementsCount: movements.length } };
    }));
    res.json(result);
  } catch (error) {
    fail(res, error, 'No se pudo cargar el historial de caja.');
  }
};

export const createExpense = async (req, res) => {
  try {
    const business = await requireBusiness(req.user.id);
    const concept = String(req.body?.concept || '').trim().slice(0, 160);
    const amount = Number(req.body?.amount);
    if (!concept) throw new CashError('Escribí en qué gastaste.');
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) throw new CashError('Ingresá un importe mayor que cero.');
    const method = PAYMENT_METHODS.includes(req.body?.method) ? req.body.method : 'EFECTIVO';
    const open = await prisma.businessCashDay.findFirst({ where: { businessId: business.id, status: 'ABIERTA' } });
    const eventId = await approvedEvent(business.id, req.body?.eventId ?? open?.eventId);
    const expense = await prisma.businessExpense.create({ data: { businessId: business.id, cashDayId: open?.id || null, eventId, concept, amount: money(amount), method } });
    res.status(201).json({ message: open ? 'Gasto registrado en la caja de hoy.' : 'Gasto registrado.', expense: { ...expense, amount: Number(expense.amount) } });
  } catch (error) {
    fail(res, error, 'No se pudo registrar el gasto.');
  }
};
