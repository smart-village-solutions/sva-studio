import {
  createMainserverCrudClient,
  createMainserverReadHeaders,
  MainserverApiError,
  requestMainserverJson,
  type MainserverActingPrincipalType,
} from '@sva/plugin-sdk';
import type {
  ConstructionSiteInput,
  ConstructionSiteRecord,
  ConstructionSiteList,
} from './contract.js';
export type ConstructionSiteWrite =
  { site: ConstructionSiteInput; baseFingerprint?: string } | { recover: true; inputHash: string };
const client = createMainserverCrudClient<
  ConstructionSiteRecord,
  ConstructionSiteWrite,
  ConstructionSiteList,
  ConstructionSiteList
>({
  basePath: '/api/v1/mainserver/construction-sites',
  errorFactory: (code, message) => new MainserverApiError(code, message),
  mapListResponse: (response) => response,
});
export const getConstructionSite = client.getDetail;
export const saveConstructionSite = (
  id: string | undefined,
  body: ConstructionSiteWrite,
  principal: MainserverActingPrincipalType,
  operationId: string
) =>
  id
    ? client.update(id, body, principal, { operationId })
    : client.create(body, principal, { operationId });
export const listConstructionSites = (
  query: Record<string, string | number>,
  principal: MainserverActingPrincipalType = 'user'
) =>
  requestMainserverJson<ConstructionSiteList>({
    init: { headers: createMainserverReadHeaders(principal) },
    url: `/api/v1/mainserver/construction-sites?${new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))}`,
  });
export const listConstructionSiteCategories = async () =>
  (
    await requestMainserverJson<{ data: readonly { id: string; name: string }[] }>({
      url: '/api/v1/mainserver/categories?dataType=generic_item_construction_site',
    })
  ).data;
// Only the operation identity is persisted, never editorial content or credentials.
export type ConstructionSitePending = Readonly<{
  operationId: string;
  inputHash: string;
  id?: string;
}>;
export function readConstructionSitePending(key: string): ConstructionSitePending | undefined {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!value || typeof value !== 'object' || !('operationId' in value) || !('inputHash' in value))
      return undefined;
    const { operationId, inputHash } = value;
    if (
      typeof operationId !== 'string' ||
      typeof inputHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(inputHash)
    )
      return undefined;
    return {
      operationId,
      inputHash,
      ...('id' in value && typeof value.id === 'string' ? { id: value.id } : {}),
    };
  } catch {
    return undefined;
  }
}
export async function constructionSiteRequestHash(body: ConstructionSiteWrite) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(body))
  );
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function constructionSiteRejection(error: unknown): string | undefined {
  if (!(error instanceof MainserverApiError)) return undefined;
  return [
    'construction_site_content_conflict',
    'construction_site_invalid_input',
    'construction_site_media_unavailable',
    'construction_site_not_found',
    'construction_site_incomplete',
    'construction_site_dependents_unsupported',
    'forbidden',
    'csrf_validation_failed',
    'stale_mainserver_context',
    'mainserver_context_binding_missing',
  ].includes(error.code)
    ? error.code
    : undefined;
}
