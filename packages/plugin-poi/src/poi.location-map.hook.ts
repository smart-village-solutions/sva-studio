import * as React from 'react';
import type { PoiMapLibreMap, PoiMapLibreMarker, PoiMapLibreModule } from './poi.location-map.runtime.js';

import { usePoiLocationMapLifecycle, usePoiLocationMapViewport } from './poi.location-map.effects.js';
import { parseCoordinate, toCoordinateString } from './poi.location-map.shared.js';

type PoiLocationMapHookInput = Readonly<{
  runtime: PoiMapLibreModule | null;
  styleUrl: string;
  latitude?: string;
  longitude?: string;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onError: (message: string | null) => void;
}>;

export const usePoiLocationMap = ({
  runtime,
  styleUrl,
  latitude,
  longitude,
  onCoordinatesChange,
  onError,
}: PoiLocationMapHookInput) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<PoiMapLibreMap | null>(null);
  const markerRef = React.useRef<PoiMapLibreMarker | null>(null);
  const onCoordinatesChangeRef = React.useRef(onCoordinatesChange);
  const onErrorRef = React.useRef(onError);
  const refs = React.useMemo(
    () => ({ containerRef, mapRef, markerRef }),
    [],
  );

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
      if (!mapRef.current) {
        return;
      }
      if (!runtime) {
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

  usePoiLocationMapLifecycle(
    refs,
    { runtime, styleUrl, latitude, longitude, onCoordinatesChangeRef, onErrorRef, syncMarker },
  );
  usePoiLocationMapViewport(mapRef, { latitude, longitude, syncMarker });

  return { containerRef };
};
