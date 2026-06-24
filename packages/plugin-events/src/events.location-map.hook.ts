import * as React from 'react';
import type { EventMapLibreMap, EventMapLibreMarker, EventMapLibreModule } from './events.location-map.runtime.js';

import { useEventLocationMapLifecycle, useEventLocationMapViewport } from './events.location-map.effects.js';
import { parseCoordinate, toCoordinateString } from './events.location-map.shared.js';

type EventLocationMapHookInput = Readonly<{
  runtime: EventMapLibreModule | null;
  styleUrl: string;
  latitude?: string;
  longitude?: string;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onError: (message: string | null) => void;
}>;

export const useEventLocationMap = ({
  runtime,
  styleUrl,
  latitude,
  longitude,
  onCoordinatesChange,
  onError,
}: EventLocationMapHookInput) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<EventMapLibreMap | null>(null);
  const markerRef = React.useRef<EventMapLibreMarker | null>(null);
  const onCoordinatesChangeRef = React.useRef(onCoordinatesChange);
  const onErrorRef = React.useRef(onError);
  const refs = React.useMemo(() => ({ containerRef, mapRef, markerRef }), []);

  React.useEffect(() => {
    onCoordinatesChangeRef.current = onCoordinatesChange;
  }, [onCoordinatesChange]);

  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const syncMarker = React.useCallback(
    (nextLatitude: string, nextLongitude: string) => {
      const parsedLatitude = parseCoordinate(nextLatitude);
      const parsedLongitude = parseCoordinate(nextLongitude);

      if (parsedLatitude === null || parsedLongitude === null) {
        markerRef.current?.remove();
        markerRef.current = null;
        return;
      }
      if (!mapRef.current || !runtime) {
        return;
      }

      const lngLat: [number, number] = [parsedLongitude, parsedLatitude];
      if (!markerRef.current) {
        const marker = new runtime.Marker({ color: 'rgb(0, 90, 158)', draggable: true }).setLngLat(lngLat).addTo(mapRef.current);
        marker.on('dragend', () => {
          const markerLngLat = marker.getLngLat();
          onCoordinatesChangeRef.current({
            latitude: toCoordinateString(markerLngLat.lat),
            longitude: toCoordinateString(markerLngLat.lng),
          });
        });
        markerRef.current = marker;
        return;
      }

      markerRef.current.setLngLat(lngLat);
    },
    [runtime],
  );

  useEventLocationMapLifecycle(refs, { runtime, styleUrl, latitude, longitude, onCoordinatesChangeRef, onErrorRef, syncMarker });
  useEventLocationMapViewport(mapRef, { latitude, longitude, syncMarker });

  return { containerRef };
};
