import * as React from 'react';
import maplibregl from 'maplibre-gl';

import {
  defaultPoiMapZoom,
  focusedPoiMapZoom,
  resolvePoiMapCenter,
  toCoordinateString,
} from './poi.location-map.shared.js';

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

const readMapErrorMeta = (error: unknown): Record<string, unknown> => {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const candidate = error as {
    error?: { message?: string; status?: number; url?: string };
    sourceId?: string;
    tile?: unknown;
  };

  return {
    source_id: candidate.sourceId,
    tile: candidate.tile,
    provider_message: candidate.error?.message,
    provider_status: candidate.error?.status,
    provider_url: candidate.error?.url,
  };
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
        zoom: latitude && longitude ? focusedPoiMapZoom : defaultPoiMapZoom,
        attributionControl: false,
      });

      map.on('click', createMapClickHandler(onCoordinatesChange));
      map.on('error', (event) => {
        console.warn('POI map render failed', {
          style_url: styleUrl,
          latitude,
          longitude,
          ...readMapErrorMeta(event),
        });
        onError('map_error');
      });

      refs.mapRef.current = map;
      onError(null);
      syncMarker(latitude ?? '', longitude ?? '');
    } catch (error) {
      console.error('POI map initialization failed', {
        style_url: styleUrl,
        latitude,
        longitude,
        error_message: error instanceof Error ? error.message : String(error),
      });
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
    mapRef.current.setZoom(latitude && longitude ? focusedPoiMapZoom : defaultPoiMapZoom);
    syncMarker(latitude ?? '', longitude ?? '');
  }, [latitude, longitude, mapRef, syncMarker]);
};
