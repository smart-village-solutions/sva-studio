import { createMainserverJsonRequestHeaders, requestMainserverJson } from '@sva/plugin-sdk';
import type { CatalogScope } from '@sva/plugin-sdk/app-translations';

export const requestCatalog = async <T>(
  operation: Readonly<Record<string, unknown>>,
  scope?: CatalogScope,
  signal?: AbortSignal,
  mode: 'source' | 'translations' = 'source'
): Promise<T> => {
  const read = ['overview', 'read', 'readRelease'].includes(String(operation.operation));
  const headers = createMainserverJsonRequestHeaders();
  headers.set('X-SVA-Catalog-Mode', mode);
  if (scope) headers.set('X-SVA-Catalog-Scope', JSON.stringify(scope));
  const query = new URLSearchParams();
  if (read) for (const [key, value] of Object.entries(operation)) query.set(key, String(value));
  const result = await requestMainserverJson<{ data: T }>({
    url: `/api/v1/iam/app-translations${read ? `?${query}` : ''}`,
    init: {
      method: read ? 'GET' : 'POST',
      headers,
      cache: 'no-store',
      signal,
      ...(read ? {} : { body: JSON.stringify(operation) }),
    },
  });
  return result.data;
};
