import * as React from 'react';
import { isStudioMapstickStyle, prepareStudioMapRuntime } from './studio-map-style.js';

export const studioLocationMapDefaultCenter = {
  latitude: 51.163361,
  longitude: 10.447683,
} as const;
export const studioLocationMapDefaultZoom = 5.8;
export const studioLocationMapFocusedZoom = 19;

export const toStudioCoordinateString = (value: number): string => value.toFixed(6);

export const parseStudioCoordinate = (value?: string): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type StudioLocationMapCoordinates = Readonly<{ latitude: string; longitude: string }>;
type StudioLocationMapClickEvent = Readonly<{ lngLat: Readonly<{ lat: number; lng: number }> }>;

type StudioLocationMapInstance = {
  on(eventName: 'click', handler: (event: StudioLocationMapClickEvent) => void): unknown;
  on(eventName: 'error', handler: () => void): unknown;
  setStyle(style: string): unknown;
  setCenter(center: [number, number]): unknown;
  setZoom(zoom: number): unknown;
  remove(): void;
};

type StudioLocationMapMarker = {
  setLngLat(coordinates: [number, number]): StudioLocationMapMarker;
  addTo(map: StudioLocationMapInstance): StudioLocationMapMarker;
  on(eventName: 'dragend', handler: () => void): unknown;
  getLngLat(): Readonly<{ lat: number; lng: number }>;
  remove(): void;
};

export type StudioLocationMapRuntime = {
  readonly addProtocol?: Parameters<typeof prepareStudioMapRuntime>[0]['addProtocol'];
  readonly Map: new (options: {
    container: HTMLDivElement;
    style: string;
    center: [number, number];
    zoom: number;
  }) => StudioLocationMapInstance;
  readonly Marker: new (options: { color: string; draggable: boolean }) => StudioLocationMapMarker;
};

export type StudioLocationMapInput = Readonly<{
  runtime: StudioLocationMapRuntime | null;
  styleUrl: string;
  latitude?: string;
  longitude?: string;
  onCoordinatesChange: (coordinates: StudioLocationMapCoordinates) => void;
  onError: (message: string | null) => void;
}>;

const resolveMapCenter = (latitude?: string, longitude?: string) => {
  const parsedLatitude = parseStudioCoordinate(latitude);
  const parsedLongitude = parseStudioCoordinate(longitude);
  return parsedLatitude === null || parsedLongitude === null
    ? studioLocationMapDefaultCenter
    : { latitude: parsedLatitude, longitude: parsedLongitude };
};

type StudioLocationMapMutableRef<T> = { current: T };

const syncStudioLocationMarker = ({
  latitude,
  longitude,
  mapRef,
  markerRef,
  onCoordinatesChangeRef,
  runtime,
}: Readonly<{
  latitude: string;
  longitude: string;
  mapRef: StudioLocationMapMutableRef<StudioLocationMapInstance | null>;
  markerRef: StudioLocationMapMutableRef<StudioLocationMapMarker | null>;
  onCoordinatesChangeRef: StudioLocationMapMutableRef<
    (coordinates: StudioLocationMapCoordinates) => void
  >;
  runtime: StudioLocationMapRuntime | null;
}>) => {
  const parsedLatitude = parseStudioCoordinate(latitude);
  const parsedLongitude = parseStudioCoordinate(longitude);
  if (parsedLatitude === null || parsedLongitude === null) {
    markerRef.current?.remove();
    markerRef.current = null;
    return;
  }
  if (!mapRef.current || !runtime) return;

  const coordinates: [number, number] = [parsedLongitude, parsedLatitude];
  if (!markerRef.current) {
    const marker = new runtime.Marker({ color: 'rgb(0, 90, 158)', draggable: true })
      .setLngLat(coordinates)
      .addTo(mapRef.current);
    marker.on('dragend', () => {
      const markerCoordinates = marker.getLngLat();
      onCoordinatesChangeRef.current({
        latitude: toStudioCoordinateString(markerCoordinates.lat),
        longitude: toStudioCoordinateString(markerCoordinates.lng),
      });
    });
    markerRef.current = marker;
    return;
  }

  markerRef.current.setLngLat(coordinates);
};

const createStudioLocationMap = (
  runtime: StudioLocationMapRuntime,
  container: HTMLDivElement,
  initial: Pick<StudioLocationMapInput, 'styleUrl' | 'latitude' | 'longitude'>,
  onCoordinatesChange: StudioLocationMapInput['onCoordinatesChange'],
  onError: StudioLocationMapInput['onError']
) => {
  const center = resolveMapCenter(initial.latitude, initial.longitude);
  const map = new runtime.Map({
    container,
    style: initial.styleUrl,
    center: [center.longitude, center.latitude],
    zoom:
      initial.latitude && initial.longitude
        ? studioLocationMapFocusedZoom
        : studioLocationMapDefaultZoom,
  });
  map.on('click', (event) => {
    onCoordinatesChange({
      latitude: toStudioCoordinateString(event.lngLat.lat),
      longitude: toStudioCoordinateString(event.lngLat.lng),
    });
  });
  map.on('error', () => onError('map_error'));
  return map;
};

const updateMapStyle = (
  map: StudioLocationMapInstance | null, currentStyle: { current: string },
  styleUrl: string, onError: StudioLocationMapInput['onError']
) => {
  if (!map || currentStyle.current === styleUrl) return;
  try {
    map.setStyle(styleUrl);
    currentStyle.current = styleUrl;
  } catch {
    onError('map_error');
  }
};

export const useStudioLocationMap = ({
  runtime,
  styleUrl,
  latitude,
  longitude,
  onCoordinatesChange,
  onError,
}: StudioLocationMapInput) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<StudioLocationMapInstance | null>(null);
  const markerRef = React.useRef<StudioLocationMapMarker | null>(null);
  const onCoordinatesChangeRef = React.useRef(onCoordinatesChange);
  const onErrorRef = React.useRef(onError);
  const currentStyleRef = React.useRef(styleUrl);
  const latestInputRef = React.useRef({ styleUrl, latitude, longitude });
  React.useEffect(() => {
    latestInputRef.current = { styleUrl, latitude, longitude };
    onCoordinatesChangeRef.current = onCoordinatesChange;
    onErrorRef.current = onError;
  }, [styleUrl, latitude, longitude, onCoordinatesChange, onError]);

  const syncMarker = React.useCallback(
    (latitude: string, longitude: string) => syncStudioLocationMarker({
      latitude, longitude, mapRef, markerRef, onCoordinatesChangeRef, runtime,
    }),
    [runtime]
  );

  React.useEffect(() => {
    if (!runtime || !containerRef.current) return;

    let active = true;
    const createMap = () => {
      if (!active || !containerRef.current) return;
      try {
        const initial = latestInputRef.current;
        const map = createStudioLocationMap(runtime, containerRef.current, initial,
          (coordinates) => onCoordinatesChangeRef.current(coordinates),
          (error) => onErrorRef.current(error));
        mapRef.current = map;
        currentStyleRef.current = initial.styleUrl;
        onErrorRef.current(null);
        syncMarker(initial.latitude ?? '', initial.longitude ?? '');
      } catch {
        onErrorRef.current('map_error');
      }
    };
    if (isStudioMapstickStyle(styleUrl)) {
      void prepareStudioMapRuntime(runtime)
        .then(createMap)
        .catch(() => {
          if (active) onErrorRef.current('map_error');
        });
    } else createMap();

    return () => {
      active = false;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [runtime, syncMarker]);

  React.useEffect(() => {
    updateMapStyle(mapRef.current, currentStyleRef, styleUrl, onErrorRef.current);
  }, [styleUrl]);

  React.useEffect(() => {
    if (!mapRef.current) return;
    const center = resolveMapCenter(latitude, longitude);
    mapRef.current.setCenter([center.longitude, center.latitude]);
    mapRef.current.setZoom(
      latitude && longitude ? studioLocationMapFocusedZoom : studioLocationMapDefaultZoom
    );
    syncMarker(latitude ?? '', longitude ?? '');
  }, [latitude, longitude, syncMarker]);

  return { containerRef };
};
