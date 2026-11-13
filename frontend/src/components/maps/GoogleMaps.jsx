import React, { useEffect, useState } from 'react';
import { APIProvider, AdvancedMarker, InfoWindow, Map, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search } from 'lucide-react';
import { DEFAULT_CENTER, MARKER_COLORS, hasCoordinates } from './mapsConfig.js';

const MapsShell = ({ apiKey, children }) => (
  <APIProvider apiKey={apiKey} language="es" region="AR">{children}</APIProvider>
);

const toLatLng = (item) => ({ lat: Number(item.latitude), lng: Number(item.longitude) });

function FitToPoints({ points, selected }) {
  const map = useMap();
  const signature = points.map((point) => `${point.lat},${point.lng}`).join('|');
  useEffect(() => {
    if (!map) return;
    if (selected) {
      map.panTo(selected);
      if ((map.getZoom() || 0) < 14) map.setZoom(14);
      return;
    }
    if (points.length === 1) { map.setCenter(points[0]); map.setZoom(14); return; }
    if (points.length > 1) {
      const lats = points.map((point) => point.lat);
      const lngs = points.map((point) => point.lng);
      map.fitBounds({ north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) }, 48);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature, selected?.lat, selected?.lng]);
  return null;
}

/**
 * Mapa de Google con marcadores. `items` = [{ id, latitude, longitude, tone }].
 * `renderInfo(item)` dibuja el contenido de la ventana del marcador seleccionado.
 */
export function GoogleMarkersMap({ apiKey, mapId, items, selectedId, onSelect, renderInfo, className = 'market-map' }) {
  const located = items.filter(hasCoordinates);
  const selectedItem = located.find((item) => item.id === selectedId) || null;
  return (
    <MapsShell apiKey={apiKey}>
      <Map
        className={className}
        mapId={mapId || 'DEMO_MAP_ID'}
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={11}
        gestureHandling="greedy"
        clickableIcons={false}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl
      >
        {located.map((item) => {
          const selected = item.id === selectedId;
          const color = MARKER_COLORS[item.tone] || MARKER_COLORS.open;
          return (
            <AdvancedMarker key={item.id} position={toLatLng(item)} title={item.title} zIndex={selected ? 10 : 1} onClick={() => onSelect?.(item.id)}>
              <Pin background={color} borderColor="#ffffff" glyphColor="#ffffff" scale={selected ? 1.3 : 1} />
            </AdvancedMarker>
          );
        })}
        {selectedItem && renderInfo && (
          <InfoWindow position={toLatLng(selectedItem)} pixelOffset={[0, -40]} onCloseClick={() => onSelect?.(null)} headerDisabled>
            {renderInfo(selectedItem)}
          </InfoWindow>
        )}
        <FitToPoints points={located.map(toLatLng)} selected={selectedItem ? toLatLng(selectedItem) : null} />
      </Map>
    </MapsShell>
  );
}

function AddressSearch({ onFound, locality }) {
  const geocoding = useMapsLibrary('geocoding');
  const map = useMap();
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!geocoding || !query.trim()) return;
    setBusy(true); setError('');
    try {
      const geocoder = new geocoding.Geocoder();
      const { results } = await geocoder.geocode({
        address: `${query.trim()}, ${locality || ''}, Tucumán, Argentina`,
        region: 'ar',
        componentRestrictions: { country: 'AR' },
      });
      if (!results?.length) throw new Error('empty');
      const location = results[0].geometry.location;
      const point = { lat: location.lat(), lng: location.lng() };
      map?.panTo(point); map?.setZoom(17);
      onFound(point, results[0].formatted_address);
    } catch {
      setError('No encontramos esa dirección. Marcá el punto directamente en el mapa.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="map-picker-search">
      <div>
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
          placeholder="Buscar dirección (ej.: Av. Independencia 500)"
          maxLength={160}
        />
        <button type="button" onClick={search} disabled={busy || !geocoding}>{busy ? 'Buscando…' : 'Buscar'}</button>
      </div>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

/** Selector de ubicación: buscar dirección, tocar el mapa o arrastrar el marcador. */
export function GoogleLocationPicker({ apiKey, mapId, value, onChange, locality }) {
  const point = hasCoordinates(value) ? toLatLng(value) : null;
  const setPoint = (latLng) => onChange({ latitude: Number(latLng.lat.toFixed(6)), longitude: Number(latLng.lng.toFixed(6)) });
  return (
    <MapsShell apiKey={apiKey}>
      <AddressSearch locality={locality} onFound={(found) => setPoint(found)} />
      <Map
        className="map-picker"
        mapId={mapId || 'DEMO_MAP_ID'}
        defaultCenter={point || DEFAULT_CENTER}
        defaultZoom={point ? 16 : 12}
        gestureHandling="greedy"
        clickableIcons={false}
        streetViewControl={false}
        mapTypeControl={false}
        onClick={(event) => { if (event.detail.latLng) setPoint(event.detail.latLng); }}
      >
        {point && (
          <AdvancedMarker
            position={point}
            draggable
            onDragEnd={(event) => { if (event.latLng) setPoint({ lat: event.latLng.lat(), lng: event.latLng.lng() }); }}
          >
            <Pin background={MARKER_COLORS.space} borderColor="#ffffff" glyphColor="#ffffff" scale={1.2} />
          </AdvancedMarker>
        )}
      </Map>
    </MapsShell>
  );
}
