import { useCallback, useEffect, useRef, useState } from 'react';

const FALLBACK = { latitude: -6.9147, longitude: 107.6098 };

export function useGeolocation() {
  const [coords, setCoords] = useState(() => {
    const cached = localStorage.getItem('berybox_coords');
    if (!cached) return null;
    try {
      const parsed = JSON.parse(cached);
      if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') return parsed;
    } catch {
      localStorage.removeItem('berybox_coords');
    }
    return null;
  });
  const [status, setStatus] = useState(coords ? 'ready' : 'idle');

  useEffect(() => {
    if (coords || !navigator.geolocation) {
      if (!coords) {
        setCoords(FALLBACK);
        setStatus('fallback');
      }
      return undefined;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        localStorage.setItem('berybox_coords', JSON.stringify(next));
        setCoords(next);
        setStatus('ready');
      },
      () => {
        setCoords(FALLBACK);
        setStatus('fallback');
      },
      { timeout: 8000 },
    );
    return undefined;
  }, [coords]);

  return { coords: coords || FALLBACK, status };
}

export function useSyncedMapPosition() {
  const { coords, status } = useGeolocation();
  const [position, setPosition] = useState(coords);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) setPosition(coords);
  }, [coords]);

  const onChange = useCallback((next) => {
    dirtyRef.current = true;
    setPosition(next);
  }, []);

  const replace = useCallback((next) => {
    dirtyRef.current = true;
    setPosition(next);
  }, []);

  return { position, setPosition: onChange, replacePosition: replace, coords, status };
}

export { FALLBACK as DEFAULT_COORDS };
