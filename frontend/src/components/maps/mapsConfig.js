import { useEffect, useState } from 'react';
import { apiRequest } from '../../utils/api.js';

let cached = null;
let pending = null;

export const loadMapsConfig = () => {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = apiRequest('/public/config')
      .then((config) => { cached = { apiKey: config.googleMapsApiKey || null, mapId: config.googleMapsMapId || null }; return cached; })
      .catch(() => { cached = { apiKey: null, mapId: null }; return cached; })
      .finally(() => { pending = null; });
  }
  return pending;
};

/** Devuelve null mientras carga; luego { apiKey, mapId }. Sin apiKey se usa OpenStreetMap. */
export const useMapsConfig = () => {
  const [config, setConfig] = useState(cached);
  useEffect(() => {
    if (cached) return undefined;
    let active = true;
    loadMapsConfig().then((value) => { if (active) setConfig(value); });
    return () => { active = false; };
  }, []);
  return config;
};

export const DEFAULT_CENTER = { lat: -26.82, lng: -65.2 };

export const hasCoordinates = (item) => item && item.latitude !== null && item.longitude !== null
  && item.latitude !== '' && item.longitude !== ''
  && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))
  && Math.abs(Number(item.latitude)) <= 90 && Math.abs(Number(item.longitude)) <= 180;

/** Enlace a Google Maps que funciona sin clave de API (abre la app o la web). */
export const googleMapsLink = (latitude, longitude) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;

export const MARKER_COLORS = { open: '#267950', closed: '#7c8580', draft: '#c7a04a', space: '#008c91' };
