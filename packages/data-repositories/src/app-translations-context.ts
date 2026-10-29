/** Catalog scope settings and shared transaction-bound repository context. */

import {
  catalogAssert,
  type AppTranslationLocale,
  type CatalogManifest,
  type CatalogDraft,
  type CatalogRelease,
  type CatalogScope,
  type CatalogTexts,
} from '@sva/core';

export type CatalogSqlClient = {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};
type DraftRow = {
  id: string;
  manifest_id: string;
  manifest: CatalogManifest;
  draft_revision: string;
  supported_locales: AppTranslationLocale[];
  values_by_locale: CatalogTexts;
  machine_standard_values_by_locale: CatalogTexts;
  base_release_id: string | null;
};
export const catalogUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export const catalogRevision = (value: unknown) =>
  catalogAssert(typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/.test(value));
export const catalogContract = (value: unknown) =>
  catalogAssert(typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value));

type CatalogRepositoryScope = {
  client: CatalogSqlClient;
  scope: CatalogScope;
  instanceId: string | null;
  organizationId: string | null;
  params: (string | null)[];
  scopeWhere: string;
};
export const createCatalogRepositoryContext = async (
  client: CatalogSqlClient,
  scope: CatalogScope
) => {
  catalogAssert(scope.kind === 'global' || scope.kind === 'municipal');
  if (scope.kind === 'municipal')
    catalogAssert(
      typeof scope.instanceId === 'string' &&
        scope.instanceId.length > 0 &&
        scope.instanceId.length <= 128 &&
        catalogUuid(scope.organizationId)
    );
  const instanceId = scope.kind === 'municipal' ? scope.instanceId : null;
  const organizationId = scope.kind === 'municipal' ? scope.organizationId : null;
  await client.query(
    "SELECT set_config('app.instance_id', $1, true), set_config('app.organization_id', $2, true), set_config('app.catalog_platform', $3, true)",
    [instanceId ?? '', organizationId ?? '', scope.kind === 'global' ? 'true' : 'false']
  );
  const params = [scope.kind, instanceId, organizationId];
  const scopeWhere =
    'scope = $1 AND instance_id IS NOT DISTINCT FROM $2::text AND organization_id IS NOT DISTINCT FROM $3::uuid';
  const context = { client, scope, instanceId, organizationId, params, scopeWhere };
  return {
    ...context,
    loadDraft: (
      ...args: Parameters<typeof loadDraft> extends [unknown, ...infer Rest] ? Rest : never
    ) => loadDraft(context, ...args),
    loadRelease: (
      ...args: Parameters<typeof loadRelease> extends [unknown, ...infer Rest] ? Rest : never
    ) => loadRelease(context, ...args),
    baseOf: (...args: Parameters<typeof baseOf> extends [unknown, ...infer Rest] ? Rest : never) =>
      baseOf(context, ...args),
    save: (...args: Parameters<typeof save> extends [unknown, ...infer Rest] ? Rest : never) =>
      save(context, ...args),
    locked: (...args: Parameters<typeof locked> extends [unknown, ...infer Rest] ? Rest : never) =>
      locked(context, ...args),
  };
};
export type CatalogRepositoryContext = Awaited<ReturnType<typeof createCatalogRepositoryContext>>;

/** Catalog reads and optimistic writes on the existing transaction. */

const loadDraft = async (
  context: CatalogRepositoryScope,
  contractId: string,
  lock = false
): Promise<CatalogDraft> => {
  const { client, scope, params, scopeWhere } = context;

  catalogContract(contractId);
  const result = await client.query<DraftRow>(
    `SELECT d.*, d.draft_revision::text, m.manifest FROM iam.app_translation_catalog_drafts d JOIN iam.app_translation_manifests m ON m.id = d.manifest_id WHERE ${scopeWhere} AND d.contract_id = $4 ${lock ? 'FOR UPDATE OF d' : ''}`,
    [...params, contractId]
  );
  const row = result.rows[0];
  catalogAssert(row, 'catalog_not_found');
  return {
    id: row.id,
    scope,
    manifestId: row.manifest_id,
    manifest: row.manifest,
    draftRevision: row.draft_revision,
    supportedLocales: row.supported_locales,
    valuesByLocale: row.values_by_locale,
    machineStandardValuesByLocale: row.machine_standard_values_by_locale ?? {},
    baseReleaseId: row.base_release_id,
  };
};
const loadRelease = async (
  context: CatalogRepositoryScope,
  id: string,
  globalOnly = false
): Promise<CatalogRelease> => {
  const { client, params } = context;

  catalogAssert(catalogUuid(id));
  const result = await client.query<{ payload: CatalogRelease }>(
    `SELECT payload FROM iam.app_translation_catalog_releases WHERE id = $1 AND ${globalOnly ? "scope = 'global'" : '(scope = $2 AND instance_id IS NOT DISTINCT FROM $3::text AND organization_id IS NOT DISTINCT FROM $4::uuid)'}`,
    globalOnly ? [id] : [id, ...params]
  );
  const release = result.rows[0]?.payload;
  catalogAssert(release, 'catalog_not_found');
  return release;
};
const baseOf = (context: CatalogRepositoryScope, draft: CatalogDraft) => {
  return draft.baseReleaseId
    ? loadRelease(context, draft.baseReleaseId, true)
    : Promise.resolve(null);
};
const save = async (
  context: CatalogRepositoryScope,
  draft: CatalogDraft
): Promise<CatalogDraft> => {
  const { client } = context;

  const result = await client.query(
    `UPDATE iam.app_translation_catalog_drafts SET manifest_id = $2, supported_locales = $3::jsonb, values_by_locale = $4::jsonb, base_release_id = $5, machine_standard_values_by_locale = $7::jsonb, draft_revision = draft_revision + 1, updated_at = now() WHERE id = $1 AND draft_revision = $6::bigint RETURNING id`,
    [
      draft.id,
      draft.manifestId,
      JSON.stringify(draft.supportedLocales),
      JSON.stringify(draft.valuesByLocale),
      draft.baseReleaseId,
      draft.draftRevision,
      JSON.stringify(draft.machineStandardValuesByLocale ?? {}),
    ]
  );
  catalogAssert(result.rowCount === 1, 'catalog_conflict');
  return loadDraft(context, draft.manifest.contractId);
};
const locked = async (
  context: CatalogRepositoryScope,
  contractId: string,
  expectedRevision: string
) => {
  catalogRevision(expectedRevision);
  const draft = await loadDraft(context, contractId, true);
  catalogAssert(draft.draftRevision === expectedRevision, 'catalog_conflict');
  return draft;
};
