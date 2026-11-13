import React, { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CircleAlert } from 'lucide-react';
import { DEFAULT_CENTER, hasCoordinates } from './mapsConfig.js';

const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

const markerIcon = (tone, selected = false) => L.divIcon({
  className: `market-leaflet-marker-shell${selected ? ' selected' : ''}`,
  html: `<span class="market-leaflet-marker ${tone === 'space' ? 'open' : tone}${selected ? ' selected' : ''}"><i></i></span>`,
  iconSize: [27, 36], iconAnchor: [13, 33], popupAnchor: [0, -30],
});

function FitLeaflet({ items, selectedId }) {
  const map = useMap();
  const located = items.filter(hasCoordinates);
  const signature = located.map((item) => `${item.id}:${item.latitude},${item.longitude}`).join('|');
  const selected = located.find((item) => item.id === selectedId);
  const selectedKey = selected ? `${selected.latitude},${selected.longitude}` : '';
  // Solo se mueve el mapa cuando cambian los puntos o la selección; así no "vuelve" mientras la persona lo recorre.
  useEffect(() => {
    if (!signature) return;
    const points = signature.split('|').map((entry) => entry.split(':')[1].split(',').map(Number));
    if (points.length > 1) map.fitBounds(points, { padding: [38, 38], maxZoom: 14 });
    else map.setView(points[0], 14);
  }, [map, signature]);
  useEffect(() => {
    if (!selectedKey) return;
    map.flyTo(selectedKey.split(',').map(Number), Math.max(map.getZoom(), 14), { duration: 0.35 });
  }, [map, selectedKey]);
  return null;
}

export function LeafletMarkersMap({ items, selectedId, onSelect, renderInfo, className = 'market-map' }) {
  const [tileError, setTileError] = useState(false);
  const located = items.filter(hasCoordinates);
  return (
    <>
      <MapContainer className={className} center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} zoom={11} scrollWheelZoom>
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} eventHandlers={{ tileerror: () => setTileError(true), load: () => setTileError(false) }} />
        {located.map((item) => (
          <Marker
            key={item.id}
            position={[Number(item.latitude), Number(item.longitude)]}
            icon={markerIcon(item.tone, item.id === selectedId)}
            eventHandlers={{ click: () => onSelect?.(item.id) }}
          >
            {renderInfo && <Popup>{renderInfo(item)}</Popup>}
          </Marker>
        ))}
        <FitLeaflet items={items} selectedId={selectedId} />
      </MapContainer>
      {tileError && <div className="market-map-message" role="status"><CircleAlert size={16} /> El mapa base no está disponible ahora.</div>}
    </>
  );
}

function ClickToPlace({ onPick }) {
  useMapEvents({ click: (event) => onPick(event.latlng) });
  return null;
}

export function LeafletLocationPicker({ value, onChange }) {
  const point = hasCoordinates(value) ? [Number(value.latitude), Number(value.longitude)] : null;
  const setPoint = (latlng) => onChange({ latitude: Number(latlng.lat.toFixed(6)), longitude: Number(latlng.lng.toFixed(6)) });
  return (
    <MapContainer className="map-picker" center={point || [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} zoom={point ? 16 : 12} scrollWheelZoom>
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <ClickToPlace onPick={setPoint} />
      {point && (
        <Marker
          position={point}
          draggable
          icon={markerIcon('space', true)}
          eventHandlers={{ dragend: (event) => setPoint(event.target.getLatLng()) }}
        />
      )}
    </MapContainer>
  );
}
