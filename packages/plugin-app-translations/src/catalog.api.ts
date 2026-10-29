import {
  MainserverApiError,
  createMainserverJsonRequestHeaders,
  requestMainserverJson,
} from '@sva/plugin-sdk';
import type { CatalogScope } from '@sva/plugin-sdk/app-translations';

export const requestCatalog = async <T>(
  operation: Readonly<Record<string, unknown>>,
  scope?: CatalogScope,
  signal?: AbortSignal,
  mode: 'source' | 'translations' = 'source'
): Promise<T> => {
  const read = ['overview', 'read', 'readRelease', 'translationStatus'].includes(
    String(operation.operation)
  );
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

export const requestCatalogDownload = async (
  releaseId: string,
  scope: CatalogScope,
  signal: AbortSignal,
  mode: 'source' | 'translations'
): Promise<Blob> => {
  const headers = createMainserverJsonRequestHeaders();
  headers.set('X-SVA-Catalog-Mode', mode);
  headers.set('X-SVA-Catalog-Scope', JSON.stringify(scope));
  const query = new URLSearchParams({ operation: 'downloadTexts', releaseId });
  const response = await fetch(`/api/v1/iam/app-translations?${query}`, {
    method: 'GET',
    headers,
    signal,
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new MainserverApiError(body?.error ?? 'catalog_unavailable');
  }
  if (
    !response.headers.get('Content-Type')?.startsWith('text/javascript') ||
    Number(response.headers.get('Content-Length')) > 8 * 1024 * 1024
  ) {
    throw new MainserverApiError('catalog_export_incompatible');
  }
  const blob = await response.blob();
  if (blob.size > 8 * 1024 * 1024) throw new MainserverApiError('catalog_export_incompatible');
  return blob;
};
