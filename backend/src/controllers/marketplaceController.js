import prisma from '../config/db.js';
import { LOCALITIES, createNotification, links, parseCoordinates } from '../config/marketplace.js';
import {
  cleanTemplate, paymentStatusFor, promoteWaitlist, ratingSummary, sendStatusMessage, unreadByApplication, waitlistPositions,
} from '../config/participation.js';
import { publicFileUrl } from '../config/uploads.js';

const EVENT_STATUSES = ['BORRADOR', 'PUBLICADA', 'CERRADA'];
const APPLICATION_STATUSES = ['EN_REVISION', 'APROBADA', 'NO_SELECCIONADA', 'LISTA_ESPERA'];
const fileKey = { select: { key: true, isPublic: true } };
const eventInclude = {
  organizer: { select: { id: true, name: true, lastName: true } },
  space: { select: { id: true, name: true, type: true, status: true, capacity: true, address: true, cover: fileKey } },
  _count: { select: { applications: { where: { status: 'APROBADA' } } } },
};

const isPlatformAdmin = (user) => user.role === 'ADMINISTRADOR';
const canManageEvent = (user, event) => isPlatformAdmin(user) || event.organizerUserId === user.id;
// Las convocatorias públicas solo se muestran si su espacio sigue verificado (o si las publicó la plataforma sin espacio).
const publicEventWhere = { status: { in: ['PUBLICADA', 'CERRADA'] }, OR: [{ spaceId: null }, { space: { status: 'VERIFICADO' } }] };
const serializeEvent = (event, ratings = {}) => {
  if (!event) return event;
  const { cover, ...space } = event.space || {};
  return {
    ...event,
    standFee: event.standFee === null || event.standFee === undefined ? null : Number(event.standFee),
    space: event.space ? { ...space, coverUrl: publicFileUrl(cover) } : null,
    organizerRating: ratings[event.organizerUserId] || null,
  };
};
const organizerRatings = (events) => ratingSummary(prisma, events.map((event) => event.organizerUserId), 'EMPRENDEDOR_A_ORGANIZADOR');

const normalizeCategories = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join('|');
  return typeof value === 'string' ? value.split(/[|,]/).map((item) => item.trim()).filter(Boolean).join('|') : '';
};

const dateValue = (value, field) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`Revisá el campo ${field}: ingresá una fecha válida.`);
  return date;
};

const notifyUser = (tx, userId, title, description, link = null) => createNotification(tx, userId, title, description, 'CONVOCATORIA', link);

export const getBusinessProfile = async (req, res) => {
  try {
    const profile = await prisma.businessProfile.findUnique({ where: { ownerUserId: req.user.id } });
    res.json({ profile, localities: LOCALITIES, emailConfigured: false });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el perfil del negocio.' });
  }
};

export const saveBusinessProfile = async (req, res) => {
  try {
    const { name, kind, category, description, locality, address, contactPhone, contactEmail, notificationsEnabled } = req.body;
    if (!name?.trim() || !category?.trim() || !locality?.trim()) {
      return res.status(400).json({ message: 'Completá el nombre, el rubro y la localidad del negocio.' });
    }
    if (!['FIJO', 'ITINERANTE'].includes(kind)) return res.status(400).json({ message: 'Elegí si el negocio es fijo o itinerante.' });
    if (!LOCALITIES.includes(locality)) return res.status(400).json({ message: 'Elegí una de las localidades disponibles.' });
    const cleanEmail = contactEmail?.trim().toLowerCase() || null;
    const cleanPhone = contactPhone?.trim() || null;
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'Revisá el correo de contacto; debe tener un formato como nombre@dominio.com.' });
    }
    if (cleanPhone && (!/^[+()\d\s.-]{7,40}$/.test(cleanPhone) || cleanPhone.replace(/\D/g, '').length < 7 || cleanPhone.replace(/\D/g, '').length > 15)) {
      return res.status(400).json({ message: 'Revisá el teléfono de contacto; ingresá entre 7 y 15 dígitos.' });
    }
    const data = {
      name: name.trim().slice(0, 120), kind, category: category.trim().slice(0, 80), locality,
      description: description?.trim() || null, address: address?.trim() || null,
      contactPhone: cleanPhone, contactEmail: cleanEmail,
      notificationsEnabled: notificationsEnabled !== false,
    };
    const profile = await prisma.businessProfile.upsert({
      where: { ownerUserId: req.user.id }, create: { ownerUserId: req.user.id, ...data }, update: data,
    });
    res.json({ message: 'Perfil del negocio guardado.', profile, emailConfigured: false });
  } catch (error) {
    res.status(500).json({ message: error.message || 'No se pudo guardar el perfil del negocio.' });
  }
};

export const listEvents = async (req, res) => {
  try {
    const { locality, category, from, to, mine } = req.query;
    const q = String(req.query.q || '').trim().slice(0, 80);
    let where;
    if (mine === '1' && req.user.role === 'ORGANIZADOR') where = { organizerUserId: req.user.id };
    else if (isPlatformAdmin(req.user)) where = {};
    else where = { ...publicEventWhere };
    if (locality && LOCALITIES.includes(locality)) where.locality = locality;
    // Un rubro incluye también las ferias abiertas a todos los rubros.
    if (category) where.AND = [...(where.AND || []), { OR: [{ acceptedCategories: null }, { acceptedCategories: '' }, { acceptedCategories: { contains: category.trim() } }] }];
    // Búsqueda libre (encabezado): nombre, descripción, rubros, localidad o espacio.
    if (q) {
      where.AND = [...(where.AND || []), { OR: [
        { name: { contains: q } }, { description: { contains: q } }, { acceptedCategories: { contains: q } },
        { locality: { contains: q } }, { address: { contains: q } }, { space: { name: { contains: q } } },
      ] }];
    }
    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = dateValue(from, 'fecha desde');
      if (to) {
        const inclusiveEnd = dateValue(to, 'fecha hasta');
        inclusiveEnd.setUTCHours(23, 59, 59, 999);
        where.startsAt.lte = inclusiveEnd;
      }
    }
    const events = await prisma.marketEvent.findMany({ where, include: eventInclude, orderBy: { startsAt: 'asc' } });
    const ratings = await organizerRatings(events);
    res.json(events.map((event) => serializeEvent(event, ratings)));
  } catch (error) {
    res.status(500).json({ message: error.message || 'No se pudieron cargar las convocatorias.' });
  }
};

export const getEvent = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const event = await prisma.marketEvent.findUnique({ where: { id }, include: eventInclude });
    const visibleToPublic = event && event.status !== 'BORRADOR' && (!event.space || event.space.status === 'VERIFICADO');
    if (!event || (!visibleToPublic && !canManageEvent(req.user, event))) {
      return res.status(404).json({ message: 'No encontramos esa convocatoria disponible.' });
    }
    const business = await prisma.businessProfile.findUnique({ where: { ownerUserId: req.user.id } });
    const application = business ? await prisma.eventApplication.findUnique({ where: { eventId_businessId: { eventId: id, businessId: business.id } } }) : null;
    const ratings = await organizerRatings([event]);
    res.json({ event: serializeEvent(event, ratings), application });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar el detalle de la convocatoria.' });
  }
};

const eventDataFromBody = (body) => {
  const { name, locality, address, latitude, longitude, startsAt, endsAt, applicationDeadline, description, requirements, capacity, status } = body;
  if (!name?.trim() || !LOCALITIES.includes(locality) || !description?.trim()) {
    throw new Error('Completá el nombre, la descripción y elegí una localidad válida.');
  }
  if (status && !EVENT_STATUSES.includes(status)) throw new Error('El estado de la convocatoria no es válido.');
  const start = dateValue(startsAt, 'inicio del evento');
  const end = dateValue(endsAt, 'fin del evento');
  const deadline = dateValue(applicationDeadline, 'fecha límite');
  if (end <= start) throw new Error('El horario de cierre debe ser posterior al inicio.');
  if (deadline >= start) throw new Error('La fecha límite debe ser anterior al inicio del evento.');
  const seats = capacity === '' || capacity === null || capacity === undefined ? null : Number(capacity);
  if (seats !== null && (!Number.isInteger(seats) || seats < 1)) throw new Error('La cantidad de puestos debe ser un número entero mayor que cero.');
  const fee = body.standFee === '' || body.standFee === null || body.standFee === undefined ? null : Number(body.standFee);
  if (fee !== null && (!Number.isFinite(fee) || fee < 0 || fee > 100000000)) throw new Error('El costo del puesto no es válido.');
  return {
    standFee: fee === null ? null : Math.round(fee * 100) / 100,
    name: name.trim().slice(0, 160), locality, address: address?.trim() || null,
    ...parseCoordinates(latitude, longitude), startsAt: start, endsAt: end,
    applicationDeadline: deadline, description: description.trim(),
    acceptedCategories: normalizeCategories(body.acceptedCategories) || null,
    requirements: requirements?.trim() || null, capacity: seats,
    ...(status ? { status } : {}),
    ...(cleanTemplate(body.approvalMessage) !== undefined ? { approvalMessage: cleanTemplate(body.approvalMessage) } : {}),
    ...(cleanTemplate(body.rejectionMessage) !== undefined ? { rejectionMessage: cleanTemplate(body.rejectionMessage) } : {}),
  };
};

// Resuelve el espacio de la convocatoria. Un organizador solo puede usar espacios propios y verificados;
// la ubicación del evento se toma del espacio para que no pueda declararse otro lugar.
const resolveSpace = async (user, rawSpaceId, data, { requireVerified = true } = {}) => {
  const spaceId = rawSpaceId === '' || rawSpaceId === null || rawSpaceId === undefined ? null : Number(rawSpaceId);
  if (spaceId === null) {
    if (!isPlatformAdmin(user)) throw new Error('Elegí uno de tus espacios verificados para publicar la convocatoria.');
    return { spaceId: null };
  }
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space || (!isPlatformAdmin(user) && space.ownerUserId !== user.id)) throw new Error('El espacio elegido no es tuyo.');
  if (requireVerified && space.status !== 'VERIFICADO') throw new Error('El espacio todavía no está verificado. Esperá la revisión de la documentación.');
  if (space.capacity && data.capacity && data.capacity > space.capacity) {
    throw new Error(`El espacio admite hasta ${space.capacity} puestos.`);
  }
  return { spaceId: space.id, locality: space.locality, address: space.address, latitude: space.latitude, longitude: space.longitude };
};

export const createEvent = async (req, res) => {
  try {
    const data = eventDataFromBody(req.body);
    Object.assign(data, await resolveSpace(req.user, req.body.spaceId, data));
    const event = await prisma.marketEvent.create({ data: { ...data, organizerUserId: req.user.id }, include: eventInclude });
    if (event.status === 'PUBLICADA') await notifyInterestedUsers(event);
    res.status(201).json({ message: 'Convocatoria creada.', event: serializeEvent(event) });
  } catch (error) {
    res.status(400).json({ message: error.message || 'No se pudo crear la convocatoria.' });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = await prisma.marketEvent.findUnique({ where: { id } });
    if (!current || !canManageEvent(req.user, current)) return res.status(404).json({ message: 'Convocatoria no encontrada.' });
    const { standPlan: _plan, space: _space, organizer: _organizer, _count, organizerRating: _rating, ...body } = req.body;
    const data = eventDataFromBody({ ...current, standFee: current.standFee === null ? null : Number(current.standFee), ...body });
    const nextSpaceId = body.spaceId === undefined ? current.spaceId : body.spaceId;
    const spaceChanged = String(nextSpaceId ?? '') !== String(current.spaceId ?? '');
    const publishing = data.status === 'PUBLICADA';
    if (spaceChanged || publishing || nextSpaceId !== null || !isPlatformAdmin(req.user)) {
      // Se exige espacio verificado para publicar o cambiar de espacio; cerrar o pasar a borrador siempre se permite.
      Object.assign(data, await resolveSpace(req.user, nextSpaceId, data, { requireVerified: spaceChanged || publishing }));
    }
    const event = await prisma.marketEvent.update({ where: { id }, data, include: eventInclude });
    if (current.status !== 'PUBLICADA' && event.status === 'PUBLICADA') await notifyInterestedUsers(event);
    res.json({ message: 'Convocatoria actualizada.', event: serializeEvent(event) });
  } catch (error) {
    res.status(400).json({ message: error.message || 'No se pudo actualizar la convocatoria.' });
  }
};

async function notifyInterestedUsers(event) {
  const profiles = await prisma.businessProfile.findMany({
    where: { notificationsEnabled: true, locality: event.locality }, select: { ownerUserId: true },
  });
  if (!profiles.length) return;
  await prisma.notification.createMany({
    data: profiles.filter((profile) => profile.ownerUserId !== event.organizerUserId).map((profile) => ({
      userId: profile.ownerUserId, type: 'CONVOCATORIA', title: 'Nueva convocatoria en tu zona',
      description: `${event.name} · ${event.locality}. Revisá las fechas y los requisitos antes de postularte.`,
      link: links.event(event.id),
    })),
  });
}

export const listApplications = async (req, res) => {
  try {
    const applications = await prisma.eventApplication.findMany({
      where: { applicantUserId: req.user.id },
      include: {
        event: { include: { space: { select: { id: true, name: true, type: true, address: true, cover: fileKey } }, organizer: { select: { id: true, name: true, lastName: true } } } },
        business: true,
        reviews: { select: { direction: true, rating: true, comment: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const ids = applications.map((item) => item.id);
    const [unread, positions, ratings] = await Promise.all([
      unreadByApplication(prisma, req.user.id, ids),
      waitlistPositions(prisma, [...new Set(applications.filter((item) => item.status === 'LISTA_ESPERA').map((item) => item.eventId))]),
      ratingSummary(prisma, applications.map((item) => item.event.organizerUserId), 'EMPRENDEDOR_A_ORGANIZADOR'),
    ]);
    res.json(applications.map(({ reviews, ...item }) => ({
      ...item,
      event: { ...serializeEvent(item.event, ratings), standPlan: item.status === 'APROBADA' ? item.event.standPlan : null },
      unreadMessages: unread[item.id] || 0,
      waitlistPosition: positions[item.id] || null,
      myReview: reviews.find((review) => review.direction === 'EMPRENDEDOR_A_ORGANIZADOR') || null,
      receivedReview: reviews.find((review) => review.direction === 'ORGANIZADOR_A_EMPRENDEDOR') || null,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudieron cargar tus postulaciones.' });
  }
};

export const saveApplication = async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const offeredProduct = req.body.offeredProduct?.trim();
    const additionalInfo = req.body.additionalInfo?.trim() || null;
    const send = req.body.send === true;
    if (!offeredProduct) return res.status(400).json({ message: 'Contanos qué producto o servicio vas a ofrecer.' });
    const [business, event] = await Promise.all([
      prisma.businessProfile.findUnique({ where: { ownerUserId: req.user.id } }),
      prisma.marketEvent.findUnique({ where: { id: eventId } }),
    ]);
    if (!business) return res.status(400).json({ message: 'Completá primero el perfil de tu negocio.' });
    if (!event || event.status !== 'PUBLICADA') return res.status(404).json({ message: 'La convocatoria no está abierta para postularse.' });
    if (new Date(event.applicationDeadline) <= new Date()) return res.status(400).json({ message: 'El período de postulación terminó.' });
    const accepted = event.acceptedCategories?.split('|').map((item) => item.trim().toLocaleLowerCase('es-AR')) || [];
    if (accepted.length && !accepted.includes(business.category.toLocaleLowerCase('es-AR'))) {
      return res.status(400).json({ message: `Esta convocatoria admite: ${accepted.join(', ')}. El rubro guardado en tu perfil es “${business.category}”.` });
    }
    const existing = await prisma.eventApplication.findUnique({ where: { eventId_businessId: { eventId, businessId: business.id } } });
    if (existing && existing.status !== 'BORRADOR') return res.status(409).json({ message: 'Ya enviaste una postulación para esta convocatoria.' });
    const contactEmail = req.body.contactEmail === undefined ? business.contactEmail : (req.body.contactEmail?.trim().toLowerCase() || null);
    const contactPhone = req.body.contactPhone === undefined ? business.contactPhone : (req.body.contactPhone?.trim() || null);
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return res.status(400).json({ message: 'Revisá el correo de contacto; debe tener un formato como nombre@dominio.com.' });
    }
    if (contactPhone && (!/^[+()\d\s.-]{7,40}$/.test(contactPhone) || contactPhone.replace(/\D/g, '').length < 7 || contactPhone.replace(/\D/g, '').length > 15)) {
      return res.status(400).json({ message: 'Revisá el teléfono de contacto; ingresá entre 7 y 15 dígitos.' });
    }
    if (send && !contactEmail && !contactPhone) {
      return res.status(400).json({ message: 'Agregá un correo o un teléfono de contacto en este formulario o en Mi negocio antes de enviar.' });
    }
    if (contactEmail !== business.contactEmail || contactPhone !== business.contactPhone) {
      await prisma.businessProfile.update({ where: { id: business.id }, data: { contactEmail, contactPhone } });
    }
    const status = send ? 'ENVIADA' : 'BORRADOR';
    const application = await prisma.eventApplication.upsert({
      where: { eventId_businessId: { eventId, businessId: business.id } },
      create: { eventId, businessId: business.id, applicantUserId: req.user.id, offeredProduct: offeredProduct.slice(0, 300), additionalInfo, status },
      update: { offeredProduct: offeredProduct.slice(0, 300), additionalInfo, status },
      include: { event: true, business: true },
    });
    if (send) {
      await notifyUser(prisma, event.organizerUserId, 'Nueva postulación para revisar', `${business.name} se postuló a ${event.name}.`, links.receivedApplication(application.id));
    }
    res.status(existing ? 200 : 201).json({ message: send ? 'Postulación enviada.' : 'Borrador guardado.', application });
  } catch (error) {
    res.status(500).json({ message: error.message || 'No se pudo guardar la postulación.' });
  }
};

export const adminListApplications = async (req, res) => {
  try {
    const applications = await prisma.eventApplication.findMany({
      where: {
        status: { in: ['ENVIADA', 'EN_REVISION', 'APROBADA', 'NO_SELECCIONADA', 'LISTA_ESPERA', 'CANCELADA'] },
        ...(isPlatformAdmin(req.user) ? {} : { event: { organizerUserId: req.user.id } }),
      },
      include: {
        event: { select: { id: true, name: true, startsAt: true, endsAt: true, capacity: true, standFee: true, organizerUserId: true, status: true } },
        business: {
          include: {
            photos: { include: { upload: fileKey }, orderBy: { position: 'asc' }, take: 8 },
            products: { where: { active: true }, include: { photo: fileKey }, orderBy: { name: 'asc' }, take: 12 },
          },
        },
        applicant: { select: { id: true, name: true, lastName: true, email: true } },
        reviews: { select: { direction: true, rating: true, comment: true } },
      },
      orderBy: [{ eventId: 'asc' }, { createdAt: 'asc' }],
    });
    const ids = applications.map((item) => item.id);
    const [unread, positions, ratings] = await Promise.all([
      unreadByApplication(prisma, req.user.id, ids),
      waitlistPositions(prisma, [...new Set(applications.map((item) => item.eventId))]),
      ratingSummary(prisma, applications.map((item) => item.applicantUserId), 'ORGANIZADOR_A_EMPRENDEDOR'),
    ]);
    res.json(applications.map(({ reviews, business, ...item }) => {
      const { photos, products, ...profile } = business;
      return {
        ...item,
        event: { ...item.event, standFee: item.event.standFee === null ? null : Number(item.event.standFee) },
        business: {
          ...profile,
          photos: photos.map((photo) => publicFileUrl(photo.upload)),
          products: products.map((product) => ({ id: product.id, name: product.name, price: Number(product.price), photoUrl: publicFileUrl(product.photo) })),
          rating: ratings[item.applicantUserId] || null,
        },
        unreadMessages: unread[item.id] || 0,
        waitlistPosition: positions[item.id] || null,
        myReview: reviews.find((review) => review.direction === 'ORGANIZADOR_A_EMPRENDEDOR') || null,
      };
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudieron cargar las postulaciones recibidas.' });
  }
};

export const setApplicationStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const reviewNotes = req.body.reviewNotes?.trim().slice(0, 1000) || null;
    const standLabel = req.body.standLabel === undefined ? undefined : (String(req.body.standLabel || '').trim().slice(0, 20) || null);
    const setupTime = req.body.setupTime === undefined ? undefined : (String(req.body.setupTime || '').trim() || null);
    if (!APPLICATION_STATUSES.includes(status)) return res.status(400).json({ message: 'Elegí un estado de revisión válido.' });
    if (setupTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(setupTime)) return res.status(400).json({ message: 'La hora de armado debe tener el formato HH:MM.' });
    const current = await prisma.eventApplication.findUnique({ where: { id }, include: { event: true, business: true } });
    if (!current || !canManageEvent(req.user, current.event)) return res.status(404).json({ message: 'Postulación no encontrada.' });
    if (current.applicantUserId === req.user.id) return res.status(403).json({ message: 'No podés revisar ni aprobar tu propia postulación.' });
    if (!['ENVIADA', 'EN_REVISION', 'APROBADA', 'LISTA_ESPERA'].includes(current.status)) return res.status(400).json({ message: 'Esta postulación no está disponible para revisión.' });
    if (status === 'APROBADA' && current.event.capacity !== null && current.status !== 'APROBADA') {
      const acceptedCount = await prisma.eventApplication.count({ where: { eventId: current.eventId, status: 'APROBADA' } });
      if (acceptedCount >= current.event.capacity) {
        return res.status(409).json({ message: 'Ya se asignaron todos los puestos. Podés dejarla en lista de espera: si alguien se baja, entra automáticamente.' });
      }
    }
    if (standLabel) {
      const taken = await prisma.eventApplication.findFirst({ where: { eventId: current.eventId, standLabel, status: 'APROBADA', id: { not: id } }, include: { business: true } });
      if (taken) return res.status(409).json({ message: `El puesto ${standLabel} ya está asignado a ${taken.business.name}.` });
    }
    const changed = current.status !== status;
    const promoted = await prisma.$transaction(async (tx) => {
      await tx.eventApplication.update({
        where: { id },
        data: {
          status,
          ...(reviewNotes ? { reviewNotes } : {}),
          ...(status === 'APROBADA' ? {
            ...(standLabel !== undefined ? { standLabel } : {}),
            ...(setupTime !== undefined ? { setupTime } : {}),
            ...(current.status !== 'APROBADA' ? { paymentStatus: paymentStatusFor(current.event) } : {}),
          } : { standLabel: null }),
          ...(status === 'LISTA_ESPERA' && current.status !== 'LISTA_ESPERA' ? { waitlistedAt: new Date() } : {}),
        },
      });
      if (changed && ['APROBADA', 'NO_SELECCIONADA', 'LISTA_ESPERA'].includes(status)) await sendStatusMessage(tx, id, status);
      if (reviewNotes) {
        await tx.applicationMessage.create({ data: { applicationId: id, senderUserId: current.event.organizerUserId, body: reviewNotes } });
      }
      // Si se liberó un puesto aprobado, entra el siguiente de la lista de espera.
      return current.status === 'APROBADA' && status !== 'APROBADA' ? promoteWaitlist(tx, current.eventId) : [];
    });
    if (changed) {
      await notifyUser(prisma, current.applicantUserId, 'Cambió el estado de tu postulación',
        `${current.event.name}: ${statusLabel(status)}. Tenés un mensaje de la organización.`, links.myApplication(id, true));
    }
    const application = await prisma.eventApplication.findUnique({ where: { id }, include: { event: true, business: true } });
    res.json({
      message: `Postulación marcada como ${statusLabel(status).toLowerCase()}.${promoted.length ? ' Entró el siguiente de la lista de espera.' : ''}`,
      application,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'No se pudo actualizar el estado de la postulación.' });
  }
};

const statusLabel = (status) => ({
  BORRADOR: 'Borrador', ENVIADA: 'Enviada', EN_REVISION: 'En revisión', APROBADA: 'Aprobada',
  NO_SELECCIONADA: 'No seleccionada', CANCELADA: 'Cancelada', LISTA_ESPERA: 'Lista de espera',
}[status] || status);

export const getEventActivity = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const business = await prisma.businessProfile.findUnique({ where: { ownerUserId: req.user.id } });
    const event = await prisma.marketEvent.findUnique({ where: { id: eventId }, select: { organizerUserId: true } });
    const isManager = event && canManageEvent(req.user, event);
    const approved = business && await prisma.eventApplication.findFirst({ where: { eventId, businessId: business.id, status: 'APROBADA' } });
    if (!isManager && !approved) return res.status(403).json({ message: 'La actividad del evento está disponible para negocios con participación aprobada.' });
    const scope = isManager ? { eventId } : { eventId, businessId: business.id };
    const [sales, orders, expenses, businessExpenses] = await Promise.all([
      prisma.sale.findMany({ where: { ...scope, status: 'COMPLETADA' }, include: { details: { include: { product: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } }),
      prisma.businessOrder.findMany({ where: { ...scope, status: 'ENTREGADO' }, include: { items: true }, orderBy: { createdAt: 'desc' } }),
      prisma.cashMovement.findMany({ where: { ...scope, type: 'EGRESO', category: { not: 'CANCELACION_VENTA_EVENTO' } }, orderBy: { createdAt: 'desc' } }),
      prisma.businessExpense.findMany({ where: scope, orderBy: { createdAt: 'desc' } }),
    ]);
    const salesTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0)
      + orders.reduce((sum, order) => sum + Number(order.total), 0);
    const expensesTotal = expenses.reduce((sum, movement) => sum + Number(movement.amount), 0)
      + businessExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
    res.json({ sales, orders, expenses, summary: { salesTotal, expensesTotal, difference: salesTotal - expensesTotal } });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar la actividad del evento.' });
  }
};
