import prisma from '../config/db.js';

const LOCALITIES = ['Banda del Río Salí', 'Cruz Alta', 'Alderetes'];
const EVENT_STATUSES = ['BORRADOR', 'PUBLICADA', 'CERRADA'];
const APPLICATION_STATUSES = ['EN_REVISION', 'APROBADA', 'NO_SELECCIONADA'];
const eventInclude = {
  organizer: { select: { id: true, name: true, lastName: true } },
  _count: { select: { applications: { where: { status: 'APROBADA' } } } },
};

const parseCoordinates = (latitude, longitude) => {
  const empty = latitude === '' || latitude === null || latitude === undefined;
  const emptyLongitude = longitude === '' || longitude === null || longitude === undefined;
  if (empty && emptyLongitude) return { latitude: null, longitude: null };
  if (empty || emptyLongitude) throw new Error('Ingresá latitud y longitud juntas, o dejá ambas vacías.');
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Las coordenadas no son válidas. Latitud: −90 a 90; longitud: −180 a 180.');
  }
  return { latitude: lat, longitude: lng };
};

const normalizeCategories = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join('|');
  return typeof value === 'string' ? value.split(/[|,]/).map((item) => item.trim()).filter(Boolean).join('|') : '';
};

const dateValue = (value, field) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`Revisá el campo ${field}: ingresá una fecha válida.`);
  return date;
};

const notifyUser = async (tx, userId, title, description) => {
  const profile = await tx.businessProfile.findUnique({ where: { ownerUserId: userId }, select: { notificationsEnabled: true } });
  if (profile?.notificationsEnabled === false) return;
  await tx.notification.create({ data: { userId, type: 'CONVOCATORIA', title, description, read: false } });
};

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
    if (!LOCALITIES.includes(locality)) return res.status(400).json({ message: 'Elegí una localidad disponible: Banda del Río Salí, Cruz Alta o Alderetes.' });
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
    const { locality, category, from, to } = req.query;
    const where = req.user.role === 'ADMINISTRADOR' ? {} : { status: { in: ['PUBLICADA', 'CERRADA'] } };
    if (locality && LOCALITIES.includes(locality)) where.locality = locality;
    if (category) where.acceptedCategories = { contains: category.trim() };
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
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message || 'No se pudieron cargar las convocatorias.' });
  }
};

export const getEvent = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const event = await prisma.marketEvent.findUnique({ where: { id }, include: eventInclude });
    if (!event || (event.status === 'BORRADOR' && req.user.role !== 'ADMINISTRADOR')) {
      return res.status(404).json({ message: 'No encontramos esa convocatoria disponible.' });
    }
    const business = await prisma.businessProfile.findUnique({ where: { ownerUserId: req.user.id } });
    const application = business ? await prisma.eventApplication.findUnique({ where: { eventId_businessId: { eventId: id, businessId: business.id } } }) : null;
    res.json({ event, application });
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
  return {
    name: name.trim().slice(0, 160), locality, address: address?.trim() || null,
    ...parseCoordinates(latitude, longitude), startsAt: start, endsAt: end,
    applicationDeadline: deadline, description: description.trim(),
    acceptedCategories: normalizeCategories(body.acceptedCategories) || null,
    requirements: requirements?.trim() || null, capacity: seats,
    ...(status ? { status } : {}),
  };
};

export const createEvent = async (req, res) => {
  try {
    const data = eventDataFromBody(req.body);
    const event = await prisma.marketEvent.create({ data: { ...data, organizerUserId: req.user.id }, include: eventInclude });
    if (event.status === 'PUBLICADA') await notifyInterestedUsers(event);
    res.status(201).json({ message: 'Convocatoria creada.', event });
  } catch (error) {
    res.status(400).json({ message: error.message || 'No se pudo crear la convocatoria.' });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = await prisma.marketEvent.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: 'Convocatoria no encontrada.' });
    const data = eventDataFromBody({ ...current, ...req.body });
    const event = await prisma.marketEvent.update({ where: { id }, data, include: eventInclude });
    if (current.status !== 'PUBLICADA' && event.status === 'PUBLICADA') await notifyInterestedUsers(event);
    res.json({ message: 'Convocatoria actualizada.', event });
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
    })),
  });
}

export const listApplications = async (req, res) => {
  try {
    const applications = await prisma.eventApplication.findMany({
      where: { applicantUserId: req.user.id }, include: { event: true, business: true }, orderBy: { updatedAt: 'desc' },
    });
    res.json(applications);
  } catch (error) {
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
      await notifyUser(prisma, event.organizerUserId, 'Nueva postulación para revisar', `${business.name} se postuló a ${event.name}.`);
    }
    res.status(existing ? 200 : 201).json({ message: send ? 'Postulación enviada.' : 'Borrador guardado.', application });
  } catch (error) {
    res.status(500).json({ message: error.message || 'No se pudo guardar la postulación.' });
  }
};

export const adminListApplications = async (_req, res) => {
  try {
    const applications = await prisma.eventApplication.findMany({
      where: { status: { in: ['ENVIADA', 'EN_REVISION', 'APROBADA', 'NO_SELECCIONADA'] } },
      include: { event: true, business: true, applicant: { select: { id: true, name: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'No se pudieron cargar las postulaciones recibidas.' });
  }
};

export const setApplicationStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!APPLICATION_STATUSES.includes(status)) return res.status(400).json({ message: 'Elegí un estado de revisión válido.' });
    const current = await prisma.eventApplication.findUnique({ where: { id }, include: { event: true, business: true } });
    if (!current) return res.status(404).json({ message: 'Postulación no encontrada.' });
    if (current.applicantUserId === req.user.id) return res.status(403).json({ message: 'No podés revisar ni aprobar tu propia postulación.' });
    if (!['ENVIADA', 'EN_REVISION', 'APROBADA'].includes(current.status)) return res.status(400).json({ message: 'Esta postulación no está disponible para revisión.' });
    if (status === 'APROBADA' && current.event.capacity !== null) {
      const acceptedCount = await prisma.eventApplication.count({ where: { eventId: current.eventId, status: 'APROBADA', id: { not: id } } });
      if (acceptedCount >= current.event.capacity) return res.status(409).json({ message: 'Ya se asignaron todos los puestos disponibles.' });
    }
    const application = await prisma.eventApplication.update({ where: { id }, data: { status }, include: { event: true, business: true } });
    await notifyUser(prisma, current.applicantUserId, 'Cambió el estado de tu postulación', `${current.event.name}: ${statusLabel(status)}.`);
    res.json({ message: `Postulación marcada como ${statusLabel(status).toLowerCase()}.`, application });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo actualizar el estado de la postulación.' });
  }
};

const statusLabel = (status) => ({
  BORRADOR: 'Borrador', ENVIADA: 'Enviada', EN_REVISION: 'En revisión', APROBADA: 'Aprobada',
  NO_SELECCIONADA: 'No seleccionada', CANCELADA: 'Cancelada',
}[status] || status);

export const getEventActivity = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const business = await prisma.businessProfile.findUnique({ where: { ownerUserId: req.user.id } });
    const isAdmin = req.user.role === 'ADMINISTRADOR';
    const approved = business && await prisma.eventApplication.findFirst({ where: { eventId, businessId: business.id, status: 'APROBADA' } });
    if (!isAdmin && !approved) return res.status(403).json({ message: 'La actividad del evento está disponible para negocios con participación aprobada.' });
    const scope = isAdmin ? { eventId } : { eventId, businessId: business.id };
    const [sales, expenses] = await Promise.all([
      prisma.sale.findMany({ where: { ...scope, status: 'COMPLETADA' }, include: { details: { include: { product: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } }),
      prisma.cashMovement.findMany({ where: { ...scope, type: 'EGRESO', category: { not: 'CANCELACION_VENTA_EVENTO' } }, orderBy: { createdAt: 'desc' } }),
    ]);
    const salesTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const expensesTotal = expenses.reduce((sum, movement) => sum + Number(movement.amount), 0);
    res.json({ sales, expenses, summary: { salesTotal, expensesTotal, difference: salesTotal - expensesTotal } });
  } catch (error) {
    res.status(500).json({ message: 'No se pudo cargar la actividad del evento.' });
  }
};
