// Datos de prueba completos del portal Emprende (zona: Banda del Río Salí, Cruz Alta y Alderetes, Tucumán).
// Crea administración, organizadores con espacios en todos los estados, convocatorias abiertas/cerradas/borrador,
// emprendimientos con fotos, productos, pedidos de las últimas 8 semanas, postulaciones y avisos.
//
// Uso:  npm run seed:emprende            (base local)
// Todo lo que crea usa correos @emprende.test; al volver a correrlo se borra y se recrea solo eso.
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { detectFileType } from '../config/uploads.js';
import { DEFAULT_TEMPLATES, renderTemplate } from '../config/participation.js';

const prisma = new PrismaClient();
const DOMAIN = '@emprende.test';
const PASSWORD = process.env.SEED_PASSWORD || 'Emprende2026';

// ---------- Seguridad: nunca contra producción por accidente ----------
function assertSafe() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL.');
  const host = new URL(url).hostname.toLowerCase();
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  if (!local && process.env.SEED_CONFIRM !== 'emprende') {
    throw new Error('Seed cancelado: la base no es local. Para cargar datos de prueba en otra base, definí SEED_CONFIRM=emprende.');
  }
  if (PASSWORD.length < 8) throw new Error('SEED_PASSWORD debe tener al menos 8 caracteres.');
}

// ---------- Utilidades ----------
let seed = 20261112;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (list) => list[Math.floor(rand() * list.length)];
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const daysFromNow = (days, hour = 10, minute = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, minute, 0, 0); return d; };

const cuit = (prefix, body) => {
  const digits = `${prefix}${String(body).padStart(8, '0')}`;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let check = 11 - (weights.reduce((sum, w, i) => sum + w * Number(digits[i]), 0) % 11);
  if (check === 11) check = 0;
  if (check === 10) return cuit(prefix, body + 1);
  return `${prefix}-${String(body).padStart(8, '0')}-${check}`;
};

// PNG con degradé (imágenes de muestra para fotos y productos)
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function makePng(from, to, w = 360, h = 270) {
  const [r1, g1, b1] = hex(from); const [r2, g2, b2] = hex(to);
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x += 1) {
      const t = (x / w + y / h) / 2;
      const circle = ((x - w * 0.7) ** 2 + (y - h * 0.35) ** 2) < (h * 0.22) ** 2 ? 28 : 0;
      const i = y * (w * 3 + 1) + 1 + x * 3;
      raw[i] = Math.min(255, r1 + (r2 - r1) * t + circle); raw[i + 1] = Math.min(255, g1 + (g2 - g1) * t + circle); raw[i + 2] = Math.min(255, b1 + (b2 - b1) * t + circle);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// PDF mínimo válido con texto (documentación de muestra)
function makePdf(lines) {
  const esc = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[()\\]/g, '\\$&');
  const text = ['BT', '/F1 13 Tf', '60 780 Td', '18 TL', ...lines.map((line) => `(${esc(line)}) Tj T*`), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = objects.map((obj, i) => { const at = Buffer.byteLength(out); out += `${i + 1} 0 obj\n${obj}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// Imágenes reales opcionales: si existe backend/src/seed/images/<nombre>.(jpg|jpeg|png|webp) se usa esa;
// si no, se genera una imagen de muestra. Ver docs/imagenes-seed.md.
const IMAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'images');
let realImages = 0;
const imageOr = (name, fallback) => {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    const file = path.join(IMAGES_DIR, `${name}.${ext}`);
    if (!fs.existsSync(file)) continue;
    const buffer = fs.readFileSync(file);
    const type = detectFileType(buffer);
    if (type && type.mime.startsWith('image/') && buffer.length <= 3 * 1024 * 1024) { realImages += 1; return { buffer, mime: type.mime, name: `${name}.${type.ext}` }; }
    console.warn(`Imagen ignorada (formato o tamaño no válido, máx. 3 MB): ${file}`);
  }
  return { buffer: fallback(), mime: 'image/png', name: `${name}.png` };
};

const storeFile = (ownerUserId, purpose, buffer, mimeType, originalName) => prisma.upload.create({
  data: {
    key: crypto.randomBytes(24).toString('base64url'), ownerUserId, purpose, isPublic: purpose !== 'SPACE_DOCUMENT',
    mimeType, size: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), originalName, data: buffer,
  },
});

// ---------- Datos ----------
const ORGANIZERS = [
  { username: 'org_galeria', name: 'Lucía', lastName: 'Albornoz' },
  { username: 'org_club', name: 'Ramón', lastName: 'Villafañe' },
  { username: 'org_plaza', name: 'Comisión', lastName: 'Feria Cruz Alta' },
  { username: 'org_nuevo', name: 'Martín', lastName: 'Juárez' },
];

const SPACES = [
  {
    key: 'galeria', owner: 'org_galeria', name: 'Galería Paseo del Sol', type: 'GALERIA', locality: 'Banda del Río Salí',
    address: 'Av. del Libertador 540, Banda del Río Salí', latitude: -26.8441, longitude: -65.1702, capacity: 16,
    holderName: 'Lucía Albornoz', holder: ['27', 28456123], tenure: 'PROPIETARIO', status: 'VERIFICADO',
    description: 'Galería comercial techada con 16 espacios para puestos, baños y tomas de luz. Abre de martes a domingo.',
    docs: [['TITULO_PROPIEDAD', 'Escritura del inmueble'], ['HABILITACION_COMERCIAL', 'Habilitación comercial municipal']],
  },
  {
    key: 'local', owner: 'org_galeria', name: 'Local Esquina San Martín', type: 'LOCAL_COMERCIAL', locality: 'Banda del Río Salí',
    address: 'San Martín 1210, Banda del Río Salí', latitude: -26.8392, longitude: -65.1648, capacity: 6,
    holderName: 'Inmobiliaria Salí S.R.L.', holder: ['30', 71234560], tenure: 'LOCATARIO', status: 'PENDIENTE',
    description: 'Local a la calle para ferias pequeñas de fin de semana.',
    docs: [['CONTRATO_ALQUILER', 'Contrato de locación vigente']],
  },
  {
    key: 'club', owner: 'org_club', name: 'Salón del Club Social Alderetes', type: 'SALON_EVENTOS', locality: 'Alderetes',
    address: 'Av. Sarmiento 890, Alderetes', latitude: -26.8162, longitude: -65.1371, capacity: 24,
    holderName: 'Club Social y Deportivo Alderetes', holder: ['30', 70981234], tenure: 'AUTORIZACION_TITULAR', status: 'VERIFICADO',
    description: 'Salón cubierto de 400 m² con cocina, estacionamiento y escenario para peñas.',
    docs: [['AUTORIZACION_TITULAR', 'Acta de comisión directiva que autoriza el uso del salón'], ['CONSTANCIA_CUIT', 'Constancia de CUIT del club']],
  },
  {
    key: 'plaza', owner: 'org_plaza', name: 'Plaza central de Cruz Alta', type: 'ESPACIO_PUBLICO', locality: 'Cruz Alta',
    address: 'Plaza principal, frente a la delegación comunal', latitude: -26.8771, longitude: -65.1102, capacity: 30,
    holderName: 'Comisión Feria Cruz Alta', holder: ['30', 71555012], tenure: 'PERMISO_MUNICIPAL', status: 'VERIFICADO',
    description: 'Feria al aire libre con permiso municipal para el primer y tercer sábado de cada mes.',
    docs: [['PERMISO_MUNICIPAL', 'Resolución de permiso de uso del espacio público']],
  },
  {
    key: 'predio', owner: 'org_plaza', name: 'Predio sobre Ruta 9', type: 'PREDIO_PRIVADO', locality: 'Cruz Alta',
    address: 'Ruta Nacional 9 km 1295', latitude: -26.8935, longitude: -65.0954, capacity: 60,
    holderName: 'Comisión Feria Cruz Alta', holder: ['30', 71555012], tenure: 'PROPIETARIO', status: 'RECHAZADO',
    reviewNotes: 'La escritura está a nombre de otra persona. Subí una autorización firmada por el titular o un contrato a nombre de la comisión.',
    description: 'Predio abierto para ferias grandes.',
    docs: [['TITULO_PROPIEDAD', 'Escritura (titular distinto)']],
  },
];

const BUSINESSES = [
  {
    username: 'emp_empanadas', name: 'Rosa', lastName: 'Medina', business: 'Empanadas La Tucumanita', kind: 'ITINERANTE', category: 'Alimentos',
    locality: 'Banda del Río Salí', description: 'Empanadas tucumanas de carne cortada a cuchillo, al horno de barro. También humitas y tamales en temporada.',
    colors: ['#c8692f', '#f2b45a'], products: [['Empanada de carne', 1500, 120], ['Docena de empanadas', 16000, 15], ['Humita en chala', 3500, 30], ['Tamal', 3000, 25], ['Empanada de pollo', 1400, 80]],
  },
  {
    username: 'emp_ceramica', name: 'Julieta', lastName: 'Paz', business: 'Barro Vivo Cerámica', kind: 'FIJO', category: 'Artesanías',
    locality: 'Alderetes', description: 'Cerámica utilitaria hecha a mano: tazas, bowls y macetas esmaltadas con colores del monte tucumano.',
    colors: ['#7a5c4f', '#d9b8a0'], products: [['Taza esmaltada', 9500, 18], ['Bowl mediano', 12000, 10], ['Maceta colgante', 14500, 8], ['Set de 4 platos', 38000, 4]],
  },
  {
    username: 'emp_tejidos', name: 'Ana', lastName: 'Quiroga', business: 'Hilos del Salí', kind: 'ITINERANTE', category: 'Indumentaria',
    locality: 'Banda del Río Salí', description: 'Tejidos en telar y a dos agujas con lana de oveja: ponchos, gorros y bufandas.',
    colors: ['#3d5a80', '#98c1d9'], products: [['Gorro de lana', 11000, 20], ['Bufanda tejida', 15000, 14], ['Poncho de telar', 68000, 3], ['Medias de lana', 6500, 30]],
  },
  {
    username: 'emp_dulces', name: 'Mirta', lastName: 'Ledesma', business: 'Dulces de la Abuela Mirta', kind: 'FIJO', category: 'Dulces regionales',
    locality: 'Cruz Alta', description: 'Dulce de cayote, de membrillo y de leche caseros. Miel de la zona y alfajores de maicena.',
    colors: ['#8a3b5c', '#e7a3b7'], products: [['Dulce de cayote 500 g', 7000, 22], ['Dulce de leche 500 g', 6500, 30], ['Miel 1 kg', 12000, 12], ['Caja de 6 alfajores', 8000, 18]],
  },
  {
    username: 'emp_panificados', name: 'Diego', lastName: 'Correa', business: 'Panadería El Molino', kind: 'ITINERANTE', category: 'Panificados',
    locality: 'Alderetes', description: 'Pan casero, tortillas al rescoldo y facturas de grasa. Masa madre los fines de semana.',
    colors: ['#a0672e', '#f3d9a4'], products: [['Pan casero 1 kg', 4500, null], ['Tortilla al rescoldo', 1800, null], ['Docena de facturas', 9000, null], ['Pan de masa madre', 7500, 10]],
  },
  {
    username: 'emp_plantas', name: 'Tomás', lastName: 'Herrera', business: 'Verde Monte Vivero', kind: 'ITINERANTE', category: 'Plantas',
    locality: 'Cruz Alta', description: 'Plantas nativas, suculentas y aromáticas en macetas recicladas.',
    colors: ['#2f6b45', '#9fd3a8'], products: [['Suculenta en maceta', 4000, 40], ['Aromática (romero, menta)', 3500, 35], ['Lapacho joven', 15000, 6], ['Kit de huerta', 18000, 8]],
  },
];
const NEW_ENTREPRENEUR = { username: 'emp_nuevo', name: 'Sofía', lastName: 'Ruiz' };

const EVENTS = [
  { key: 'diseno', space: 'galeria', name: 'Feria de diseño y artesanía', start: 18, deadline: 8, hours: [10, 20], capacity: 12, fee: 8000, categories: 'Artesanías|Indumentaria|Plantas', status: 'PUBLICADA',
    description: 'Una jornada para conocer diseño y artesanía local en la galería. Música en vivo y patio gastronómico.', requirements: 'Mesa y mantel propios.\nProductos de elaboración propia.\nTraer cambio.' },
  { key: 'navidad', space: 'galeria', name: 'Mercado navideño', start: 38, deadline: 25, hours: [17, 23], capacity: 16, fee: 10000, categories: '', status: 'PUBLICADA',
    description: 'Mercado nocturno para regalos de fin de año. Tres noches consecutivas con decoración navideña.', requirements: 'Iluminación propia para el puesto.\nAsistir las tres noches.' },
  { key: 'gastro', space: 'club', name: 'Feria gastronómica del club', start: 12, deadline: 5, hours: [11, 22], capacity: 2, fee: 5000, categories: 'Alimentos|Panificados|Dulces regionales', status: 'PUBLICADA',
    approval: '¡Hola {nombre}! Bienvenido/a a la {feria} del {fecha}. Tu puesto es el {puesto} y el armado arranca a las {hora_armado}. El costo del puesto es {costo}: podés pagarlo desde Mis postulaciones. ¡Nos vemos en el club!',
    description: 'Feria de comidas regionales en el salón del club, con peña folclórica a la noche.', requirements: 'Carnet de manipulación de alimentos vigente.\nHeladera o conservadora propia.\nMonotributo al día.' },
  { key: 'plaza-mes', space: 'plaza', name: 'Feria de emprendedores de la plaza', start: 1, deadline: -2, hours: [9, 14], capacity: 30, fee: null, categories: '', status: 'PUBLICADA',
    description: 'La feria de todos los meses en la plaza central. Sin costo de puesto gracias al permiso municipal.', requirements: 'Gazebo o sombrilla propia.\nRetirar los residuos al finalizar.' },
  { key: 'invierno', space: 'club', name: 'Peña y feria de invierno', start: -20, deadline: -30, hours: [12, 23], capacity: 20, fee: 5000, categories: '', status: 'CERRADA',
    description: 'Edición de invierno con locro y peña.', requirements: 'Mesa propia.' },
  { key: 'madre', space: 'plaza', name: 'Feria del Día de la Madre', start: -27, deadline: -36, hours: [9, 15], capacity: 30, fee: null, categories: '', status: 'CERRADA',
    description: 'Feria especial con regalos para el Día de la Madre.', requirements: 'Gazebo propio.' },
  { key: 'verano', space: 'galeria', name: 'Feria de verano', start: 70, deadline: 55, hours: [18, 23], capacity: 12, fee: 8000, categories: '', status: 'BORRADOR',
    description: 'Borrador: feria nocturna de verano en la galería.', requirements: '' },
];

// [emprendedor, evento, estado, producto ofrecido, comentario, { puesto, armado, pago }]
const APPLICATIONS = [
  ['emp_ceramica', 'diseno', 'APROBADA', 'Tazas y bowls esmaltados', null, { stand: '4', setup: '09:00', payment: 'INFORMADO' }],
  ['emp_tejidos', 'diseno', 'EN_REVISION', 'Gorros, bufandas y ponchos', null],
  ['emp_plantas', 'diseno', 'ENVIADA', 'Suculentas y aromáticas', null],
  ['emp_tejidos', 'navidad', 'ENVIADA', 'Tejidos para regalar', null],
  ['emp_ceramica', 'navidad', 'BORRADOR', 'Adornos navideños de cerámica', null],
  ['emp_empanadas', 'gastro', 'APROBADA', 'Empanadas y humitas', null, { stand: '1', setup: '09:30', payment: 'PENDIENTE' }],
  ['emp_dulces', 'gastro', 'APROBADA', 'Dulces regionales y alfajores', null, { stand: '2', setup: '10:00', payment: 'CONFIRMADO' }],
  ['emp_panificados', 'gastro', 'LISTA_ESPERA', 'Pan casero y tortillas', null],
  ['emp_plantas', 'plaza-mes', 'APROBADA', 'Plantas nativas', null, { stand: 'Sector verde', setup: '08:00' }],
  ['emp_dulces', 'plaza-mes', 'APROBADA', 'Dulces y miel', null, { stand: '12', setup: '08:00' }],
  ['emp_empanadas', 'invierno', 'APROBADA', 'Empanadas y locro', null, { stand: '1', setup: '10:00', payment: 'CONFIRMADO_EFECTIVO' }],
  ['emp_panificados', 'invierno', 'APROBADA', 'Tortillas al rescoldo', null, { stand: '6', setup: '10:00', payment: 'CONFIRMADO_EFECTIVO' }],
  ['emp_tejidos', 'madre', 'APROBADA', 'Bufandas y gorros', null, { stand: '8', setup: '08:00' }],
  ['emp_dulces', 'madre', 'APROBADA', 'Cajas de dulces para regalo', null, { stand: '9', setup: '08:00' }],
  ['emp_ceramica', 'madre', 'NO_SELECCIONADA', 'Tazas personalizadas', 'Recibimos tu postulación fuera de horario. Probá en la próxima.'],
];

// Conversaciones de ejemplo: [emprendedor, evento, [quién, texto, ¿leído?]...]
const CONVERSATIONS = [
  ['emp_empanadas', 'gastro', [['emp', '¡Gracias Ramón! ¿Hay toma de luz cerca del puesto 1? Llevo una freidora chica.', true], ['org', 'Sí, tenés una toma a dos metros. Traé un alargue de 5 m por las dudas.', true], ['emp', 'Perfecto. ¿El pago del puesto lo hago por acá o en el club?', false]]],
  ['emp_ceramica', 'diseno', [['emp', 'Hola Lucía, ya hice la transferencia del puesto. Te dejé el comprobante.', true], ['org', 'Genial, lo reviso hoy. ¿Necesitás mesa o traés la tuya?', true], ['emp', 'Traigo la mía, gracias.', false]]],
  ['emp_plantas', 'plaza-mes', [['org', 'Mañana el armado es desde las 8. Si llueve, la feria pasa al salón de la delegación.', false]]],
  ['emp_tejidos', 'diseno', [['emp', 'Hola, ¿se puede colgar ropa en percheros o solo mesa?', true], ['org', 'Podés llevar un perchero chico. Estoy revisando las postulaciones y te confirmo esta semana.', false]]],
];

// Calificaciones de ferias pasadas: [emprendedor, evento, estrellas a la organización, comentario, estrellas al emprendedor, comentario]
const REVIEWS = [
  ['emp_empanadas', 'invierno', 5, 'Muy bien organizado, mucha gente y buena música.', 5, 'Puntual y con el puesto impecable. ¡Se agotó todo!'],
  ['emp_panificados', 'invierno', 4, 'Buena feria. Faltó señalizar mejor la entrada.', 5, 'Excelente predisposición.'],
  ['emp_tejidos', 'madre', 5, 'La plaza estuvo llena, volvería sin dudar.', 4, 'Muy lindo puesto, llegó un poco tarde al armado.'],
  ['emp_dulces', 'madre', 4, 'Buena convocatoria, el sol pegaba fuerte al mediodía.', 5, 'Siempre cumple, muy recomendable.'],
];

// Planos de puestos (las coordenadas son columna, fila)
const PLANS = {
  diseno: {
    cols: 8, rows: 5,
    stands: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [0, 2], [1, 2], [2, 2], [5, 2], [6, 2], [7, 2]].map(([x, y], i) => ({ label: String(i + 1), x, y })),
    marks: [{ type: 'ENTRADA', x: 3, y: 4 }, { type: 'ENTRADA', x: 4, y: 4 }, { type: 'BANO', x: 7, y: 0 }, { type: 'ESCENARIO', x: 3, y: 2 }, { type: 'ESCENARIO', x: 4, y: 2 }],
  },
  gastro: {
    cols: 6, rows: 4,
    stands: [{ label: '1', x: 1, y: 1 }, { label: '2', x: 4, y: 1 }],
    marks: [{ type: 'COCINA', x: 0, y: 0 }, { type: 'COCINA', x: 1, y: 0 }, { type: 'ESCENARIO', x: 4, y: 0 }, { type: 'ESCENARIO', x: 5, y: 0 }, { type: 'ENTRADA', x: 2, y: 3 }, { type: 'ENTRADA', x: 3, y: 3 }, { type: 'BANO', x: 5, y: 3 }],
  },
};

const CUSTOMERS = ['María G.', 'Lucas P.', 'Carla R.', 'Jorge T.', 'Valeria S.', 'Nicolás A.', 'Florencia D.', 'Gustavo M.', 'Paula C.', 'Ramiro L.', 'Consumidor final'];
const CHANNELS = ['PRESENCIAL', 'PRESENCIAL', 'WHATSAPP', 'WHATSAPP', 'REDES', 'OTRO'];

// ---------- Limpieza ----------
async function clean() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (!ids.length) return 0;
  await prisma.marketEvent.deleteMany({ where: { organizerUserId: { in: ids } } });
  await prisma.space.deleteMany({ where: { ownerUserId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

async function main() {
  assertSafe();
  const removed = await clean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const createUser = (u, role) => prisma.user.create({
    data: { name: u.name, lastName: u.lastName, username: u.username, email: `${u.username.replace(/_/g, '.')}${DOMAIN}`, password: passwordHash, role, onboardingCompleted: true },
  });

  const admin = await createUser({ username: 'admin_emprende', name: 'Administración', lastName: 'Emprende' }, 'ADMINISTRADOR');
  const users = {};
  for (const u of ORGANIZERS) users[u.username] = await createUser(u, 'ORGANIZADOR');
  for (const b of BUSINESSES) users[b.username] = await createUser(b, 'EMPRENDEDOR');
  users[NEW_ENTREPRENEUR.username] = await createUser(NEW_ENTREPRENEUR, 'EMPRENDEDOR');

  // Espacios y documentación
  const spaces = {};
  for (const s of SPACES) {
    const owner = users[s.owner];
    const created = await prisma.space.create({
      data: {
        ownerUserId: owner.id, name: s.name, type: s.type, description: s.description, locality: s.locality, address: s.address,
        latitude: s.latitude, longitude: s.longitude, capacity: s.capacity, holderName: s.holderName, holderTaxId: cuit(...s.holder),
        tenure: s.tenure, contactPhone: `381 ${int(400, 699)} ${int(1000, 9999)}`, declarationAcceptedAt: daysFromNow(-40), declarationIp: '127.0.0.1',
        status: s.status, reviewNotes: s.reviewNotes || null,
        ...(s.status === 'PENDIENTE' ? {} : { reviewedAt: daysFromNow(-35), reviewedByUserId: admin.id }),
      },
    });
    for (const [kind, title] of s.docs) {
      const pdf = makePdf(['DOCUMENTO DE PRUEBA - EMPRENDE', '', title, `Espacio: ${s.name}`, `Titular: ${s.holderName}`, `Direccion: ${s.address}`, '', 'Archivo generado para pruebas. Sin validez legal.']);
      const upload = await storeFile(owner.id, 'SPACE_DOCUMENT', pdf, 'application/pdf', `${title.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-')}.pdf`);
      await prisma.spaceDocument.create({ data: { spaceId: created.id, uploadId: upload.id, kind } });
    }
    const cover = imageOr(`space-${s.key}`, () => makePng('#0b6f74', '#9fd8d6', 640, 360));
    const coverUpload = await storeFile(owner.id, 'SPACE_PHOTO', cover.buffer, cover.mime, cover.name);
    spaces[s.key] = await prisma.space.update({ where: { id: created.id }, data: { coverUploadId: coverUpload.id } });
  }

  // Convocatorias
  const events = {};
  for (const e of EVENTS) {
    const space = spaces[e.space];
    events[e.key] = await prisma.marketEvent.create({
      data: {
        organizerUserId: space.ownerUserId, spaceId: space.id, name: e.name, locality: space.locality, address: space.address,
        latitude: space.latitude, longitude: space.longitude, startsAt: daysFromNow(e.start, e.hours[0]), endsAt: daysFromNow(e.start, e.hours[1]),
        applicationDeadline: daysFromNow(e.deadline, 23, 59), description: e.description, acceptedCategories: e.categories || null,
        requirements: e.requirements || null, capacity: e.capacity, standFee: e.fee, status: e.status,
        approvalMessage: e.approval || null,
      },
    });
  }

  // Emprendimientos: perfil, fotos, productos y pedidos
  const businesses = {};
  for (const b of BUSINESSES) {
    const owner = users[b.username];
    const profile = await prisma.businessProfile.create({
      data: {
        ownerUserId: owner.id, name: b.business, kind: b.kind, category: b.category, description: b.description, locality: b.locality,
        address: b.kind === 'FIJO' ? `Calle ${pick(['Belgrano', 'Rivadavia', '9 de Julio', 'Mitre'])} ${int(100, 1500)}, ${b.locality}` : null,
        contactPhone: `381 ${int(400, 699)} ${int(1000, 9999)}`, contactEmail: owner.email, notificationsEnabled: true,
      },
    });
    businesses[b.username] = profile;
    for (let i = 0; i < 3; i += 1) {
      const image = imageOr(`business-${b.username}-${i + 1}`, () => makePng(b.colors[i % 2], b.colors[(i + 1) % 2]));
      const photo = await storeFile(owner.id, 'BUSINESS_PHOTO', image.buffer, image.mime, image.name);
      await prisma.businessPhoto.create({ data: { businessId: profile.id, uploadId: photo.id, position: i } });
    }
    const products = [];
    for (const [index, [name, price, stock]] of b.products.entries()) {
      const image = imageOr(`product-${b.username}-${index + 1}`, () => makePng(b.colors[1], b.colors[0], 320, 240));
      const photo = await storeFile(owner.id, 'PRODUCT_PHOTO', image.buffer, image.mime, image.name);
      products.push(await prisma.businessProduct.create({
        data: { businessId: profile.id, name, price, stock, photoUploadId: photo.id, active: !(b.username === 'emp_ceramica' && index === b.products.length - 1), description: null },
      }));
    }

    // Pedidos de las últimas 8 semanas (más ventas en las semanas recientes)
    const orderCount = int(22, 34);
    for (let n = 0; n < orderCount; n += 1) {
      const ago = Math.floor(rand() ** 1.4 * 56);
      const createdAt = daysFromNow(-ago, int(9, 20), int(0, 59));
      const roll = rand();
      const status = ago < 3 && roll < 0.5 ? pick(['PENDIENTE', 'CONFIRMADO']) : roll < 0.08 ? 'CANCELADO' : 'ENTREGADO';
      const lines = Array.from({ length: int(1, 3) }, () => pick(products)).filter((p, i, list) => list.indexOf(p) === i)
        .map((p) => { const quantity = int(1, p.price < 5000 ? 6 : 2); return { productId: p.id, productName: p.name, quantity, unitPrice: Number(p.price), subtotal: quantity * Number(p.price) }; });
      await prisma.businessOrder.create({
        data: {
          businessId: profile.id, customerName: pick(CUSTOMERS), customerContact: rand() < 0.4 ? `381 ${int(400, 699)} ${int(1000, 9999)}` : null,
          channel: pick(CHANNELS), status, total: lines.reduce((sum, l) => sum + l.subtotal, 0), createdAt,
          paymentMethod: status === 'ENTREGADO' ? pick(['EFECTIVO', 'EFECTIVO', 'EFECTIVO', 'TRANSFERENCIA', 'TRANSFERENCIA', 'MERCADO_PAGO', 'TARJETA']) : null,
          deliveredAt: status === 'ENTREGADO' ? createdAt : null, items: { create: lines },
        },
      });
    }
  }

  // Postulaciones, ventas en ferias pasadas y avisos
  const applicationsByKey = {};
  for (const [username, eventKey, status, offered, notes, extra = {}] of APPLICATIONS) {
    const event = events[eventKey];
    const business = businesses[username];
    const payment = extra.payment === 'CONFIRMADO_EFECTIVO' ? 'CONFIRMADO' : extra.payment || 'NO_APLICA';
    let receiptId = null;
    if (payment === 'INFORMADO') {
      const receipt = makePdf(['COMPROBANTE DE TRANSFERENCIA - PRUEBA', '', `Importe: $ ${Number(event.standFee).toLocaleString('es-AR')}`, `Destino: ${event.name}`, `Origen: ${business.name}`, '', 'Documento de prueba sin validez.']);
      receiptId = (await storeFile(users[username].id, 'PAYMENT_RECEIPT', receipt, 'application/pdf', 'comprobante-transferencia.pdf')).id;
    }
    const application = await prisma.eventApplication.create({
      data: {
        eventId: event.id, businessId: business.id, applicantUserId: users[username].id, offeredProduct: offered, status, reviewNotes: notes,
        additionalInfo: rand() < 0.4 ? 'Puedo llevar gazebo propio.' : null,
        createdAt: daysFromNow(Math.min(-1, EVENTS.find((e) => e.key === eventKey).deadline - int(1, 6))),
        standLabel: extra.stand || null, setupTime: extra.setup || null,
        waitlistedAt: status === 'LISTA_ESPERA' ? daysFromNow(-2) : null,
        paymentStatus: payment,
        paymentMethod: { INFORMADO: 'TRANSFERENCIA', CONFIRMADO: extra.payment === 'CONFIRMADO_EFECTIVO' ? 'EFECTIVO' : 'ONLINE_SIMULADO' }[payment] || null,
        paymentReference: payment === 'INFORMADO' ? '00012345' : payment === 'CONFIRMADO' && extra.payment !== 'CONFIRMADO_EFECTIVO' ? `SIM-${crypto.randomBytes(4).toString('hex').toUpperCase()}` : null,
        paymentReceiptUploadId: receiptId,
        paymentInformedAt: ['INFORMADO', 'CONFIRMADO'].includes(payment) ? daysFromNow(-1) : null,
        paymentConfirmedAt: payment === 'CONFIRMADO' ? (extra.payment === 'CONFIRMADO_EFECTIVO' ? daysFromNow(EVENTS.find((e) => e.key === eventKey).start - 3) : daysFromNow(-1)) : null,
        attendedAt: status === 'APROBADA' && EVENTS.find((e) => e.key === eventKey).start < 0 ? daysFromNow(EVENTS.find((e) => e.key === eventKey).start, 9) : null,
      },
      include: { event: true, business: true, applicant: { select: { id: true, name: true } } },
    });
    applicationsByKey[`${username}:${eventKey}`] = application;
    if (['APROBADA', 'NO_SELECCIONADA', 'LISTA_ESPERA'].includes(status)) {
      const template = (status === 'APROBADA' && application.event.approvalMessage) || DEFAULT_TEMPLATES[status];
      await prisma.applicationMessage.create({
        data: {
          applicationId: application.id, senderUserId: event.organizerUserId, kind: 'AUTOMATICO', readAt: daysFromNow(-1),
          body: renderTemplate(template, { application, event: application.event, applicant: application.applicant, business: application.business }),
          createdAt: daysFromNow(-3),
        },
      });
    }
    if (notes) await prisma.applicationMessage.create({ data: { applicationId: application.id, senderUserId: event.organizerUserId, body: notes, readAt: daysFromNow(-1), createdAt: daysFromNow(-3) } });
    if (status !== 'BORRADOR') {
      await prisma.notification.create({ data: { userId: event.organizerUserId, type: 'CONVOCATORIA', title: 'Nueva postulación para revisar', description: `${business.name} se postuló a ${event.name}.`, read: status !== 'ENVIADA', link: `/gestion?postulacion=${application.id}` } });
    }
    if (['APROBADA', 'NO_SELECCIONADA'].includes(status)) {
      const label = status === 'APROBADA' ? 'Aprobada' : 'No seleccionada';
      await prisma.notification.create({ data: { userId: users[username].id, type: 'CONVOCATORIA', title: 'Cambió el estado de tu postulación', description: `${event.name}: ${label}.${notes ? ` Comentario: ${notes}` : ''}`, read: event.status === 'CERRADA', link: `/postulaciones?postulacion=${application.id}&mensajes=1` } });
    }
    if (status === 'APROBADA' && event.status === 'CERRADA') {
      const products = await prisma.businessProduct.findMany({ where: { businessId: business.id } });
      for (let n = 0; n < int(6, 10); n += 1) {
        const p = pick(products);
        const quantity = int(1, 4);
        const at = new Date(event.startsAt.getTime() + int(1, 9) * 3600000);
        await prisma.businessOrder.create({
          data: { businessId: business.id, eventId: event.id, customerName: 'Consumidor final', channel: 'FERIA', status: 'ENTREGADO', paymentMethod: pick(['EFECTIVO', 'EFECTIVO', 'TRANSFERENCIA']), total: quantity * Number(p.price), createdAt: at, deliveredAt: at,
            items: { create: [{ productId: p.id, productName: p.name, quantity, unitPrice: Number(p.price), subtotal: quantity * Number(p.price) }] } },
        });
      }
    }
  }
  for (const [username, eventKey, lines] of CONVERSATIONS) {
    const application = applicationsByKey[`${username}:${eventKey}`];
    for (const [index, [who, body, read]] of lines.entries()) {
      await prisma.applicationMessage.create({
        data: {
          applicationId: application.id, senderUserId: who === 'emp' ? users[username].id : application.event.organizerUserId, body,
          readAt: read ? daysFromNow(-1) : null, createdAt: new Date(Date.now() - (lines.length - index) * 3 * 3600000),
        },
      });
    }
  }
  for (const [username, eventKey, lines] of CONVERSATIONS) {
    const application = applicationsByKey[`${username}:${eventKey}`];
    const [who] = lines.findLast(([, , read]) => !read) || [];
    if (!who) continue;
    const toOrganizer = who === 'emp';
    await prisma.notification.create({
      data: {
        userId: toOrganizer ? application.event.organizerUserId : users[username].id, type: 'MENSAJE', title: 'Nuevo mensaje',
        description: `${toOrganizer ? application.business.name : 'La organización'} te escribió sobre ${application.event.name}.`, read: false,
        link: toOrganizer ? `/gestion?postulacion=${application.id}&mensajes=1` : `/postulaciones?postulacion=${application.id}&mensajes=1`,
      },
    });
  }
  for (const [username, eventKey, toOrganizer, organizerComment, toBusiness, businessComment] of REVIEWS) {
    const application = applicationsByKey[`${username}:${eventKey}`];
    await prisma.review.create({ data: { applicationId: application.id, direction: 'EMPRENDEDOR_A_ORGANIZADOR', authorUserId: users[username].id, targetUserId: application.event.organizerUserId, rating: toOrganizer, comment: organizerComment } });
    await prisma.review.create({ data: { applicationId: application.id, direction: 'ORGANIZADOR_A_EMPRENDEDOR', authorUserId: application.event.organizerUserId, targetUserId: users[username].id, rating: toBusiness, comment: businessComment } });
  }
  // Caja del día: los últimos días con ventas de cada emprendimiento quedan cerrados con su arqueo.
  const EXPENSES = ['Bolsas y servilletas', 'Flete', 'Hielo', 'Cambio para el día', 'Insumos', 'Nafta'];
  for (const b of BUSINESSES) {
    const business = businesses[b.username];
    for (let ago = 1; ago <= 7; ago += 1) {
      const openedAt = daysFromNow(-ago, 8, 30);
      const closedAt = daysFromNow(-ago, 21, 0);
      const cashSales = await prisma.businessOrder.aggregate({ where: { businessId: business.id, status: 'ENTREGADO', paymentMethod: 'EFECTIVO', deliveredAt: { gte: openedAt, lte: closedAt } }, _sum: { total: true } });
      const anySale = await prisma.businessOrder.count({ where: { businessId: business.id, status: 'ENTREGADO', deliveredAt: { gte: openedAt, lte: closedAt } } });
      if (!anySale) continue;
      const openingCash = pick([3000, 5000, 5000, 10000]);
      const day = await prisma.businessCashDay.create({ data: { businessId: business.id, status: 'CERRADA', openingCash, openedAt, closedAt } });
      let cashExpenses = 0;
      for (let n = 0; n < int(0, 2); n += 1) {
        const amount = int(4, 30) * 500;
        const method = rand() < 0.75 ? 'EFECTIVO' : 'TRANSFERENCIA';
        if (method === 'EFECTIVO') cashExpenses += amount;
        await prisma.businessExpense.create({ data: { businessId: business.id, cashDayId: day.id, concept: pick(EXPENSES), amount, method, createdAt: daysFromNow(-ago, int(9, 19), int(0, 59)) } });
      }
      const expected = openingCash + Number(cashSales._sum.total || 0) - cashExpenses;
      const counted = rand() < 0.75 ? expected : expected - pick([200, 500, 1000]);
      await prisma.businessCashDay.update({ where: { id: day.id }, data: { expectedCash: expected, countedCash: counted, notes: counted === expected ? null : 'Di cambio de más.' } });
    }
  }

  // Denuncias de ejemplo para la administración
  const reportSeeds = [
    { reporter: 'emp_tejidos', targetType: 'ESPACIO', targetId: spaces.predio.id, reason: 'ESPACIO_AJENO', details: 'En el predio de la ruta me pidieron $20.000 por un puesto, pero el lugar no es de quienes cobran.' },
    { reporter: 'emp_ceramica', targetType: 'CONVERSACION', targetId: applicationsByKey['emp_ceramica:diseno'].id, reason: 'INCUMPLIMIENTO', details: 'Transferí el puesto hace días y todavía no me confirman el pago.' },
    { reporter: 'org_club', targetType: 'USUARIO', targetId: users.emp_nuevo.id, reason: 'DATOS_FALSOS', details: 'Se registró con un nombre que no coincide con su documento.', status: 'DESCARTADA', resolutionNotes: 'Se verificó la identidad con la persona. No hay falta.' },
  ];
  for (const report of reportSeeds) {
    await prisma.report.create({
      data: {
        reporterUserId: users[report.reporter].id, targetType: report.targetType, targetId: report.targetId, reason: report.reason, details: report.details,
        status: report.status || 'ABIERTA', resolutionNotes: report.resolutionNotes || null,
        resolvedByUserId: report.status ? admin.id : null, resolvedAt: report.status ? daysFromNow(-2) : null, createdAt: daysFromNow(report.status ? -4 : -1),
      },
    });
  }
  await prisma.notification.createMany({
    data: [
      { userId: admin.id, type: 'DENUNCIA', title: 'Nueva denuncia para revisar', description: 'Ofrece un espacio que no le pertenece sobre el espacio "Predio sobre Ruta 9".', link: '/denuncias' },
      { userId: admin.id, type: 'ESPACIO', title: 'Espacio para verificar', description: 'Local Esquina San Martín (Banda del Río Salí) tiene la documentación completa.', link: '/verificar' },
    ],
  });

  for (const [eventKey, plan] of Object.entries(PLANS)) {
    await prisma.marketEvent.update({ where: { id: events[eventKey].id }, data: { standPlan: plan } });
  }

  for (const s of SPACES.filter((item) => item.status !== 'PENDIENTE')) {
    await prisma.notification.create({ data: { userId: users[s.owner].id, type: 'ESPACIO', title: `Tu espacio fue ${s.status === 'VERIFICADO' ? 'verificado' : 'rechazado'}`, description: `${s.name}${s.reviewNotes ? `: ${s.reviewNotes}` : '. Ya podés publicar convocatorias en este espacio.'}`, read: true, link: '/espacios' } });
  }
  for (const b of BUSINESSES) {
    await prisma.notification.create({ data: { userId: users[b.username].id, type: 'CONVOCATORIA', title: 'Nueva convocatoria en tu zona', description: `${EVENTS[0].name} · Revisá las fechas y los requisitos antes de postularte.`, read: false, link: `/convocatorias/${events[EVENTS[0].key].id}` } });
  }

  console.log(`\nSeed Emprende listo${removed ? ` (se reemplazaron ${removed} cuentas de una carga anterior)` : ''}.`);
  console.log(`Contraseña de todas las cuentas: ${PASSWORD}`);
  console.log(`Imágenes reales usadas desde src/seed/images: ${realImages} (el resto son de muestra).\n`);
  console.table([
    { usuario: 'admin_emprende', rol: 'Administración de la plataforma', 'para probar': 'Verificar espacios (hay 1 pendiente)' },
    { usuario: 'org_galeria', rol: 'Organizador', 'para probar': '1 espacio verificado + 1 pendiente, 3 convocatorias' },
    { usuario: 'org_club', rol: 'Organizador', 'para probar': 'Feria gastronómica llena con lista de espera, mensajes y plano' },
    { usuario: 'org_plaza', rol: 'Organizador', 'para probar': 'Plaza con permiso municipal + predio rechazado' },
    { usuario: 'org_nuevo', rol: 'Organizador', 'para probar': 'Cuenta vacía: registrar un espacio desde cero' },
    { usuario: 'emp_empanadas', rol: 'Emprendedor', 'para probar': 'Pago pendiente, mensajes, calificación y ventas en feria pasada' },
    { usuario: 'emp_ceramica', rol: 'Emprendedor', 'para probar': 'Aprobada, borrador y no seleccionada' },
    { usuario: 'emp_tejidos / emp_dulces / emp_panificados / emp_plantas', rol: 'Emprendedor', 'para probar': 'Distintos estados y pedidos' },
    { usuario: 'emp_nuevo', rol: 'Emprendedor', 'para probar': 'Cuenta vacía: crear el emprendimiento desde cero' },
  ]);
}

main()
  .catch((error) => { console.error(`\n${error.message}`); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
