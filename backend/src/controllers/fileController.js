import prisma from '../config/db.js';

const sendFile = (res, file, { cache, disposition }) => {
  res.set({
    'Content-Type': file.mimeType,
    'Content-Length': String(file.size),
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `${disposition}; filename="${encodeURIComponent(file.originalName)}"`,
    'Cache-Control': cache,
    // El archivo nunca se ejecuta como página aunque se abra directo.
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  res.end(Buffer.from(file.data));
};

/** Fotos públicas (negocio, productos). La clave es aleatoria e imposible de adivinar. */
export const getPublicFile = async (req, res) => {
  try {
    const key = String(req.params.key || '');
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(key)) return res.status(404).end();
    const file = await prisma.upload.findUnique({ where: { key } });
    if (!file || !file.isPublic) return res.status(404).end();
    sendFile(res, file, { cache: 'public, max-age=86400, immutable', disposition: 'inline' });
  } catch {
    res.status(500).end();
  }
};

/** Documentos privados: solo el dueño o la administración de la plataforma. */
export const getPrivateFile = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({ message: 'Archivo no encontrado.' });
    const file = await prisma.upload.findUnique({ where: { id } });
    let allowed = file && (file.ownerUserId === req.user.id || req.user.role === 'ADMINISTRADOR');
    if (file && !allowed && file.purpose === 'PAYMENT_RECEIPT') {
      allowed = Boolean(await prisma.eventApplication.findFirst({ where: { paymentReceiptUploadId: file.id, event: { organizerUserId: req.user.id } }, select: { id: true } }));
    }
    if (!allowed) return res.status(404).json({ message: 'Archivo no encontrado.' });
    sendFile(res, file, { cache: 'private, no-store', disposition: 'attachment' });
  } catch {
    res.status(500).json({ message: 'No se pudo descargar el archivo.' });
  }
};
