export const LOCALITIES = ['Banda del Río Salí', 'Cruz Alta', 'Alderetes'];

export const SPACE_TYPES = ['GALERIA', 'LOCAL_COMERCIAL', 'CENTRO_CULTURAL', 'SALON_EVENTOS', 'PREDIO_PRIVADO', 'ESPACIO_PUBLICO', 'OTRO'];
export const SPACE_TENURES = ['PROPIETARIO', 'LOCATARIO', 'PERMISO_MUNICIPAL', 'CONCESION', 'AUTORIZACION_TITULAR'];
export const SPACE_DOCUMENT_KINDS = ['TITULO_PROPIEDAD', 'CONTRATO_ALQUILER', 'PERMISO_MUNICIPAL', 'HABILITACION_COMERCIAL', 'CONSTANCIA_CUIT', 'AUTORIZACION_TITULAR', 'OTRO'];

// Documento que acredita el derecho a usar el espacio, según cómo lo dispone el organizador.
export const REQUIRED_DOCUMENT_BY_TENURE = {
  PROPIETARIO: ['TITULO_PROPIEDAD'],
  LOCATARIO: ['CONTRATO_ALQUILER'],
  PERMISO_MUNICIPAL: ['PERMISO_MUNICIPAL'],
  CONCESION: ['PERMISO_MUNICIPAL'],
  AUTORIZACION_TITULAR: ['AUTORIZACION_TITULAR'],
};

// Un espacio público (plaza, parque, vereda) nunca es "propio": solo con permiso o concesión.
export const PUBLIC_SPACE_TENURES = ['PERMISO_MUNICIPAL', 'CONCESION'];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidPhone = (value) => /^[+()\d\s.-]{7,40}$/.test(value)
  && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15;

/** Valida CUIT/CUIL argentino (11 dígitos con dígito verificador módulo 11). */
export const isValidCuit = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(digits) || !['20', '23', '24', '27', '30', '33', '34'].includes(digits.slice(0, 2))) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, weight, index) => acc + weight * Number(digits[index]), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === Number(digits[10]);
};

export const formatCuit = (value) => {
  const digits = String(value).replace(/\D/g, '');
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
};

export const parseCoordinates = (latitude, longitude, { required = false } = {}) => {
  const emptyLat = latitude === '' || latitude === null || latitude === undefined;
  const emptyLng = longitude === '' || longitude === null || longitude === undefined;
  if (emptyLat && emptyLng) {
    if (required) throw new Error('Marcá la ubicación del espacio en el mapa.');
    return { latitude: null, longitude: null };
  }
  if (emptyLat || emptyLng) throw new Error('Ingresá latitud y longitud juntas, o dejá ambas vacías.');
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Las coordenadas no son válidas. Latitud: −90 a 90; longitud: −180 a 180.');
  }
  return { latitude: lat, longitude: lng };
};

export const createNotification = async (tx, userId, title, description, type = 'CONVOCATORIA', link = null) => {
  const profile = await tx.businessProfile.findUnique({ where: { ownerUserId: userId }, select: { notificationsEnabled: true } });
  if (profile?.notificationsEnabled === false) return;
  await tx.notification.create({ data: { userId, type, title, description, read: false, link } });
};

// Destinos de los avisos. `mensajes` abre directamente la conversación.
export const links = {
  myApplication: (id, chat = false) => `/postulaciones?postulacion=${id}${chat ? '&mensajes=1' : ''}`,
  receivedApplication: (id, chat = false) => `/gestion?postulacion=${id}${chat ? '&mensajes=1' : ''}`,
  event: (id) => `/convocatorias/${id}`,
  spaces: () => '/espacios',
  verify: () => '/verificar',
  backoffice: (tab) => `#tab:${tab}`,
};
