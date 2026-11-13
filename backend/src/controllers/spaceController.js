import prisma from '../config/db.js';
import {
  LOCALITIES, PUBLIC_SPACE_TENURES, REQUIRED_DOCUMENT_BY_TENURE, SPACE_DOCUMENT_KINDS, SPACE_TENURES, SPACE_TYPES,
  createNotification, formatCuit, isValidCuit, isValidPhone, links, parseCoordinates,
} from '../config/marketplace.js';
import { UploadError, publicFileUrl, storeUpload, uploadPublicSelect } from '../config/uploads.js';

const MAX_SPACES_PER_OWNER = 10;
const MAX_DOCUMENTS_PER_SPACE = 8;
// Cambiar cualquiera de estos campos en un espacio verificado obliga a verificarlo de nuevo.
const LEGAL_FIELDS = ['name', 'type', 'locality', 'address', 'latitude', 'longitude', 'holderName', 'holderTaxId', 'tenure'];

const documentInclude = { documents: { include: { upload: { select: uploadPublicSelect } }, orderBy: { createdAt: 'asc' } } };
const spaceInclude = {
  ...documentInclude,
  cover: { select: { key: true, isPublic: true } },
  _count: { select: { events: true } },
};

const missingRequiredDocuments = (space) => {
  const required = REQUIRED_DOCUMENT_BY_TENURE[space.tenure] || [];
  const present = new Set(space.documents.map((doc) => doc.kind));
  return required.filter((kind) => !present.has(kind));
};

const withChecks = ({ cover, ...space }) => ({ ...space, coverUrl: publicFileUrl(cover), missingDocuments: missingRequiredDocuments(space) });

const spaceDataFromBody = (body) => {
  const name = body.name?.trim();
  const address = body.address?.trim();
  const holderName = body.holderName?.trim();
  const contactPhone = body.contactPhone?.trim();
  if (!name || !address || !holderName || !contactPhone) {
    throw new Error('Completá nombre del espacio, dirección, titular y teléfono de contacto.');
  }
  if (!SPACE_TYPES.includes(body.type)) throw new Error('Elegí el tipo de espacio.');
  if (!SPACE_TENURES.includes(body.tenure)) throw new Error('Indicá con qué derecho disponés del espacio.');
  if (!LOCALITIES.includes(body.locality)) throw new Error('Elegí una localidad disponible.');
  if (body.type === 'ESPACIO_PUBLICO' && !PUBLIC_SPACE_TENURES.includes(body.tenure)) {
    throw new Error('Un espacio público (plaza, parque, vereda) solo puede proponerse con permiso municipal o concesión vigente.');
  }
  if (!isValidCuit(body.holderTaxId)) throw new Error('El CUIT/CUIL del titular no es válido. Revisá los 11 dígitos.');
  if (!isValidPhone(contactPhone)) throw new Error('Revisá el teléfono de contacto; ingresá entre 7 y 15 dígitos.');
  const capacity = body.capacity === '' || body.capacity === null || body.capacity === undefined ? null : Number(body.capacity);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000)) {
    throw new Error('La capacidad de puestos debe ser un número entero entre 1 y 5000.');
  }
  return {
    name: name.slice(0, 160),
    type: body.type,
    description: body.description?.trim().slice(0, 2000) || null,
    locality: body.locality,
    address: address.slice(0, 200),
    ...parseCoordinates(body.latitude, body.longitude, { required: true }),
    capacity,
    holderName: holderName.slice(0, 160),
    holderTaxId: formatCuit(body.holderTaxId),
    tenure: body.tenure,
    contactPhone: contactPhone.slice(0, 40),
  };
};

const loadOwnSpace = async (id, userId) => {
  const space = await prisma.space.findUnique({ where: { id }, include: spaceInclude });
  return space && space.ownerUserId === userId ? space : null;
};

export const listMySpaces = async (req, res) => {
  try {
    const spaces = await prisma.space.findMany({ where: { ownerUserId: req.user.id }, include: spaceInclude, orderBy: { createdAt: 'desc' } });
    res.json(spaces.map(withChecks));
  } catch {
    res.status(500).json({ message: 'No se pudieron cargar tus espacios.' });
  }
};

export const createSpace = async (req, res) => {
  try {
    if (req.body.declarationAccepted !== true) {
      return res.status(400).json({ message: 'Tenés que aceptar la declaración jurada sobre el derecho a usar el espacio.' });
    }
    const count = await prisma.space.count({ where: { ownerUserId: req.user.id } });
    if (count >= MAX_SPACES_PER_OWNER) return res.status(400).json({ message: `Podés registrar hasta ${MAX_SPACES_PER_OWNER} espacios.` });
    const data = spaceDataFromBody(req.body);
    const space = await prisma.space.create({
      data: { ...data, ownerUserId: req.user.id, status: 'PENDIENTE', declarationAcceptedAt: new Date(), declarationIp: req.ip?.slice(0, 64) || null },
      include: spaceInclude,
    });
    res.status(201).json({ message: 'Espacio registrado. Subí la documentación para que podamos verificarlo.', space: withChecks(space) });
  } catch (error) {
    res.status(400).json({ message: error.message || 'No se pudo registrar el espacio.' });
  }
};

export const updateSpace = async (req, res) => {
  try {
    const current = await loadOwnSpace(Number(req.params.id), req.user.id);
    if (!current) return res.status(404).json({ message: 'Espacio no encontrado.' });
    if (current.status === 'SUSPENDIDO') return res.status(403).json({ message: 'El espacio está suspendido. Contactá a la administración.' });
    const data = spaceDataFromBody({ ...current, ...req.body });
    const legalChange = LEGAL_FIELDS.some((field) => String(data[field] ?? '') !== String(current[field] ?? ''));
    const needsReview = current.status === 'RECHAZADO' || (current.status === 'VERIFICADO' && legalChange);
    if (needsReview && req.body.declarationAccepted !== true) {
      return res.status(400).json({ message: 'Para enviar los cambios a revisión tenés que aceptar nuevamente la declaración jurada.' });
    }
    const space = await prisma.space.update({
      where: { id: current.id },
      data: {
        ...data,
        ...(needsReview ? {
          status: 'PENDIENTE', reviewNotes: null, reviewedAt: null, reviewedByUserId: null,
          declarationAcceptedAt: new Date(), declarationIp: req.ip?.slice(0, 64) || null,
        } : {}),
      },
      include: spaceInclude,
    });
    res.json({
      message: needsReview ? 'Cambios guardados. El espacio vuelve a revisión antes de poder publicar.' : 'Espacio actualizado.',
      space: withChecks(space),
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'No se pudo actualizar el espacio.' });
  }
};

export const uploadSpaceDocument = async (req, res) => {
  try {
    const space = await loadOwnSpace(Number(req.params.id), req.user.id);
    if (!space) return res.status(404).json({ message: 'Espacio no encontrado.' });
    if (space.status === 'SUSPENDIDO') return res.status(403).json({ message: 'El espacio está suspendido.' });
    const kind = req.body?.kind;
    if (!SPACE_DOCUMENT_KINDS.includes(kind)) return res.status(400).json({ message: 'Indicá qué tipo de documento estás subiendo.' });
    if (space.documents.length >= MAX_DOCUMENTS_PER_SPACE) return res.status(400).json({ message: `Cada espacio admite hasta ${MAX_DOCUMENTS_PER_SPACE} documentos.` });

    await prisma.$transaction(async (tx) => {
      const upload = await storeUpload({ file: req.file, ownerUserId: req.user.id, purpose: 'SPACE_DOCUMENT', kind: 'document' }, tx);
      await tx.spaceDocument.create({ data: { spaceId: space.id, uploadId: upload.id, kind } });
      // Agregar documentación a un espacio ya verificado lo devuelve a revisión.
      if (space.status === 'VERIFICADO' || space.status === 'RECHAZADO') {
        await tx.space.update({ where: { id: space.id }, data: { status: 'PENDIENTE', reviewedAt: null, reviewedByUserId: null } });
      }
    });
    const updated = await prisma.space.findUnique({ where: { id: space.id }, include: spaceInclude });
    // Con la documentación obligatoria completa, se avisa a la administración para que lo revise.
    if (updated.status === 'PENDIENTE' && !missingRequiredDocuments(updated).length) {
      const admins = await prisma.user.findMany({ where: { role: 'ADMINISTRADOR', status: true }, select: { id: true } });
      await prisma.notification.createMany({
        data: admins.map((admin) => ({ userId: admin.id, type: 'ESPACIO', title: 'Espacio para verificar', description: `${updated.name} (${updated.locality}) tiene la documentación completa.`, link: links.verify() })),
      });
    }
    res.status(201).json({ message: 'Documento subido.', space: withChecks(updated) });
  } catch (error) {
    if (error instanceof UploadError) return res.status(400).json({ message: error.message });
    res.status(500).json({ message: 'No se pudo subir el documento.' });
  }
};

export const deleteSpaceDocument = async (req, res) => {
  try {
    const space = await loadOwnSpace(Number(req.params.id), req.user.id);
    if (!space) return res.status(404).json({ message: 'Espacio no encontrado.' });
    if (space.status === 'VERIFICADO') {
      return res.status(400).json({ message: 'No se puede quitar documentación de un espacio verificado. Subí la nueva y quedará en revisión.' });
    }
    const document = space.documents.find((doc) => doc.id === Number(req.params.documentId));
    if (!document) return res.status(404).json({ message: 'Documento no encontrado.' });
    await prisma.upload.delete({ where: { id: document.uploadId } });
    const updated = await prisma.space.findUnique({ where: { id: space.id }, include: spaceInclude });
    res.json({ message: 'Documento eliminado.', space: withChecks(updated) });
  } catch {
    res.status(500).json({ message: 'No se pudo eliminar el documento.' });
  }
};

// ---- Administración de la plataforma ----

export const adminListSpaces = async (req, res) => {
  try {
    const status = ['PENDIENTE', 'VERIFICADO', 'RECHAZADO', 'SUSPENDIDO'].includes(req.query.status) ? req.query.status : undefined;
    const spaces = await prisma.space.findMany({
      where: status ? { status } : {},
      include: { ...spaceInclude, owner: { select: { id: true, name: true, lastName: true, email: true, createdAt: true } }, reviewedBy: { select: { name: true, lastName: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'asc' }],
    });
    res.json(spaces.map(withChecks));
  } catch {
    res.status(500).json({ message: 'No se pudieron cargar los espacios.' });
  }
};

const REVIEW_LABEL = { VERIFICADO: 'verificado', RECHAZADO: 'rechazado', SUSPENDIDO: 'suspendido' };

export const reviewSpace = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const notes = req.body.notes?.trim().slice(0, 2000) || null;
    if (!REVIEW_LABEL[status]) return res.status(400).json({ message: 'Elegí verificar, rechazar o suspender.' });
    if (status !== 'VERIFICADO' && !notes) return res.status(400).json({ message: 'Explicá el motivo para que el organizador pueda corregirlo.' });
    const space = await prisma.space.findUnique({ where: { id }, include: spaceInclude });
    if (!space) return res.status(404).json({ message: 'Espacio no encontrado.' });
    if (space.ownerUserId === req.user.id) return res.status(403).json({ message: 'No podés verificar un espacio propio.' });
    if (status === 'VERIFICADO') {
      const missing = missingRequiredDocuments(space);
      if (missing.length) return res.status(400).json({ message: `Falta la documentación obligatoria: ${missing.join(', ')}.` });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.space.update({
        where: { id },
        data: { status, reviewNotes: notes, reviewedAt: new Date(), reviewedByUserId: req.user.id },
        include: spaceInclude,
      });
      // Si se suspende, las convocatorias publicadas del espacio dejan de recibir postulaciones.
      if (status === 'SUSPENDIDO') {
        await tx.marketEvent.updateMany({ where: { spaceId: id, status: 'PUBLICADA' }, data: { status: 'CERRADA' } });
      }
      await createNotification(tx, space.ownerUserId, `Tu espacio fue ${REVIEW_LABEL[status]}`,
        `${space.name}${notes ? `: ${notes}` : '. Ya podés publicar convocatorias en este espacio.'}`, 'ESPACIO', links.spaces());
      return result;
    });
    res.json({ message: `Espacio ${REVIEW_LABEL[status]}.`, space: withChecks(updated) });
  } catch {
    res.status(500).json({ message: 'No se pudo registrar la revisión.' });
  }
};

/** Foto de portada del espacio (pública). No afecta la verificación. */
export const uploadSpaceCover = async (req, res) => {
  try {
    const space = await loadOwnSpace(Number(req.params.id), req.user.id);
    if (!space) return res.status(404).json({ message: 'Espacio no encontrado.' });
    const updated = await prisma.$transaction(async (tx) => {
      const upload = await storeUpload({ file: req.file, ownerUserId: req.user.id, purpose: 'SPACE_PHOTO', kind: 'image' }, tx);
      const result = await tx.space.update({ where: { id: space.id }, data: { coverUploadId: upload.id }, include: spaceInclude });
      if (space.coverUploadId) await tx.upload.delete({ where: { id: space.coverUploadId } });
      return result;
    });
    res.json({ message: 'Foto del espacio actualizada.', space: withChecks(updated) });
  } catch (error) {
    if (error instanceof UploadError) return res.status(400).json({ message: error.message });
    res.status(500).json({ message: 'No se pudo subir la foto.' });
  }
};
