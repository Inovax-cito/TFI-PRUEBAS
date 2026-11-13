import crypto from 'crypto';
import prisma from '../config/db.js';
import { createNotification, links } from '../config/marketplace.js';
import { paymentStatusFor, promoteWaitlist } from '../config/participation.js';
import { UploadError, storeUpload } from '../config/uploads.js';

class ParticipationError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (res, error, fallback) => {
  if (error instanceof ParticipationError) return res.status(error.status).json({ message: error.message });
  if (error instanceof UploadError) return res.status(400).json({ message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ message: fallback });
};

/** Carga la postulación y el papel del usuario en ella: emprendedor, organizador o administración. */
const loadParticipation = async (applicationId, user) => {
  const application = await prisma.eventApplication.findUnique({
    where: { id: Number(applicationId) },
    include: { event: true, business: true, applicant: { select: { id: true, name: true, lastName: true } } },
  });
  if (!application) throw new ParticipationError('Postulación no encontrada.', 404);
  let role = null;
  if (application.applicantUserId === user.id) role = 'applicant';
  else if (application.event.organizerUserId === user.id) role = 'organizer';
  else if (user.role === 'ADMINISTRADOR') role = 'admin';
  if (!role) throw new ParticipationError('Postulación no encontrada.', 404);
  return { application, role };
};

const otherParty = (application, role) => (role === 'applicant' ? application.event.organizerUserId : application.applicantUserId);
const eventEnded = (event) => new Date(event.endsAt) < new Date();

// ---------- Mensajes ----------

export const listMessages = async (req, res) => {
  try {
    const { application, role } = await loadParticipation(req.params.id, req.user);
    if (role !== 'admin') {
      await prisma.applicationMessage.updateMany({
        where: { applicationId: application.id, senderUserId: { not: req.user.id }, readAt: null }, data: { readAt: new Date() },
      });
    }
    const messages = await prisma.applicationMessage.findMany({
      where: { applicationId: application.id }, orderBy: { createdAt: 'asc' }, take: 500,
      include: { sender: { select: { id: true, name: true, lastName: true } } },
    });
    res.json({
      role,
      canWrite: role !== 'admin' && !['BORRADOR'].includes(application.status),
      title: role === 'applicant' ? `${application.event.name} · Organización` : `${application.business.name} · ${application.event.name}`,
      messages: messages.map((message) => ({ ...message, mine: message.senderUserId === req.user.id })),
    });
  } catch (error) {
    fail(res, error, 'No se pudieron cargar los mensajes.');
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { application, role } = await loadParticipation(req.params.id, req.user);
    if (role === 'admin') throw new ParticipationError('La administración solo puede leer esta conversación.', 403);
    if (application.status === 'BORRADOR') throw new ParticipationError('Enviá la postulación para poder escribirle a la organización.');
    const body = String(req.body?.body || '').trim();
    if (!body) throw new ParticipationError('Escribí un mensaje.');
    if (body.length > 2000) throw new ParticipationError('El mensaje puede tener hasta 2000 caracteres.');
    const message = await prisma.applicationMessage.create({
      data: { applicationId: application.id, senderUserId: req.user.id, body },
      include: { sender: { select: { id: true, name: true, lastName: true } } },
    });
    // Aviso solo si la otra persona no tiene ya mensajes sin leer de esta conversación (evita llenar la campana).
    const pending = await prisma.applicationMessage.count({ where: { applicationId: application.id, senderUserId: req.user.id, readAt: null } });
    if (pending === 1) {
      await createNotification(prisma, otherParty(application, role), 'Nuevo mensaje',
        `${role === 'applicant' ? application.business.name : 'La organización'} te escribió sobre ${application.event.name}.`, 'MENSAJE',
        role === 'applicant' ? links.receivedApplication(application.id, true) : links.myApplication(application.id, true));
    }
    res.status(201).json({ message: { ...message, mine: true } });
  } catch (error) {
    fail(res, error, 'No se pudo enviar el mensaje.');
  }
};

export const unreadSummary = async (req, res) => {
  try {
    const rows = await prisma.applicationMessage.groupBy({
      by: ['applicationId'],
      where: {
        readAt: null, senderUserId: { not: req.user.id },
        application: { OR: [{ applicantUserId: req.user.id }, { event: { organizerUserId: req.user.id } }] },
      },
      _count: { _all: true },
    });
    const byApplication = Object.fromEntries(rows.map((row) => [row.applicationId, row._count._all]));
    res.json({ total: rows.reduce((sum, row) => sum + row._count._all, 0), byApplication });
  } catch (error) {
    fail(res, error, 'No se pudo consultar los mensajes.');
  }
};

// ---------- Darse de baja ----------

export const withdrawApplication = async (req, res) => {
  try {
    const { application, role } = await loadParticipation(req.params.id, req.user);
    if (role !== 'applicant') throw new ParticipationError('Solo quien se postuló puede darse de baja.', 403);
    if (!['ENVIADA', 'EN_REVISION', 'LISTA_ESPERA', 'APROBADA'].includes(application.status)) throw new ParticipationError('Esta postulación ya no está activa.');
    if (new Date(application.event.startsAt) <= new Date()) throw new ParticipationError('La feria ya empezó.');
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    const promoted = await prisma.$transaction(async (tx) => {
      await tx.eventApplication.update({ where: { id: application.id }, data: { status: 'CANCELADA', standLabel: null } });
      await tx.applicationMessage.create({
        data: { applicationId: application.id, senderUserId: req.user.id, kind: 'AUTOMATICO', body: `${application.business.name} se dio de baja de la feria.${reason ? ` Motivo: ${reason}` : ''}` },
      });
      await createNotification(tx, application.event.organizerUserId, 'Un emprendimiento se dio de baja', `${application.business.name} canceló su participación en ${application.event.name}.`, 'CONVOCATORIA', links.receivedApplication(application.id, true));
      return application.status === 'APROBADA' ? promoteWaitlist(tx, application.eventId) : [];
    });
    res.json({ message: promoted.length ? 'Te diste de baja. El lugar pasó a la lista de espera.' : 'Te diste de baja de la feria.' });
  } catch (error) {
    fail(res, error, 'No se pudo cancelar la postulación.');
  }
};

// ---------- Calificaciones ----------

export const createReview = async (req, res) => {
  try {
    const { application, role } = await loadParticipation(req.params.id, req.user);
    if (!['applicant', 'organizer'].includes(role)) throw new ParticipationError('Solo los participantes pueden calificar.', 403);
    if (application.status !== 'APROBADA') throw new ParticipationError('Solo se califican participaciones aprobadas.');
    if (!eventEnded(application.event)) throw new ParticipationError('Vas a poder calificar cuando termine la feria.');
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ParticipationError('Elegí de 1 a 5 estrellas.');
    const direction = role === 'applicant' ? 'EMPRENDEDOR_A_ORGANIZADOR' : 'ORGANIZADOR_A_EMPRENDEDOR';
    const exists = await prisma.review.findUnique({ where: { applicationId_direction: { applicationId: application.id, direction } } });
    if (exists) throw new ParticipationError('Ya calificaste esta participación.', 409);
    const review = await prisma.review.create({
      data: {
        applicationId: application.id, direction, authorUserId: req.user.id, targetUserId: otherParty(application, role),
        rating, comment: String(req.body?.comment || '').trim().slice(0, 600) || null,
      },
    });
    res.status(201).json({ message: '¡Gracias por tu calificación!', review });
  } catch (error) {
    fail(res, error, 'No se pudo guardar la calificación.');
  }
};

// ---------- Puesto y horario ----------

const cleanStand = (value, max) => (value === undefined ? undefined : (String(value || '').trim().slice(0, max) || null));

export const setStand = async (req, res) => {
  try {
    const { application, role } = await loadParticipation(req.params.id, req.user);
    if (!['organizer', 'admin'].includes(role)) throw new ParticipationError('Solo la organización asigna puestos.', 403);
    if (application.status !== 'APROBADA') throw new ParticipationError('Solo se asignan puestos a postulaciones aprobadas.');
    const standLabel = cleanStand(req.body?.standLabel, 20);
    const setupTime = cleanStand(req.body?.setupTime, 20);
    if (setupTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(setupTime)) throw new ParticipationError('La hora de armado debe tener el formato HH:MM.');
    if (standLabel) {
      const taken = await prisma.eventApplication.findFirst({ where: { eventId: application.eventId, standLabel, status: 'APROBADA', id: { not: application.id } }, include: { business: true } });
      if (taken) throw new ParticipationError(`El puesto ${standLabel} ya está asignado a ${taken.business.name}.`, 409);
    }
    const updated = await prisma.eventApplication.update({
      where: { id: application.id },
      data: { ...(standLabel !== undefined ? { standLabel } : {}), ...(setupTime !== undefined ? { setupTime } : {}) },
    });
    const changes = [standLabel !== undefined && standLabel !== application.standLabel && `Puesto: ${standLabel || 'sin asignar'}`,
      setupTime !== undefined && setupTime !== application.setupTime && `Armado: ${setupTime || 'a confirmar'}`].filter(Boolean);
    if (changes.length) {
      await prisma.applicationMessage.create({ data: { applicationId: application.id, senderUserId: application.event.organizerUserId, kind: 'AUTOMATICO', body: `Actualizamos tu lugar en ${application.event.name}. ${changes.join(' · ')}.` } });
    }
    res.json({ message: 'Puesto actualizado.', application: { id: updated.id, standLabel: updated.standLabel, setupTime: updated.setupTime } });
  } catch (error) {
    fail(res, error, 'No se pudo asignar el puesto.');
  }
};

// ---------- Plano de puestos ----------

const MARK_TYPES = ['ENTRADA', 'ESCENARIO', 'BANO', 'COCINA', 'PASILLO'];

export const saveStandPlan = async (req, res) => {
  try {
    const event = await prisma.marketEvent.findUnique({ where: { id: Number(req.params.id) } });
    if (!event || (event.organizerUserId !== req.user.id && req.user.role !== 'ADMINISTRADOR')) throw new ParticipationError('Convocatoria no encontrada.', 404);
    const plan = req.body?.standPlan;
    if (plan === null) {
      await prisma.marketEvent.update({ where: { id: event.id }, data: { standPlan: null } });
      return res.json({ message: 'Plano eliminado.', standPlan: null });
    }
    const cols = Number(plan?.cols); const rows = Number(plan?.rows);
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || cols > 24 || rows < 2 || rows > 16) throw new ParticipationError('El plano debe tener entre 2 y 24 columnas y entre 2 y 16 filas.');
    const inside = (item) => Number.isInteger(item?.x) && Number.isInteger(item?.y) && item.x >= 0 && item.y >= 0 && item.x < cols && item.y < rows;
    const stands = Array.isArray(plan.stands) ? plan.stands.slice(0, 200) : [];
    const marks = Array.isArray(plan.marks) ? plan.marks.slice(0, 200) : [];
    const labels = new Set();
    const cells = new Set();
    const cleanStands = stands.map((stand) => {
      const label = String(stand.label || '').trim().slice(0, 8);
      if (!label || !inside(stand)) throw new ParticipationError('Hay un puesto sin número o fuera del plano.');
      if (labels.has(label)) throw new ParticipationError(`El número de puesto ${label} está repetido.`);
      labels.add(label); cells.add(`${stand.x},${stand.y}`);
      return { label, x: stand.x, y: stand.y };
    });
    const cleanMarks = marks.filter((mark) => MARK_TYPES.includes(mark.type) && inside(mark) && !cells.has(`${mark.x},${mark.y}`))
      .map((mark) => ({ type: mark.type, x: mark.x, y: mark.y }));
    if (event.capacity && cleanStands.length > event.capacity) throw new ParticipationError(`La convocatoria tiene ${event.capacity} puestos y el plano ${cleanStands.length}.`);
    const standPlan = { cols, rows, stands: cleanStands, marks: cleanMarks };
    await prisma.marketEvent.update({ where: { id: event.id }, data: { standPlan } });
    // Si se borró un puesto que estaba asignado, se libera.
    await prisma.eventApplication.updateMany({ where: { eventId: event.id, standLabel: { notIn: [...labels] }, NOT: { standLabel: null } }, data: { standLabel: null } });
    res.json({ message: 'Plano guardado.', standPlan });
  } catch (error) {
    fail(res, error, 'No se pudo guardar el plano.');
  }
};

// ---------- Pago del puesto (simulado) ----------

const PAYMENT_METHODS = ['TRANSFERENCIA', 'EFECTIVO', 'OTRO'];

const assertPayable = (application, role) => {
  if (role !== 'applicant') throw new ParticipationError('Solo quien participa puede pagar su puesto.', 403);
  if (application.status !== 'APROBADA') throw new ParticipationError('El pago se habilita cuando la postulación está aprobada.');
  if (!['PENDIENTE', 'RECHAZADO'].includes(application.paymentStatus)) throw new ParticipationError('Este puesto no tiene un pago pendiente.');
};

/** Simulación de pago online: no se procesa dinero real. Queda listo para conectar Mercado Pago. */
export const simulatePayment = async (req, res) => {
  try {
    const { application, role } = await loadParticipation(req.params.id, req.user);
    assertPayable(application, role);
    const reference = `SIM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    await prisma.$transaction(async (tx) => {
      await tx.eventApplication.update({
        where: { id: application.id },
        data: { paymentStatus: 'CONFIRMADO', paymentMethod: 'ONLINE_SIMULADO', paymentReference: reference, paymentInformedAt: new Date(), paymentConfirmedAt: new Date(), paymentNotes: null },
      });
      await tx.applicationMessage.create({ data: { applicationId: application.id, senderUserId: req.user.id, kind: 'AUTOMATICO', body: `Pago del puesto acreditado (simulación). Comprobante ${reference}.` } });
      await createNotification(tx, application.event.organizerUserId, 'Pago de puesto acreditado', `${application.business.name} pagó su puesto en ${application.event.name} (simulación).`, 'PAGO', links.receivedApplication(application.id));
    });
    res.json({ message: `Pago simulado acreditado. Comprobante ${reference}.`, reference });
  } catch (error) {
    fail(res, error, 'No se pudo simular el pago.');
  }
};

/** El emprendedor informa que pagó por transferencia o en efectivo (con comprobante opcional). */
export const informPayment = async (req, res) => {
  try {
    const { application, role } = await loadParticipation(req.params.id, req.user);
    assertPayable(application, role);
    const method = PAYMENT_METHODS.includes(req.body?.method) ? req.body.method : null;
    if (!method) throw new ParticipationError('Elegí cómo pagaste.');
    const reference = String(req.body?.reference || '').trim().slice(0, 80) || null;
    await prisma.$transaction(async (tx) => {
      let receiptId = application.paymentReceiptUploadId;
      if (req.file) {
        const upload = await storeUpload({ file: req.file, ownerUserId: req.user.id, purpose: 'PAYMENT_RECEIPT', kind: 'document' }, tx);
        receiptId = upload.id;
      }
      await tx.eventApplication.update({
        where: { id: application.id },
        data: { paymentStatus: 'INFORMADO', paymentMethod: method, paymentReference: reference, paymentReceiptUploadId: receiptId, paymentInformedAt: new Date(), paymentNotes: null },
      });
      if (req.file && application.paymentReceiptUploadId) await tx.upload.delete({ where: { id: application.paymentReceiptUploadId } });
      await tx.applicationMessage.create({ data: { applicationId: application.id, senderUserId: req.user.id, kind: 'AUTOMATICO', body: `Informé el pago del puesto por ${method.toLowerCase()}${reference ? ` (referencia ${reference})` : ''}${req.file ? ', con comprobante adjunto' : ''}.` } });
      await createNotification(tx, application.event.organizerUserId, 'Pago informado para revisar', `${application.business.name} informó el pago del puesto en ${application.event.name}.`, 'PAGO', links.receivedApplication(application.id));
    });
    res.json({ message: 'Pago informado. La organización lo va a confirmar.' });
  } catch (error) {
    fail(res, error, 'No se pudo informar el pago.');
  }
};

/** La organización confirma o rechaza un pago informado. */
export const reviewPayment = async (req, res) => {
  try {
    const { application, role } = await loadParticipation(req.params.id, req.user);
    if (!['organizer', 'admin'].includes(role)) throw new ParticipationError('Solo la organización confirma pagos.', 403);
    const { status } = req.body || {};
    const notes = String(req.body?.notes || '').trim().slice(0, 500) || null;
    if (!['CONFIRMADO', 'RECHAZADO'].includes(status)) throw new ParticipationError('Elegí confirmar o rechazar el pago.');
    if (!['INFORMADO', 'PENDIENTE'].includes(application.paymentStatus)) throw new ParticipationError('No hay un pago para revisar.');
    if (status === 'RECHAZADO' && !notes) throw new ParticipationError('Contale al emprendedor por qué rechazás el pago.');
    await prisma.$transaction(async (tx) => {
      await tx.eventApplication.update({
        where: { id: application.id },
        data: { paymentStatus: status, paymentNotes: notes, ...(status === 'CONFIRMADO' ? { paymentConfirmedAt: new Date(), paymentMethod: application.paymentMethod || 'EFECTIVO' } : {}) },
      });
      await tx.applicationMessage.create({ data: { applicationId: application.id, senderUserId: application.event.organizerUserId, kind: 'AUTOMATICO', body: status === 'CONFIRMADO' ? 'Confirmamos el pago de tu puesto. ¡Gracias!' : `No pudimos confirmar el pago: ${notes}` } });
      await createNotification(tx, application.applicantUserId, status === 'CONFIRMADO' ? 'Pago confirmado' : 'Pago rechazado', `${application.event.name}: ${status === 'CONFIRMADO' ? 'tu pago fue confirmado.' : notes}`, 'PAGO', links.myApplication(application.id));
    });
    res.json({ message: status === 'CONFIRMADO' ? 'Pago confirmado.' : 'Pago rechazado.' });
  } catch (error) {
    fail(res, error, 'No se pudo revisar el pago.');
  }
};

// ---------- Ingresos del organizador ----------

/** Cobros de alquiler de puestos por feria y por día, pagos pendientes y ocupación. */
export const organizerIncome = async (req, res) => {
  try {
    const where = req.user.role === 'ADMINISTRADOR' ? {} : { organizerUserId: req.user.id };
    const events = await prisma.marketEvent.findMany({
      where: { ...where, status: { not: 'BORRADOR' } },
      select: {
        id: true, name: true, startsAt: true, endsAt: true, capacity: true, standFee: true, status: true,
        applications: { where: { status: 'APROBADA' }, select: { id: true, paymentStatus: true, paymentConfirmedAt: true, paymentMethod: true, attendedAt: true } },
      },
      orderBy: { startsAt: 'desc' }, take: 60,
    });
    const days = {};
    const byMethod = {};
    const rows = events.map((event) => {
      const fee = Number(event.standFee || 0);
      const approved = event.applications.length;
      const confirmed = event.applications.filter((item) => item.paymentStatus === 'CONFIRMADO');
      confirmed.forEach((item) => {
        const day = item.paymentConfirmedAt ? item.paymentConfirmedAt.toISOString().slice(0, 10) : null;
        if (day) days[day] = (days[day] || 0) + fee;
        const method = item.paymentMethod || 'OTRO';
        byMethod[method] = (byMethod[method] || 0) + fee;
      });
      return {
        id: event.id, name: event.name, startsAt: event.startsAt, endsAt: event.endsAt, status: event.status, fee,
        capacity: event.capacity, approved,
        occupancy: event.capacity ? Math.round((approved / event.capacity) * 100) : null,
        collected: confirmed.length * fee,
        pendingCount: event.applications.filter((item) => item.paymentStatus === 'PENDIENTE').length,
        informedCount: event.applications.filter((item) => item.paymentStatus === 'INFORMADO').length,
        pendingAmount: event.applications.filter((item) => ['PENDIENTE', 'INFORMADO', 'RECHAZADO'].includes(item.paymentStatus)).length * fee,
        attended: event.applications.filter((item) => item.attendedAt).length,
      };
    });
    // Últimos 30 días, uno por uno (los días sin cobros quedan en 0).
    const daily = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - (29 - index));
      const key = date.toISOString().slice(0, 10);
      return { day: key, total: days[key] || 0 };
    });
    const withCapacity = rows.filter((row) => row.occupancy !== null);
    res.json({
      totals: {
        collected: rows.reduce((sum, row) => sum + row.collected, 0),
        pending: rows.reduce((sum, row) => sum + row.pendingAmount, 0),
        informed: rows.reduce((sum, row) => sum + row.informedCount, 0),
        occupancy: withCapacity.length ? Math.round(withCapacity.reduce((sum, row) => sum + row.occupancy, 0) / withCapacity.length) : null,
      },
      byMethod, daily, events: rows,
    });
  } catch (error) {
    fail(res, error, 'No se pudieron calcular los ingresos.');
  }
};

/** Asistencia del día de la feria: la organización marca quién vino. */
export const setAttendance = async (req, res) => {
  try {
    const { application, role } = await loadParticipation(req.params.id, req.user);
    if (!['organizer', 'admin'].includes(role)) throw new ParticipationError('Solo la organización registra la asistencia.', 403);
    if (application.status !== 'APROBADA') throw new ParticipationError('Solo se registra la asistencia de aprobados.');
    const dayStart = new Date(application.event.startsAt); dayStart.setHours(0, 0, 0, 0);
    if (new Date() < dayStart) throw new ParticipationError('La asistencia se marca el día de la feria.');
    const present = req.body?.present === true;
    await prisma.eventApplication.update({ where: { id: application.id }, data: { attendedAt: present ? new Date() : null } });
    res.json({ message: present ? 'Presente.' : 'Ausente.', attendedAt: present ? new Date() : null });
  } catch (error) {
    fail(res, error, 'No se pudo registrar la asistencia.');
  }
};

// ---------- Recordatorio del día anterior ----------

export const sendEventReminders = async () => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const due = await prisma.eventApplication.findMany({
    where: { status: 'APROBADA', reminderSentAt: null, event: { startsAt: { gt: now, lte: tomorrow } } },
    include: { event: true },
    take: 500,
  });
  for (const application of due) {
    const hour = new Date(application.event.startsAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    await createNotification(prisma, application.applicantUserId, 'Mañana tenés feria',
      `${application.event.name} empieza a las ${hour}${application.setupTime ? `; el armado es a las ${application.setupTime}` : ''}${application.standLabel ? `. Tu puesto: ${application.standLabel}` : ''}.`,
      'RECORDATORIO', links.myApplication(application.id));
    await prisma.eventApplication.update({ where: { id: application.id }, data: { reminderSentAt: new Date() } });
  }
  return due.length;
};

export const startReminderJob = () => {
  const run = () => sendEventReminders().catch((error) => console.error('Recordatorios:', error.message));
  setTimeout(run, 15 * 1000).unref();
  setInterval(run, 30 * 60 * 1000).unref();
};

export { paymentStatusFor };
