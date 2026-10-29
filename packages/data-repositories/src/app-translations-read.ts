import { randomUUID } from 'node:crypto';
/** Existing catalog read operations on the caller transaction. */

import {
  catalogAssert,
  prepareCatalogRelease,
  type AppTranslationLocale,
  exportCatalogTextsJs,
  CATALOG_TEXTS_EXPORT_MAX_BYTES,
  catalogDigest,
  resolveCatalogValues,
  type CatalogManifest,
  type CatalogRelease,
  type CatalogOverview,
  type CatalogReleaseSummary,
} from '@sva/core';

import {
  catalogUuid as uuid,
  catalogRevision as revision,
  type CatalogRepositoryContext,
} from './app-translations-context.js';
export const overview = async (context: CatalogRepositoryContext): Promise<CatalogOverview> => {
  const { client, scope, params, scopeWhere } = context;

  const drafts = await client.query<CatalogOverview['catalogs'][number]>(
    `SELECT contract_id AS "contractId", draft_revision::text AS "draftRevision", supported_locales AS "supportedLocales", base_release_id AS "baseReleaseId" FROM iam.app_translation_catalog_drafts WHERE ${scopeWhere} ORDER BY contract_id`,
    params
  );
  const releaseColumns = `id, contract_id AS "contractId", catalog_set_revision::text AS "catalogSetRevision", draft_revision::text AS "draftRevision", supported_locales AS "supportedLocales", checksum`;
  const releases = await client.query<CatalogReleaseSummary>(
    `SELECT ${releaseColumns} FROM iam.app_translation_catalog_releases WHERE ${scopeWhere} ORDER BY contract_id, catalog_set_revision DESC`,
    params
  );
  const bases =
    scope.kind === 'municipal'
      ? await client.query<CatalogReleaseSummary>(
          `SELECT ${releaseColumns} FROM iam.app_translation_catalog_releases WHERE scope = 'global' ORDER BY contract_id, catalog_set_revision DESC`
        )
      : { rows: [] };
  return { scope, catalogs: drafts.rows, releases: releases.rows, bases: bases.rows };
};
export const exportTexts = async (context: CatalogRepositoryContext, id: string) => {
  const { client, scope, instanceId, organizationId } = context;

  catalogAssert(scope.kind === 'municipal', 'catalog_forbidden');
  catalogAssert(uuid(id));
  const row = await client.query<{
    manifest: CatalogManifest;
    payload: CatalogRelease | null;
    digest: string;
    manifestId: string;
    checksum: string;
    catalogSetRevision: string;
    draftRevision: string;
    supportedLocales: string[];
  }>(
    `SELECT m.manifest, m.digest, r.manifest_id AS "manifestId", r.checksum, r.catalog_set_revision::text AS "catalogSetRevision", r.draft_revision::text AS "draftRevision", r.supported_locales AS "supportedLocales", CASE WHEN octet_length(r.payload::text) <= $5 THEN r.payload ELSE NULL END AS payload
         FROM iam.app_translation_catalog_releases r JOIN iam.app_translation_manifests m ON m.id = r.manifest_id
         WHERE r.id = $1 AND r.scope = 'municipal' AND r.instance_id = $2 AND r.organization_id = $3::uuid AND r.contract_id = $4`,
    [id, instanceId, organizationId, 'sva-mobile-app-texts', CATALOG_TEXTS_EXPORT_MAX_BYTES]
  );
  const entry = row.rows[0];
  catalogAssert(entry, 'catalog_not_found');
  catalogAssert(entry.payload);
  catalogAssert(
    entry.payload.checksum === entry.checksum &&
      entry.payload.catalogSetRevision === entry.catalogSetRevision &&
      entry.payload.draftRevision === entry.draftRevision &&
      JSON.stringify(entry.payload.supportedLocales) === JSON.stringify(entry.supportedLocales) &&
      entry.payload.manifestId === entry.manifestId &&
      entry.payload.id === id &&
      entry.payload.scope.kind === 'municipal' &&
      entry.payload.scope.instanceId === instanceId &&
      entry.payload.scope.organizationId === organizationId
  );
  catalogAssert((await catalogDigest(entry.manifest)) === entry.digest);
  return exportCatalogTextsJs(entry.payload, entry.manifest);
};
export const readEffective = async (context: CatalogRepositoryContext, contractId: string) => {
  const { loadDraft, baseOf } = context;

  const draft = await loadDraft(contractId);
  const base = await baseOf(draft);
  return {
    draft,
    values: resolveCatalogValues(draft, base),
    baseCatalogs: base?.catalogs ?? {},
  };
};

/** Existing catalog seal operations on the caller transaction. */

export const seal = async (
  context: CatalogRepositoryContext,
  contractId: string,
  expectedRevision: string,
  sourceOnly = false,
  targetCodes?: Readonly<Record<string, string>>
): Promise<CatalogRelease> => {
  const { client, scope, params, scopeWhere, baseOf, locked } = context;

  const stored = await locked(contractId, expectedRevision);
  const draft = sourceOnly
    ? {
        ...stored,
        supportedLocales: ['de'] as AppTranslationLocale[],
        valuesByLocale: { de: stored.valuesByLocale.de ?? {} },
        machineStandardValuesByLocale: {},
      }
    : stored;
  const existing = await client.query<{ payload: CatalogRelease }>(
    `SELECT payload FROM iam.app_translation_catalog_releases WHERE ${scopeWhere} AND contract_id = $4 AND draft_revision = $5::bigint AND supported_locales = $6::jsonb`,
    [...params, contractId, draft.draftRevision, JSON.stringify(draft.supportedLocales)]
  );
  if (existing.rows[0]) {
    await prepareCatalogRelease(
      draft,
      await baseOf(draft),
      existing.rows[0].payload.catalogSetRevision,
      targetCodes
    );
    return existing.rows[0].payload;
  }
  const current = await client.query<{ revision: string }>(
    `SELECT coalesce(max(catalog_set_revision),0)::text AS revision FROM iam.app_translation_catalog_releases WHERE ${scopeWhere} AND contract_id = $4`,
    [...params, contractId]
  );
  const nextRevision = (BigInt(current.rows[0]?.revision ?? '0') + 1n).toString();
  revision(nextRevision);
  const prepared = await prepareCatalogRelease(
    draft,
    await baseOf(draft),
    nextRevision,
    targetCodes
  );
  const release: CatalogRelease = {
    id: randomUUID(),
    scope,
    manifestId: draft.manifestId,
    contractId,
    catalogSetRevision: nextRevision,
    draftRevision: draft.draftRevision,
    baseReleaseId: draft.baseReleaseId,
    supportedLocales: draft.supportedLocales,
    ...prepared,
    state: 'sealed',
  };
  await client.query(
    `INSERT INTO iam.app_translation_catalog_releases(id, scope, instance_id, organization_id, contract_id, manifest_id, catalog_set_revision, draft_revision, base_release_id, supported_locales, payload, checksum) VALUES ($1,$2,$3,$4,$5,$6,$7::bigint,$8::bigint,$9,$10::jsonb,$11::jsonb,$12)`,
    [
      release.id,
      ...params,
      contractId,
      draft.manifestId,
      nextRevision,
      draft.draftRevision,
      draft.baseReleaseId,
      JSON.stringify(draft.supportedLocales),
      JSON.stringify(release),
      release.checksum,
    ]
  );
  return release;
};
