import crypto from 'crypto';
import multer from 'multer';
import prisma from './db.js';

export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

// Se identifica el tipo por los primeros bytes del archivo (firma), nunca por la extensión
// ni por el Content-Type que manda el navegador. SVG queda excluido a propósito (puede llevar scripts).
const SIGNATURES = [
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.subarray(0, 5).toString('ascii') === '%PDF-' },
];

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];

export const detectFileType = (buffer) => SIGNATURES.find((signature) => buffer.length >= 12 && signature.test(buffer)) || null;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1, fields: 10, fieldSize: 10 * 1024 },
});

/** Middleware que acepta un único archivo en el campo "file" y traduce los errores de multer. */
export const singleFile = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'El archivo supera el tamaño máximo permitido (5 MB).' });
    return res.status(400).json({ message: 'No se pudo leer el archivo enviado.' });
  });
};

export class UploadError extends Error {}

const cleanName = (name) => String(name || 'archivo').normalize('NFKC').replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 120) || 'archivo';

/**
 * Valida y guarda un archivo. `kind` = 'image' (fotos públicas) o 'document' (documentación privada).
 * Devuelve el registro sin el contenido binario.
 */
export const storeUpload = async ({ file, ownerUserId, purpose, kind }, tx = prisma) => {
  if (!file?.buffer?.length) throw new UploadError('Elegí un archivo para subir.');
  const detected = detectFileType(file.buffer);
  const allowed = kind === 'image' ? IMAGE_TYPES : DOCUMENT_TYPES;
  if (!detected || !allowed.includes(detected.mime)) {
    throw new UploadError(kind === 'image' ? 'La imagen debe ser JPG, PNG o WEBP.' : 'El documento debe ser PDF, JPG, PNG o WEBP.');
  }
  const maxBytes = kind === 'image' ? IMAGE_MAX_BYTES : DOCUMENT_MAX_BYTES;
  if (file.buffer.length > maxBytes) throw new UploadError(`El archivo supera el máximo de ${maxBytes / 1024 / 1024} MB.`);

  return tx.upload.create({
    data: {
      key: crypto.randomBytes(24).toString('base64url'),
      ownerUserId,
      purpose,
      isPublic: kind === 'image',
      mimeType: detected.mime,
      size: file.buffer.length,
      sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
      originalName: cleanName(file.originalname),
      data: file.buffer,
    },
    select: uploadPublicSelect,
  });
};

export const uploadPublicSelect = {
  id: true, key: true, purpose: true, isPublic: true, mimeType: true, size: true, originalName: true, createdAt: true,
};

/** URL relativa para mostrar una imagen pública en el navegador. */
export const publicFileUrl = (upload) => (upload?.isPublic ? `/api/files/public/${upload.key}` : null);
