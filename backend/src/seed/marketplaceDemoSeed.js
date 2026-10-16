import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL;
const seedPassword = process.env.DEMO_SEED_PASSWORD;

function assertSafeDemoEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed cancelado: NODE_ENV=production.');
  }
  if (process.env.SEED_DEMO_MARKETPLACE !== '1') {
    throw new Error('Seed cancelado: definí SEED_DEMO_MARKETPLACE=1 para habilitarlo explícitamente.');
  }
  if (!databaseUrl) throw new Error('Seed cancelado: falta DATABASE_URL.');

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Seed cancelado: DATABASE_URL no tiene un formato válido.');
  }
  const host = parsed.hostname.toLowerCase();
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '')).toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host) || !databaseName.includes('demo')) {
    throw new Error('Seed cancelado: usá una base local cuyo nombre incluya “demo” (por ejemplo, sistema_autogestion_demo).');
  }
  if (!seedPassword || seedPassword.length < 12) {
    throw new Error('Seed cancelado: definí DEMO_SEED_PASSWORD con al menos 12 caracteres.');
  }
}

const demoEvents = [
  { key: 'BANDA-1', locality: 'Banda del Río Salí', address: 'Ubicación de prueba · punto aproximado; espacio público no confirmado', latitude: -26.82, longitude: -65.22 },
  { key: 'CRUZ-1', locality: 'Cruz Alta', address: 'Ubicación de prueba · punto aproximado; espacio público no confirmado', latitude: -26.83, longitude: -65.18 },
  { key: 'ALDERETES-1', locality: 'Alderetes', address: 'Ubicación de prueba · punto aproximado; espacio público no confirmado', latitude: -26.81, longitude: -65.20 },
  { key: 'BANDA-2', locality: 'Banda del Río Salí', address: 'Ubicación de prueba · punto aproximado; espacio público no confirmado', latitude: -26.84, longitude: -65.21 },
  { key: 'CRUZ-2', locality: 'Cruz Alta', address: 'Ubicación de prueba · punto aproximado; espacio público no confirmado', latitude: -26.85, longitude: -65.17 },
];

const prisma = new PrismaClient();

async function main() {
  assertSafeDemoEnvironment();
  const now = new Date();
  const password = await bcrypt.hash(seedPassword, 10);
  const organizer = await prisma.user.upsert({
    where: { email: 'organizador.demo@example.invalid' },
    create: { name: 'Organización', lastName: 'Demostración', username: 'organizador_demo', email: 'organizador.demo@example.invalid', password, role: 'ADMINISTRADOR' },
    update: { name: 'Organización', lastName: 'Demostración', password, role: 'ADMINISTRADOR', status: true },
  });
  const applicant = await prisma.user.upsert({
    where: { email: 'emprendedor.demo@example.invalid' },
    create: { name: 'Emprendedor', lastName: 'Demostración', username: 'emprendedor_demo', email: 'emprendedor.demo@example.invalid', password, role: 'EMPRENDEDOR' },
    update: { name: 'Emprendedor', lastName: 'Demostración', password, role: 'EMPRENDEDOR', status: true },
  });
  await prisma.notification.deleteMany({
    where: { userId: { in: [organizer.id, applicant.id] }, type: 'CONVOCATORIA' },
  });
  const business = await prisma.businessProfile.upsert({
    where: { ownerUserId: applicant.id },
    create: {
      ownerUserId: applicant.id, name: 'Emprendimiento de demostración', kind: 'ITINERANTE',
      category: 'Alimentos', description: 'Perfil ficticio para recorrer el flujo de postulaciones.',
      locality: 'Banda del Río Salí', address: 'Dirección de prueba',
      contactEmail: 'emprendedor.demo@example.invalid', contactPhone: '0000000000', notificationsEnabled: true,
    },
    update: {
      name: 'Emprendimiento de demostración', kind: 'ITINERANTE', category: 'Alimentos',
      description: 'Perfil ficticio para recorrer el flujo de postulaciones.', locality: 'Banda del Río Salí',
      address: 'Dirección de prueba', contactEmail: 'emprendedor.demo@example.invalid',
      contactPhone: '0000000000', notificationsEnabled: true,
    },
  });

  const eventRecords = [];
  for (const [index, location] of demoEvents.entries()) {
    const startsAt = new Date(now);
    startsAt.setDate(startsAt.getDate() + 35 + index * 7);
    startsAt.setHours(9, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(18, 0, 0, 0);
    const applicationDeadline = new Date(startsAt);
    applicationDeadline.setDate(applicationDeadline.getDate() - 10);
    const name = `DEMO · Convocatoria ${location.key} · feria de prueba`;
    const eventData = {
      organizerUserId: organizer.id, name, locality: location.locality, address: location.address,
      latitude: location.latitude, longitude: location.longitude, startsAt, endsAt, applicationDeadline,
      description: 'Evento ficticio para probar filtros, mapa y postulaciones. No es una convocatoria oficial.',
      acceptedCategories: 'Alimentos|Artesanías|Indumentaria',
      requirements: 'Datos de prueba: completar el perfil del negocio y describir la propuesta. No se requiere documentación real.',
      capacity: 12, status: 'PUBLICADA',
    };
    const existing = await prisma.marketEvent.findFirst({ where: { name } });
    const event = existing
      ? await prisma.marketEvent.update({ where: { id: existing.id }, data: eventData })
      : await prisma.marketEvent.create({ data: eventData });
    eventRecords.push(event);
  }

  const sampleApplications = [
    { event: eventRecords[0], status: 'BORRADOR', offeredProduct: 'Panificados de prueba' },
    { event: eventRecords[1], status: 'ENVIADA', offeredProduct: 'Conservas de prueba' },
    { event: eventRecords[2], status: 'EN_REVISION', offeredProduct: 'Dulces de prueba' },
    { event: eventRecords[3], status: 'APROBADA', offeredProduct: 'Productos regionales de prueba' },
  ];
  for (const sample of sampleApplications) {
    await prisma.eventApplication.upsert({
      where: { eventId_businessId: { eventId: sample.event.id, businessId: business.id } },
      create: {
        eventId: sample.event.id, businessId: business.id, applicantUserId: applicant.id,
        offeredProduct: sample.offeredProduct, additionalInfo: 'Solicitud de demostración; contacto ficticio del perfil de prueba.', status: sample.status,
      },
      update: {
        applicantUserId: applicant.id, offeredProduct: sample.offeredProduct,
        additionalInfo: 'Solicitud de demostración; contacto ficticio del perfil de prueba.', status: sample.status,
      },
    });
  }

  console.log(`Seed de demostración listo: ${eventRecords.length} convocatorias y ${sampleApplications.length} solicitudes en la base local indicada.`);
  console.log('Cuentas de prueba: organizador.demo@example.invalid (ADMINISTRADOR) y emprendedor.demo@example.invalid (EMPRENDEDOR). Usan DEMO_SEED_PASSWORD. No se enviaron mensajes.');
}

main()
  .catch((error) => {
    console.error(error.message || 'No se pudo cargar el seed de demostración.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
