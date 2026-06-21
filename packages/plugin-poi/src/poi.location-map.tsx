import * as React from 'react';
import maplibregl from 'maplibre-gl';

const defaultCenter = { latitude: 52.52, longitude: 13.405 } as const;

const toCoordinateString = (value: number): string => value.toFixed(6);

const parseCoordinate = (value?: string): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveCenter = (latitude?: string, longitude?: string) => {
  const parsedLatitude = parseCoordinate(latitude);
  const parsedLongitude = parseCoordinate(longitude);

  if (parsedLatitude === null || parsedLongitude === null) {
    return defaultCenter;
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
};

export function PoiLocationMap({
  styleUrl,
  latitude,
  longitude,
  onCoordinatesChange,
  onError,
}: Readonly<{
  styleUrl: string;
  latitude?: string;
  longitude?: string;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onError: (message: string | null) => void;
}>) {
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
        const marker = new maplibregl.Marker({
          color: 'rgb(0, 90, 158)',
          draggable: true,
        })
          .setLngLat(lngLat)
          .addTo(mapRef.current);

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

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    try {
      const center = resolveCenter(latitude, longitude);
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [center.longitude, center.latitude],
        zoom: latitude && longitude ? 15 : 5,
        attributionControl: false,
      });

      map.on('click', (event) => {
        onCoordinatesChange({
          latitude: toCoordinateString(event.lngLat.lat),
          longitude: toCoordinateString(event.lngLat.lng),
        });
      });
      map.on('error', () => {
        onError('map_error');
      });

      mapRef.current = map;
      onError(null);
      syncMarker(latitude ?? '', longitude ?? '');
    } catch {
      onError('map_error');
    }

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [onCoordinatesChange, onError, styleUrl, syncMarker]);

  React.useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const center = resolveCenter(latitude, longitude);
    mapRef.current.setCenter([center.longitude, center.latitude]);
    if (latitude && longitude) {
      mapRef.current.setZoom(15);
    }
    syncMarker(latitude ?? '', longitude ?? '');
  }, [latitude, longitude, syncMarker]);

  return <div ref={containerRef} className="min-h-[320px] w-full overflow-hidden rounded-xl border border-border/70" />;
}
