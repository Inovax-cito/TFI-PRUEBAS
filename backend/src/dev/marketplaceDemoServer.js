import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || process.env.NODE_ENV === 'production') {
  throw new Error('Servidor demo cancelado: requiere DATABASE_URL local y no puede ejecutarse en producción.');
}

const demoUrl = new URL(databaseUrl);
const host = demoUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase();
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error('Servidor demo cancelado: DATABASE_URL debe apuntar a un servidor local.');
}
demoUrl.pathname = '/sistema_autogestion_emprende_demo';
process.env.DATABASE_URL = demoUrl.toString();

await import('../server.js');
