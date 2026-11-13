import { Router } from 'express';

const router = Router();

// Configuración no secreta para el navegador. La clave de Maps se protege restringiéndola
// por dominio (HTTP referrer) en Google Cloud, no ocultándola.
router.get('/config', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY?.trim() || null,
    googleMapsMapId: process.env.GOOGLE_MAPS_MAP_ID?.trim() || null,
  });
});

export default router;
