import type maplibregl from 'maplibre-gl';

export type PoiMapLibreModule = typeof import('maplibre-gl');
export type PoiMapLibreMap = maplibregl.Map;
export type PoiMapLibreMarker = maplibregl.Marker;

let runtimePromise: Promise<PoiMapLibreModule> | null = null;
let cssPromise: Promise<unknown> | null = null;

export const loadPoiLocationMapRuntime = async (): Promise<PoiMapLibreModule> => {
  if (typeof window === 'undefined') {
    throw new Error('map_runtime_unavailable');
  }

  cssPromise ??= import('maplibre-gl/dist/maplibre-gl.css');
  runtimePromise ??= import('maplibre-gl');

  await cssPromise;
  return runtimePromise;
};
