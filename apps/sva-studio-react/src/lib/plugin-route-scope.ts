export type PluginRouteScope = 'platform' | 'tenant';

export const PLUGIN_ROUTE_SCOPE_META_NAME = 'sva-plugin-route-scope';

export const readPluginRouteScope = (value: unknown): PluginRouteScope | null =>
  value === 'platform' || value === 'tenant' ? value : null;

export const readDocumentPluginRouteScope = (): PluginRouteScope | null => {
  if (typeof globalThis.document === 'undefined') return null;

  return readPluginRouteScope(
    globalThis.document
      .querySelector(`meta[name="${PLUGIN_ROUTE_SCOPE_META_NAME}"]`)
      ?.getAttribute('content')
  );
};
