import * as React from 'react';
import type { MapMouseEvent } from 'maplibre-gl';

import {
  defaultPoiMapZoom,
  focusedPoiMapZoom,
  resolvePoiMapCenter,
  toCoordinateString,
} from './poi.location-map.shared.js';
import type { PoiMapLibreMap, PoiMapLibreMarker, PoiMapLibreModule } from './poi.location-map.runtime.js';

type CoordinatesChangeHandler = (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;

type MapRefs = Readonly<{
  containerRef: React.RefObject<HTMLDivElement | null>;
  mapRef: React.RefObject<PoiMapLibreMap | null>;
  markerRef: React.RefObject<PoiMapLibreMarker | null>;
}>;

type MapState = Readonly<{
  runtime: PoiMapLibreModule | null;
  styleUrl: string;
  latitude?: string;
  longitude?: string;
  onCoordinatesChangeRef: React.RefObject<CoordinatesChangeHandler>;
  onErrorRef: React.RefObject<(message: string | null) => void>;
  syncMarker: (latitude: string, longitude: string) => void;
}>;

const createMapClickHandler =
  (onCoordinatesChangeRef: React.RefObject<CoordinatesChangeHandler>) =>
  (event: MapMouseEvent & object) => {
    onCoordinatesChangeRef.current?.({
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
    provider_status: candidate.error?.status,
  };
};

export const usePoiLocationMapLifecycle = (
  refs: MapRefs,
  { runtime, styleUrl, latitude, longitude, onCoordinatesChangeRef, onErrorRef, syncMarker }: MapState,
) => {
  React.useEffect(() => {
    if (!runtime || !refs.containerRef.current || refs.mapRef.current) {
      return;
    }

    try {
      const center = resolvePoiMapCenter(latitude, longitude);
      const map = new runtime.Map({
        container: refs.containerRef.current,
        style: styleUrl,
        center: [center.longitude, center.latitude],
        zoom: latitude && longitude ? focusedPoiMapZoom : defaultPoiMapZoom,
      });

      map.on('click', createMapClickHandler(onCoordinatesChangeRef));
      map.on('error', (event) => {
        console.warn('POI map render failed', {
          style_url: styleUrl,
          ...readMapErrorMeta(event),
        });
        onErrorRef.current?.('map_error');
      });

      refs.mapRef.current = map;
      onErrorRef.current?.(null);
      syncMarker(latitude ?? '', longitude ?? '');
    } catch (error) {
      console.error('POI map initialization failed', {
        style_url: styleUrl,
        error_message: error instanceof Error ? error.message : String(error),
      });
      onErrorRef.current?.('map_error');
    }

    return () => {
      refs.markerRef.current?.remove();
      refs.markerRef.current = null;
      refs.mapRef.current?.remove();
      refs.mapRef.current = null;
    };
  }, [refs, onCoordinatesChangeRef, onErrorRef, runtime, styleUrl, syncMarker]);
};

export const usePoiLocationMapViewport = (
  mapRef: React.RefObject<PoiMapLibreMap | null>,
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
