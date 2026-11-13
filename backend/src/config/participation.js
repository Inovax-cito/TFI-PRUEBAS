import { createNotification, links } from './marketplace.js';

// Variables que el organizador puede usar en sus mensajes predeterminados.
export const TEMPLATE_VARIABLES = ['nombre', 'emprendimiento', 'feria', 'fecha', 'hora_inicio', 'direccion', 'puesto', 'hora_armado', 'costo'];

export const DEFAULT_TEMPLATES = {
  APROBADA: '¡Hola {nombre}! {emprendimiento} quedó aprobado para {feria} ({fecha}).\nTu puesto: {puesto}. Armado: {hora_armado}.\nDirección: {direccion}.\nCualquier duda escribime por acá.',
  NO_SELECCIONADA: 'Hola {nombre}, gracias por postularte a {feria}. Esta vez no pudimos sumarte, pero te esperamos en las próximas convocatorias.',
  LISTA_ESPERA: 'Hola {nombre}, {feria} completó sus puestos y {emprendimiento} quedó en lista de espera. Si se libera un lugar, te avisamos por acá.',
};

const formatDay = (date) => new Date(date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const formatHour = (date) => new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const formatFee = (fee) => (fee === null || fee === undefined || Number(fee) === 0 ? 'sin costo'
  : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(fee)));

export const renderTemplate = (template, { application, event, applicant, business }) => {
  const values = {
    nombre: applicant?.name || '',
    emprendimiento: business?.name || '',
    feria: event.name,
    fecha: formatDay(event.startsAt),
    hora_inicio: formatHour(event.startsAt),
    direccion: event.address || event.locality,
    puesto: application.standLabel || 'a confirmar',
    hora_armado: application.setupTime || 'a confirmar',
    costo: formatFee(event.standFee),
  };
  return String(template).replace(/\{([a-z_]+)\}/g, (match, key) => (key in values ? values[key] : match)).slice(0, 4000);
};

export const cleanTemplate = (value) => {
  if (value === undefined) return undefined;
  const text = String(value || '').trim();
  return text ? text.slice(0, 2000) : null;
};

/** Envía el mensaje automático del organizador al cambiar el estado de una postulación. */
export const sendStatusMessage = async (tx, applicationId, status) => {
  const application = await tx.eventApplication.findUnique({
    where: { id: applicationId },
    include: { event: true, business: true, applicant: { select: { id: true, name: true } } },
  });
  const custom = status === 'APROBADA' ? application.event.approvalMessage : status === 'NO_SELECCIONADA' ? application.event.rejectionMessage : null;
  const template = custom || DEFAULT_TEMPLATES[status];
  if (!template) return null;
  const body = renderTemplate(template, { application, event: application.event, applicant: application.applicant, business: application.business });
  return tx.applicationMessage.create({
    data: { applicationId, senderUserId: application.event.organizerUserId, kind: 'AUTOMATICO', body },
  });
};

export const paymentStatusFor = (event) => (event.standFee && Number(event.standFee) > 0 ? 'PENDIENTE' : 'NO_APLICA');

/**
 * Si quedó un lugar libre, aprueba en orden a quienes están en lista de espera.
 * Devuelve las postulaciones que pasaron a aprobadas.
 */
export const promoteWaitlist = async (tx, eventId) => {
  const event = await tx.marketEvent.findUnique({ where: { id: eventId } });
  if (!event || event.capacity === null || event.startsAt <= new Date()) return [];
  const approved = await tx.eventApplication.count({ where: { eventId, status: 'APROBADA' } });
  const free = event.capacity - approved;
  if (free <= 0) return [];
  const next = await tx.eventApplication.findMany({
    where: { eventId, status: 'LISTA_ESPERA' }, orderBy: [{ waitlistedAt: 'asc' }, { createdAt: 'asc' }], take: free,
  });
  for (const item of next) {
    await tx.eventApplication.update({ where: { id: item.id }, data: { status: 'APROBADA', paymentStatus: paymentStatusFor(event) } });
    await sendStatusMessage(tx, item.id, 'APROBADA');
    await createNotification(tx, item.applicantUserId, '¡Se liberó un lugar!', `Pasaste de la lista de espera a aprobado en ${event.name}.`, 'CONVOCATORIA', links.myApplication(item.id, true));
  }
  return next;
};

/** Posición (1, 2, …) de cada postulación en la lista de espera de su convocatoria. */
export const waitlistPositions = async (tx, eventIds) => {
  if (!eventIds.length) return {};
  const rows = await tx.eventApplication.findMany({
    where: { eventId: { in: eventIds }, status: 'LISTA_ESPERA' },
    orderBy: [{ waitlistedAt: 'asc' }, { createdAt: 'asc' }], select: { id: true, eventId: true },
  });
  const counters = {};
  return Object.fromEntries(rows.map((row) => { counters[row.eventId] = (counters[row.eventId] || 0) + 1; return [row.id, counters[row.eventId]]; }));
};

/** Promedio y cantidad de calificaciones recibidas por usuario en un sentido. */
export const ratingSummary = async (tx, userIds, direction) => {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return {};
  const rows = await tx.review.groupBy({
    by: ['targetUserId'], where: { targetUserId: { in: ids }, direction }, _avg: { rating: true }, _count: { _all: true },
  });
  return Object.fromEntries(rows.map((row) => [row.targetUserId, { average: Math.round(row._avg.rating * 10) / 10, count: row._count._all }]));
};

/** Cantidad de mensajes sin leer por postulación para un usuario. */
export const unreadByApplication = async (tx, userId, applicationIds) => {
  if (!applicationIds.length) return {};
  const rows = await tx.applicationMessage.groupBy({
    by: ['applicationId'], where: { applicationId: { in: applicationIds }, senderUserId: { not: userId }, readAt: null }, _count: { _all: true },
  });
  return Object.fromEntries(rows.map((row) => [row.applicationId, row._count._all]));
};
