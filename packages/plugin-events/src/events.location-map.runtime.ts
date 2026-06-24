import type * as maplibregl from 'maplibre-gl';

export type EventMapLibreModule = typeof import('maplibre-gl');
export type EventMapLibreMap = maplibregl.Map;
export type EventMapLibreMarker = maplibregl.Marker;

export type EventLocationMapRuntimeLoaderDependencies = {
  readonly hasWindow: () => boolean;
  readonly loadCss: () => Promise<unknown>;
  readonly loadRuntime: () => Promise<EventMapLibreModule>;
};

const retryableImport = <T>(load: () => Promise<T>, clear: () => void): Promise<T> =>
  load().catch((error) => {
    clear();
    throw error;
  });

export const createEventLocationMapRuntimeLoader = (
  dependencies: EventLocationMapRuntimeLoaderDependencies,
): (() => Promise<EventMapLibreModule>) => {
  let runtimePromise: Promise<EventMapLibreModule> | null = null;
  let cssPromise: Promise<unknown> | null = null;

  return async (): Promise<EventMapLibreModule> => {
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

export const loadEventLocationMapRuntime = createEventLocationMapRuntimeLoader({
  hasWindow: () => typeof window !== 'undefined',
  loadCss: () => import('maplibre-gl/dist/maplibre-gl.css'),
  loadRuntime: () => import('maplibre-gl'),
});
