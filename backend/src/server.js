import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import saleRoutes from './routes/saleRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import cashRoutes from './routes/cashRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import configRoutes from './routes/configRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import spaceRoutes from './routes/spaceRoutes.js';
import businessRoutes from './routes/businessRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import participationRoutes from './routes/participationRoutes.js';
import platformRoutes from './routes/platformRoutes.js';
import { startReminderJob } from './controllers/participationController.js';
import prisma from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Render (y otros hosts) ponen un proxy adelante: necesario para que el rate limit vea la IP real.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Cabeceras de seguridad. La CSP habilita solo lo necesario para Google Identity Services,
// Google Maps (según la guía de CSP de Maps JavaScript API), Google Fonts y OpenStreetMap.
const GOOGLE_MAPS_HOSTS = ['https://*.googleapis.com', 'https://*.gstatic.com', '*.google.com', 'https://*.ggpht.com', '*.googleusercontent.com'];
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      // 'unsafe-eval' y blob: los pide Google Maps para el mapa vectorial. No se permite script inline.
      scriptSrc: ["'self'", "'unsafe-eval'", 'blob:', 'https://accounts.google.com/gsi/client', ...GOOGLE_MAPS_HOSTS],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://accounts.google.com/gsi/', ...GOOGLE_MAPS_HOSTS, 'data:', 'blob:'],
      frameSrc: ['https://accounts.google.com/gsi/', '*.google.com'],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  // El popup de Google necesita comunicarse con la ventana que lo abrió.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
  // Google valida el origen del botón mediante el Referer.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '100kb' }));

// Request logger en consola
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toLocaleTimeString('es-AR')}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Endpoint de salud
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'OK',
      timestamp: new Date(),
      database: 'MySQL Conectado',
      system: 'Emprende',
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', database: 'Desconectado', error: error.message });
  }
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/config', configRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/spaces', spaceRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/participation', participationRoutes);
app.use('/api/platform', platformRoutes);

// Frontend compilado (frontend/dist): en producción el mismo servidor entrega la app
const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Manejador de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// Manejo centralizado de errores
app.use((err, req, res, next) => {
  console.error('❌ Error no controlado en backend:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Error interno del servidor.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

if (process.env.NODE_ENV !== 'test') startReminderJob();

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend escuchando en: http://localhost:${PORT}`);
  console.log(`📡 Base de datos MySQL conectada mediante Prisma`);
});

export default app;
