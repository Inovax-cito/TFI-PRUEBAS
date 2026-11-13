import prisma from '../config/db.js';
import { createNotification, links } from '../config/marketplace.js';

const REPORT_REASONS = {
  ESPACIO_AJENO: 'Ofrece un espacio que no le pertenece',
  COBRO_INDEBIDO: 'Cobro indebido o estafa',
  DATOS_FALSOS: 'Datos o documentación falsos',
  TRATO: 'Trato inadecuado o acoso',
  INCUMPLIMIENTO: 'No cumplió lo acordado',
  OTRO: 'Otro motivo',
};
const TARGETS = ['CONVOCATORIA', 'CONVERSACION', 'ESPACIO', 'USUARIO'];
const ROLES = ['ADMINISTRADOR', 'EMPLEADO', 'EMPRENDEDOR', 'ORGANIZADOR'];

class PlatformError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (res, error, fallback) => {
  if (error instanceof PlatformError) return res.status(error.status).json({ message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ message: fallback });
};

// ---------- Indicadores generales ----------

export const getOverview = async (_req, res) => {
  try {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [roles, spaces, events, applications, openReports, pendingSpaces, recentSpaces, approvedSeats, capacityRows, newUsers] = await Promise.all([
      prisma.user.groupBy({ by: ['role'], where: { status: true }, _count: { _all: true } }),
      prisma.space.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.marketEvent.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.eventApplication.groupBy({ by: ['status'], where: { status: { not: 'BORRADOR' } }, _count: { _all: true } }),
      prisma.report.count({ where: { status: 'ABIERTA' } }),
      prisma.space.findMany({
        where: { status: 'PENDIENTE' }, orderBy: { updatedAt: 'asc' }, take: 5,
        select: { id: true, name: true, locality: true, updatedAt: true, owner: { select: { name: true, lastName: true } }, _count: { select: { documents: true } } },
      }),
      prisma.space.findMany({
        where: { reviewedAt: { not: null } }, orderBy: { reviewedAt: 'desc' }, take: 6,
        select: { id: true, name: true, status: true, reviewedAt: true, reviewedBy: { select: { name: true, lastName: true } } },
      }),
      prisma.eventApplication.count({ where: { status: 'APROBADA', event: { status: 'PUBLICADA', startsAt: { gte: now } } } }),
      prisma.marketEvent.aggregate({ where: { status: 'PUBLICADA', startsAt: { gte: now } }, _sum: { capacity: true } }),
      prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    ]);
    // Cada agrupación se busca por su propia columna (role o status).
    const count = (rows, key) => rows.find((row) => (row.role ?? row.status) === key)?._count._all || 0;
    const sent = applications.reduce((sum, row) => sum + row._count._all, 0);
    const decided = count(applications, 'APROBADA') + count(applications, 'NO_SELECCIONADA');
    const capacity = capacityRows._sum.capacity || 0;
    res.json({
      users: { emprendedores: count(roles, 'EMPRENDEDOR'), organizadores: count(roles, 'ORGANIZADOR'), nuevosUltimoMes: newUsers },
      spaces: { verificados: count(spaces, 'VERIFICADO'), pendientes: count(spaces, 'PENDIENTE'), rechazados: count(spaces, 'RECHAZADO'), suspendidos: count(spaces, 'SUSPENDIDO') },
      events: { publicadas: count(events, 'PUBLICADA'), cerradas: count(events, 'CERRADA'), borradores: count(events, 'BORRADOR') },
      applications: {
        enviadas: sent, aprobadas: count(applications, 'APROBADA'), enEspera: count(applications, 'LISTA_ESPERA'),
        tasaAprobacion: decided ? Math.round((count(applications, 'APROBADA') / decided) * 100) : null,
      },
      seats: { ocupados: approvedSeats, total: capacity, ocupacion: capacity ? Math.round((approvedSeats / capacity) * 100) : null },
      openReports,
      pendingSpaces,
      recentReviews: recentSpaces,
    });
  } catch (error) {
    fail(res, error, 'No se pudieron cargar los indicadores de la plataforma.');
  }
};

// ---------- Denuncias ----------

/** Cualquier persona registrada puede denunciar una convocatoria, una conversación, un espacio o un usuario. */
export const createReport = async (req, res) => {
  try {
    const { targetType, reason } = req.body || {};
    const targetId = Number(req.body?.targetId);
    if (!TARGETS.includes(targetType) || !Number.isInteger(targetId)) throw new PlatformError('No se pudo identificar qué querés denunciar.');
    if (!REPORT_REASONS[reason]) throw new PlatformError('Elegí un motivo.');
    const details = String(req.body?.details || '').trim().slice(0, 1500) || null;
    if (reason === 'OTRO' && !details) throw new PlatformError('Contanos qué pasó.');

    let label;
    if (targetType === 'CONVOCATORIA') {
      const event = await prisma.marketEvent.findUnique({ where: { id: targetId }, select: { name: true } });
      if (!event) throw new PlatformError('Convocatoria no encontrada.', 404);
      label = `la convocatoria "${event.name}"`;
    } else if (targetType === 'CONVERSACION') {
      const application = await prisma.eventApplication.findUnique({ where: { id: targetId }, include: { event: { select: { organizerUserId: true, name: true } } } });
      // Solo quien participa de la conversación puede denunciarla.
      if (!application || ![application.applicantUserId, application.event.organizerUserId].includes(req.user.id)) throw new PlatformError('Conversación no encontrada.', 404);
      label = `una conversación de "${application.event.name}"`;
    } else if (targetType === 'ESPACIO') {
      const space = await prisma.space.findUnique({ where: { id: targetId }, select: { name: true } });
      if (!space) throw new PlatformError('Espacio no encontrado.', 404);
      label = `el espacio "${space.name}"`;
    } else {
      if (targetId === req.user.id) throw new PlatformError('No podés denunciarte a vos mismo.');
      const user = await prisma.user.findUnique({ where: { id: targetId }, select: { name: true, lastName: true } });
      if (!user) throw new PlatformError('Usuario no encontrado.', 404);
      label = `a ${user.name} ${user.lastName}`;
    }

    const duplicate = await prisma.report.findFirst({ where: { reporterUserId: req.user.id, targetType, targetId, status: 'ABIERTA' } });
    if (duplicate) throw new PlatformError('Ya hiciste una denuncia sobre esto. La administración la está revisando.', 409);

    const report = await prisma.report.create({ data: { reporterUserId: req.user.id, targetType, targetId, reason, details } });
    const admins = await prisma.user.findMany({ where: { role: 'ADMINISTRADOR', status: true, id: { not: req.user.id } }, select: { id: true } });
    await prisma.notification.createMany({
      data: admins.map((admin) => ({ userId: admin.id, type: 'DENUNCIA', title: 'Nueva denuncia para revisar', description: `${REPORT_REASONS[reason]} sobre ${label}.`, link: '/denuncias' })),
    });
    res.status(201).json({ message: 'Denuncia enviada. La administración la va a revisar.', report: { id: report.id } });
  } catch (error) {
    fail(res, error, 'No se pudo enviar la denuncia.');
  }
};

/** Datos para que la administración entienda la denuncia y sepa a quién afecta. */
const describeTarget = async (report) => {
  if (report.targetType === 'CONVOCATORIA') {
    const event = await prisma.marketEvent.findUnique({ where: { id: report.targetId }, select: { id: true, name: true, status: true, organizer: { select: { id: true, name: true, lastName: true, status: true } }, space: { select: { id: true, name: true, status: true } } } });
    return event && { title: event.name, subtitle: `Convocatoria · ${event.status}`, user: event.organizer, space: event.space, eventId: event.id };
  }
  if (report.targetType === 'CONVERSACION') {
    const application = await prisma.eventApplication.findUnique({
      where: { id: report.targetId },
      include: { event: { select: { id: true, name: true, organizer: { select: { id: true, name: true, lastName: true, status: true } }, space: { select: { id: true, name: true, status: true } } } }, applicant: { select: { id: true, name: true, lastName: true, status: true } }, business: { select: { name: true } } },
    });
    if (!application) return null;
    // La persona denunciada es la otra parte de la conversación.
    const user = application.applicantUserId === report.reporterUserId ? application.event.organizer : application.applicant;
    return { title: `${application.business.name} · ${application.event.name}`, subtitle: 'Conversación', user, space: application.event.space, eventId: application.event.id, applicationId: application.id };
  }
  if (report.targetType === 'ESPACIO') {
    const space = await prisma.space.findUnique({ where: { id: report.targetId }, select: { id: true, name: true, status: true, owner: { select: { id: true, name: true, lastName: true, status: true } } } });
    return space && { title: space.name, subtitle: `Espacio · ${space.status}`, user: space.owner, space };
  }
  const user = await prisma.user.findUnique({ where: { id: report.targetId }, select: { id: true, name: true, lastName: true, role: true, status: true } });
  return user && { title: `${user.name} ${user.lastName}`, subtitle: `Usuario · ${user.role}`, user };
};

export const listReports = async (req, res) => {
  try {
    const status = ['ABIERTA', 'RESUELTA', 'DESCARTADA'].includes(req.query.status) ? req.query.status : 'ABIERTA';
    const reports = await prisma.report.findMany({
      where: { status }, orderBy: { createdAt: status === 'ABIERTA' ? 'asc' : 'desc' }, take: 100,
      include: { reporter: { select: { id: true, name: true, lastName: true, email: true } }, resolvedBy: { select: { name: true, lastName: true } } },
    });
    const detailed = await Promise.all(reports.map(async (report) => ({ ...report, reasonLabel: REPORT_REASONS[report.reason] || report.reason, target: await describeTarget(report) })));
    res.json({ reports: detailed, reasons: REPORT_REASONS });
  } catch (error) {
    fail(res, error, 'No se pudieron cargar las denuncias.');
  }
};

const ACTIONS = ['NINGUNA', 'SUSPENDER_USUARIO', 'SUSPENDER_ESPACIO', 'CERRAR_CONVOCATORIA'];

export const resolveReport = async (req, res) => {
  try {
    const report = await prisma.report.findUnique({ where: { id: Number(req.params.id) } });
    if (!report) throw new PlatformError('Denuncia no encontrada.', 404);
    if (report.status !== 'ABIERTA') throw new PlatformError('La denuncia ya fue resuelta.');
    const { status } = req.body || {};
    const action = ACTIONS.includes(req.body?.action) ? req.body.action : 'NINGUNA';
    const notes = String(req.body?.notes || '').trim().slice(0, 1500);
    if (!['RESUELTA', 'DESCARTADA'].includes(status)) throw new PlatformError('Elegí resolver o descartar.');
    if (!notes) throw new PlatformError('Dejá una nota de lo que decidiste.');
    const target = await describeTarget(report);
    if (action === 'SUSPENDER_USUARIO' && (!target?.user || target.user.id === req.user.id)) throw new PlatformError('No hay un usuario para suspender.');
    if (action === 'SUSPENDER_ESPACIO' && !target?.space) throw new PlatformError('La denuncia no está asociada a un espacio.');
    if (action === 'CERRAR_CONVOCATORIA' && !target?.eventId) throw new PlatformError('La denuncia no está asociada a una convocatoria.');

    await prisma.$transaction(async (tx) => {
      if (action === 'SUSPENDER_USUARIO') await tx.user.update({ where: { id: target.user.id }, data: { status: false } });
      if (action === 'SUSPENDER_ESPACIO') {
        await tx.space.update({ where: { id: target.space.id }, data: { status: 'SUSPENDIDO', reviewNotes: notes, reviewedAt: new Date(), reviewedByUserId: req.user.id } });
        await tx.marketEvent.updateMany({ where: { spaceId: target.space.id, status: 'PUBLICADA' }, data: { status: 'CERRADA' } });
      }
      if (action === 'CERRAR_CONVOCATORIA') await tx.marketEvent.update({ where: { id: target.eventId }, data: { status: 'CERRADA' } });
      await tx.report.update({ where: { id: report.id }, data: { status, resolutionNotes: notes, resolvedByUserId: req.user.id, resolvedAt: new Date() } });
      await createNotification(tx, report.reporterUserId, 'Revisamos tu denuncia',
        status === 'RESUELTA' ? `Tomamos medidas: ${notes}` : `La revisamos y no encontramos una falta: ${notes}`, 'DENUNCIA', null);
    });
    res.json({ message: status === 'RESUELTA' ? 'Denuncia resuelta.' : 'Denuncia descartada.' });
  } catch (error) {
    fail(res, error, 'No se pudo resolver la denuncia.');
  }
};

// ---------- Usuarios ----------

export const listUsers = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 80);
    const role = ROLES.includes(req.query.role) ? req.query.role : undefined;
    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(search ? { OR: [{ name: { contains: search } }, { lastName: { contains: search } }, { email: { contains: search } }, { username: { contains: search } }] } : {}),
      },
      select: {
        id: true, name: true, lastName: true, username: true, email: true, role: true, status: true, createdAt: true, googleId: true,
        businessProfile: { select: { name: true, category: true } },
        _count: { select: { spaces: true, eventApplications: true, organizedEvents: true } },
      },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    const reports = await prisma.report.groupBy({ by: ['targetId'], where: { targetType: 'USUARIO', status: 'ABIERTA', targetId: { in: users.map((user) => user.id) } }, _count: { _all: true } });
    const reportCount = Object.fromEntries(reports.map((row) => [row.targetId, row._count._all]));
    res.json(users.map(({ googleId, ...user }) => ({ ...user, withGoogle: Boolean(googleId), openReports: reportCount[user.id] || 0 })));
  } catch (error) {
    fail(res, error, 'No se pudieron cargar los usuarios.');
  }
};

export const updateUserAccess = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) throw new PlatformError('No podés cambiar tu propio rol ni suspender tu cuenta.');
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new PlatformError('Usuario no encontrado.', 404);
    const data = {};
    if (req.body?.role !== undefined) {
      if (!ROLES.includes(req.body.role)) throw new PlatformError('Rol no válido.');
      data.role = req.body.role;
      data.onboardingCompleted = true;
    }
    if (req.body?.status !== undefined) data.status = Boolean(req.body.status);
    if (!Object.keys(data).length) throw new PlatformError('No hay cambios para guardar.');
    await prisma.user.update({ where: { id }, data });
    if (data.status === false) {
      await createNotification(prisma, id, 'Tu cuenta fue suspendida', 'Comunicate con la administración de Emprende para más información.', 'CUENTA');
    }
    res.json({ message: data.status === false ? 'Cuenta suspendida.' : data.status === true ? 'Cuenta reactivada.' : 'Rol actualizado.' });
  } catch (error) {
    fail(res, error, 'No se pudo actualizar el usuario.');
  }
};

export { links };
