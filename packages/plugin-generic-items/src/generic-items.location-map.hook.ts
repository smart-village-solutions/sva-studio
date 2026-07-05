import * as React from 'react';

import { useGenericItemsLocationMapLifecycle, useGenericItemsLocationMapViewport } from './generic-items.location-map.effects.js';
import { parseCoordinate, toCoordinateString } from './generic-items.location-map.shared.js';
import type {
  GenericItemsMapLibreMap,
  GenericItemsMapLibreMarker,
  GenericItemsMapLibreModule,
} from './generic-items.location-map.runtime.js';

type GenericItemsLocationMapHookInput = Readonly<{
  runtime: GenericItemsMapLibreModule | null;
  styleUrl: string;
  latitude?: string;
  longitude?: string;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onError: (message: string | null) => void;
}>;

export const useGenericItemsLocationMap = ({
  runtime,
  styleUrl,
  latitude,
  longitude,
  onCoordinatesChange,
  onError,
}: GenericItemsLocationMapHookInput) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<GenericItemsMapLibreMap | null>(null);
  const markerRef = React.useRef<GenericItemsMapLibreMarker | null>(null);
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

  useGenericItemsLocationMapLifecycle(refs, {
    runtime,
    styleUrl,
    latitude,
    longitude,
    onCoordinatesChangeRef,
    onErrorRef,
    syncMarker,
  });
  useGenericItemsLocationMapViewport(mapRef, { latitude, longitude, syncMarker });

  return { containerRef };
};
