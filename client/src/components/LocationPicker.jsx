import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { setupLeafletIcons } from '../lib/leafletSetup';

setupLeafletIcons();

function ClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
    map.invalidateSize();
  }, [center, map]);
  return null;
}

export function LocationPicker({ value, onChange, height = 'h-64' }) {
  const center = [value.latitude, value.longitude];
  return (
    <div className={`${height} overflow-hidden rounded-2xl border border-outline-variant`}>
        <MapContainer center={center} zoom={14} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={center}
          draggable
          eventHandlers={{
            dragend(event) {
              const next = event.target.getLatLng();
              onChange({ latitude: next.lat, longitude: next.lng });
            },
          }}
        />
        <ClickHandler onPick={onChange} />
        <Recenter center={center} />
      </MapContainer>
    </div>
  );
}
