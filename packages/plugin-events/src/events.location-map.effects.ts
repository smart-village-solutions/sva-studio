import * as React from 'react';
import type { MapMouseEvent } from 'maplibre-gl';

import {
  defaultEventMapZoom,
  focusedEventMapZoom,
  resolveEventMapCenter,
  toCoordinateString,
} from './events.location-map.shared.js';
import type { EventMapLibreMap, EventMapLibreMarker, EventMapLibreModule } from './events.location-map.runtime.js';

type CoordinatesChangeHandler = (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;

type MapRefs = Readonly<{
  containerRef: React.RefObject<HTMLDivElement | null>;
  mapRef: React.RefObject<EventMapLibreMap | null>;
  markerRef: React.RefObject<EventMapLibreMarker | null>;
}>;

type MapState = Readonly<{
  runtime: EventMapLibreModule | null;
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

export const useEventLocationMapLifecycle = (
  refs: MapRefs,
  { runtime, styleUrl, latitude, longitude, onCoordinatesChangeRef, onErrorRef, syncMarker }: MapState,
) => {
  React.useEffect(() => {
    if (!runtime || !refs.containerRef.current || refs.mapRef.current) {
      return;
    }

    try {
      const center = resolveEventMapCenter(latitude, longitude);
      const map = new runtime.Map({
        container: refs.containerRef.current,
        style: styleUrl,
        center: [center.longitude, center.latitude],
        zoom: latitude && longitude ? focusedEventMapZoom : defaultEventMapZoom,
      });

      map.on('click', createMapClickHandler(onCoordinatesChangeRef));
      map.on('error', () => {
        onErrorRef.current?.('map_error');
      });

      refs.mapRef.current = map;
      onErrorRef.current?.(null);
      syncMarker(latitude ?? '', longitude ?? '');
    } catch {
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

export const useEventLocationMapViewport = (
  mapRef: React.RefObject<EventMapLibreMap | null>,
  { latitude, longitude, syncMarker }: Pick<MapState, 'latitude' | 'longitude' | 'syncMarker'>,
) => {
  React.useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const center = resolveEventMapCenter(latitude, longitude);
    mapRef.current.setCenter([center.longitude, center.latitude]);
    mapRef.current.setZoom(latitude && longitude ? focusedEventMapZoom : defaultEventMapZoom);
    syncMarker(latitude ?? '', longitude ?? '');
  }, [latitude, longitude, mapRef, syncMarker]);
};
