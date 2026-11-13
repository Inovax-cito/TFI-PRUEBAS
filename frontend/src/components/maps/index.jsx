import React, { Suspense, lazy } from 'react';
import { MapPin } from 'lucide-react';
import { useMapsConfig } from './mapsConfig.js';
import { LeafletLocationPicker, LeafletMarkersMap } from './LeafletMaps.jsx';

export { googleMapsLink, hasCoordinates } from './mapsConfig.js';

// Google Maps solo se descarga si hay clave configurada.
const GoogleMarkersMap = lazy(() => import('./GoogleMaps.jsx').then((module) => ({ default: module.GoogleMarkersMap })));
const GoogleLocationPicker = lazy(() => import('./GoogleMaps.jsx').then((module) => ({ default: module.GoogleLocationPicker })));

const MapLoading = ({ className }) => <div className={`${className} map-loading`}><MapPin size={18} /> Cargando mapa…</div>;

/** Mapa con marcadores: Google Maps si está configurado; si no, OpenStreetMap. */
export function MarkersMap(props) {
  const config = useMapsConfig();
  const className = props.className || 'market-map';
  if (!config) return <MapLoading className={className} />;
  if (!config.apiKey) return <LeafletMarkersMap {...props} />;
  return (
    <Suspense fallback={<MapLoading className={className} />}>
      <GoogleMarkersMap {...props} apiKey={config.apiKey} mapId={config.mapId} />
    </Suspense>
  );
}

/** Selector de ubicación con búsqueda de dirección (Google) o clic en el mapa (ambos). */
export function LocationPicker({ value, onChange, locality }) {
  const config = useMapsConfig();
  return (
    <div className="map-picker-wrap">
      {!config ? <MapLoading className="map-picker" /> : config.apiKey ? (
        <Suspense fallback={<MapLoading className="map-picker" />}>
          <GoogleLocationPicker apiKey={config.apiKey} mapId={config.mapId} value={value} onChange={onChange} locality={locality} />
        </Suspense>
      ) : <LeafletLocationPicker value={value} onChange={onChange} />}
      <p className="map-picker-hint">
        {value?.latitude !== '' && value?.latitude !== null && value?.latitude !== undefined
          ? <>Punto marcado: <b>{Number(value.latitude).toFixed(5)}, {Number(value.longitude).toFixed(5)}</b>. Podés arrastrarlo para ajustarlo.</>
          : 'Tocá el mapa en el lugar exacto del espacio.'}
      </p>
    </div>
  );
}
