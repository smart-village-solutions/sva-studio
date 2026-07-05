import type * as maplibregl from 'maplibre-gl';

export type GenericItemsMapLibreModule = typeof import('maplibre-gl');
export type GenericItemsMapLibreMap = maplibregl.Map;
export type GenericItemsMapLibreMarker = maplibregl.Marker;

export type GenericItemsLocationMapRuntimeLoaderDependencies = {
  readonly hasWindow: () => boolean;
  readonly loadCss: () => Promise<unknown>;
  readonly loadRuntime: () => Promise<GenericItemsMapLibreModule>;
};

const retryableImport = <T>(load: () => Promise<T>, clear: () => void): Promise<T> =>
  load().catch((error) => {
    clear();
    throw error;
  });

export const createGenericItemsLocationMapRuntimeLoader = (
  dependencies: GenericItemsLocationMapRuntimeLoaderDependencies,
): (() => Promise<GenericItemsMapLibreModule>) => {
  let runtimePromise: Promise<GenericItemsMapLibreModule> | null = null;
  let cssPromise: Promise<unknown> | null = null;

  return async (): Promise<GenericItemsMapLibreModule> => {
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

    const [, runtime] = await Promise.all([currentCssPromise, currentRuntimePromise]);
    return runtime;
  };
};

export const loadGenericItemsLocationMapRuntime = createGenericItemsLocationMapRuntimeLoader({
  hasWindow: () => typeof window !== 'undefined',
  loadCss: () => import('maplibre-gl/dist/maplibre-gl.css'),
  loadRuntime: () => import('maplibre-gl'),
});
