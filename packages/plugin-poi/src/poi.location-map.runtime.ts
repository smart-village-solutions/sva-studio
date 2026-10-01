import type * as maplibregl from 'maplibre-gl';

export type PoiMapLibreModule = typeof import('maplibre-gl');
export type PoiMapLibreMap = maplibregl.Map;
export type PoiMapLibreMarker = maplibregl.Marker;

export type PoiLocationMapRuntimeLoaderDependencies = {
  readonly hasWindow: () => boolean;
  readonly loadCss: () => Promise<unknown>;
  readonly loadRuntime: () => Promise<PoiMapLibreModule>;
  readonly loadWorkerUrl: () => Promise<string>;
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
      runtimePromise ??= retryableImport(async () => {
        const [runtime, workerUrl] = await Promise.all([
          dependencies.loadRuntime(),
          dependencies.loadWorkerUrl(),
        ]);
        runtime.setWorkerUrl(workerUrl);
        return runtime;
      }, () => {
        runtimePromise = null;
      });

    const [, runtime] = await Promise.all([currentCssPromise, currentRuntimePromise]);
    return runtime;
  };
};

export const loadPoiLocationMapRuntime = createPoiLocationMapRuntimeLoader({
  hasWindow: () => typeof window !== 'undefined',
  loadCss: () => import('maplibre-gl/dist/maplibre-gl.css'),
  loadRuntime: () => import('maplibre-gl'),
  loadWorkerUrl: () =>
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url').then((module) => module.default),
});
