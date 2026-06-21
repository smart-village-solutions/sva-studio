import * as React from 'react';
import maplibregl from 'maplibre-gl';

import { resolvePoiMapCenter, toCoordinateString } from './poi.location-map.shared.js';

type CoordinatesChangeHandler = (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;

type MapRefs = Readonly<{
  containerRef: React.RefObject<HTMLDivElement | null>;
  mapRef: React.RefObject<maplibregl.Map | null>;
  markerRef: React.RefObject<maplibregl.Marker | null>;
}>;

type MapState = Readonly<{
  styleUrl: string;
  latitude?: string;
  longitude?: string;
  onCoordinatesChange: CoordinatesChangeHandler;
  onError: (message: string | null) => void;
  syncMarker: (latitude: string, longitude: string) => void;
}>;

const createMapClickHandler =
  (onCoordinatesChange: CoordinatesChangeHandler) =>
  (event: maplibregl.MapMouseEvent & object) => {
    onCoordinatesChange({
      latitude: toCoordinateString(event.lngLat.lat),
      longitude: toCoordinateString(event.lngLat.lng),
    });
  };

export const usePoiLocationMapLifecycle = (
  refs: MapRefs,
  { styleUrl, latitude, longitude, onCoordinatesChange, onError, syncMarker }: MapState,
) => {
  React.useEffect(() => {
    if (!refs.containerRef.current || refs.mapRef.current) {
      return;
    }

    try {
      const center = resolvePoiMapCenter(latitude, longitude);
      const map = new maplibregl.Map({
        container: refs.containerRef.current,
        style: styleUrl,
        center: [center.longitude, center.latitude],
        zoom: latitude && longitude ? 15 : 5,
        attributionControl: false,
      });

      map.on('click', createMapClickHandler(onCoordinatesChange));
      map.on('error', () => onError('map_error'));

      refs.mapRef.current = map;
      onError(null);
      syncMarker(latitude ?? '', longitude ?? '');
    } catch {
      onError('map_error');
    }

    return () => {
      refs.markerRef.current?.remove();
      refs.markerRef.current = null;
      refs.mapRef.current?.remove();
      refs.mapRef.current = null;
    };
  }, [refs, latitude, longitude, onCoordinatesChange, onError, styleUrl, syncMarker]);
};

export const usePoiLocationMapViewport = (
  mapRef: React.RefObject<maplibregl.Map | null>,
  { latitude, longitude, syncMarker }: Pick<MapState, 'latitude' | 'longitude' | 'syncMarker'>,
) => {
  React.useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const center = resolvePoiMapCenter(latitude, longitude);
    mapRef.current.setCenter([center.longitude, center.latitude]);
    if (latitude && longitude) {
      mapRef.current.setZoom(15);
    }
    syncMarker(latitude ?? '', longitude ?? '');
  }, [latitude, longitude, mapRef, syncMarker]);
};
