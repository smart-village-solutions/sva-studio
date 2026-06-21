import * as React from 'react';
import maplibregl from 'maplibre-gl';

import { usePoiLocationMapLifecycle, usePoiLocationMapViewport } from './poi.location-map.effects.js';
import { parseCoordinate, toCoordinateString } from './poi.location-map.shared.js';

type PoiLocationMapHookInput = Readonly<{
  styleUrl: string;
  latitude?: string;
  longitude?: string;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onError: (message: string | null) => void;
}>;

export const usePoiLocationMap = ({
  styleUrl,
  latitude,
  longitude,
  onCoordinatesChange,
  onError,
}: PoiLocationMapHookInput) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const markerRef = React.useRef<maplibregl.Marker | null>(null);

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

      const lngLat: [number, number] = [parsedLongitude, parsedLatitude];
      if (!markerRef.current) {
        const marker = new maplibregl.Marker({ color: 'rgb(0, 90, 158)', draggable: true }).setLngLat(lngLat).addTo(mapRef.current);
        marker.on('dragend', () => {
          const markerLngLat = marker.getLngLat();
          onCoordinatesChange({
            latitude: toCoordinateString(markerLngLat.lat),
            longitude: toCoordinateString(markerLngLat.lng),
          });
        });
        markerRef.current = marker;
        return;
      }

      markerRef.current.setLngLat(lngLat);
    },
    [onCoordinatesChange],
  );

  usePoiLocationMapLifecycle(
    { containerRef, mapRef, markerRef },
    { styleUrl, latitude, longitude, onCoordinatesChange, onError, syncMarker },
  );
  usePoiLocationMapViewport(mapRef, { latitude, longitude, syncMarker });

  return { containerRef };
};
