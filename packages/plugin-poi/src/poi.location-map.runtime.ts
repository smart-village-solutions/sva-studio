import type maplibregl from 'maplibre-gl';

export type PoiMapLibreModule = typeof import('maplibre-gl');
export type PoiMapLibreMap = maplibregl.Map;
export type PoiMapLibreMarker = maplibregl.Marker;

export type PoiLocationMapRuntimeLoaderDependencies = {
  readonly hasWindow: () => boolean;
  readonly loadCss: () => Promise<unknown>;
  readonly loadRuntime: () => Promise<PoiMapLibreModule>;
};

const retryableImport = <T>(load: () => Promise<T>, clear: () => void): Promise<T> =>
  load().catch((error) => {
    clear();
    throw error;
  });

export const createPoiLocationMapRuntimeLoader = (
  dependencies: PoiLocationMapRuntimeLoaderDependencies,
): (() => Promise<PoiMapLibreModule>) => {
  let runtimePromise: Promise<PoiMapLibreModule> | null = null;
  let cssPromise: Promise<unknown> | null = null;

  return async (): Promise<PoiMapLibreModule> => {
    if (!dependencies.hasWindow()) {
      throw new Error('map_runtime_unavailable');
    }

    const currentCssPromise =
      cssPromise ??= retryableImport(dependencies.loadCss, () => {
        cssPromise = null;
      });
    const currentRuntimePromise =
      runtimePromise ??= retryableImport(dependencies.loadRuntime, () => {
        runtimePromise = null;
      });

    await currentCssPromise;
    return currentRuntimePromise;
  };
};

export const loadPoiLocationMapRuntime = createPoiLocationMapRuntimeLoader({
  hasWindow: () => typeof window !== 'undefined',
  loadCss: () => import('maplibre-gl/dist/maplibre-gl.css'),
  loadRuntime: () => import('maplibre-gl'),
});
