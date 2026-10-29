/** Existing catalog import operations on the caller transaction. */

import {
  catalogAssert,
  catalogDigest,
  validateCatalogLocales,
  validateCatalogManifest,
  validateCatalogValue,
  type AppTranslationLocale,
  type CatalogDraft,
  type CatalogManifest,
  type CatalogTexts,
} from '@sva/core';

import {
  catalogRevision as revision,
  type CatalogRepositoryContext,
} from './app-translations-context.js';
export const importManifest = async (
  context: CatalogRepositoryContext,
  raw: unknown,
  expectedRevision: string,
  locales: unknown
): Promise<CatalogDraft> => {
  const { client, scope, loadDraft, save } = context;

  catalogAssert(scope.kind === 'global', 'catalog_forbidden');
  revision(expectedRevision);
  const manifest = validateCatalogManifest(raw);
  const supportedLocales = validateCatalogLocales(locales);
  const digest = await catalogDigest(manifest);
  await client.query(
    'INSERT INTO iam.app_translation_manifests(contract_id, manifest_version, manifest, digest) VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT (contract_id, manifest_version) DO NOTHING',
    [manifest.contractId, manifest.manifestVersion, JSON.stringify(manifest), digest]
  );
  const registered = await client.query<{ id: string; digest: string }>(
    'SELECT id, digest FROM iam.app_translation_manifests WHERE contract_id = $1 AND manifest_version = $2',
    [manifest.contractId, manifest.manifestVersion]
  );
  const entry = registered.rows[0];
  catalogAssert(entry && entry.digest === digest, 'catalog_conflict');
  const defaults: CatalogTexts = { de: {} };
  for (const [key, definition] of Object.entries(manifest.keys))
    defaults.de![key] = {
      value: definition.defaultValue,
      origin: 'default',
      sourceDigest: await catalogDigest(definition.defaultValue),
      confirmedSourceDigest: null,
    };
  const created = await client.query(
    `INSERT INTO iam.app_translation_catalog_drafts(scope, contract_id, manifest_id, supported_locales, values_by_locale) VALUES ('global',$1,$2,$3::jsonb,$4::jsonb) ON CONFLICT DO NOTHING RETURNING id`,
    [manifest.contractId, entry.id, JSON.stringify(supportedLocales), JSON.stringify(defaults)]
  );
  const draft = await loadDraft(manifest.contractId, true);
  if (created.rowCount) {
    catalogAssert(expectedRevision === '0', 'catalog_conflict');
    return draft;
  }
  if (draft.manifestId === entry.id) {
    catalogAssert(
      supportedLocales.every((locale) => draft.supportedLocales.includes(locale)),
      'catalog_conflict'
    );
    return draft;
  }
  catalogAssert(draft.draftRevision === expectedRevision, 'catalog_conflict');
  draft.manifestId = entry.id;
  draft.manifest = manifest;
  // Importing a new source never removes existing target languages or their values.
  draft.supportedLocales = validateCatalogLocales([
    ...new Set([...draft.supportedLocales, ...supportedLocales]),
  ]);
  for (const [locale, values] of Object.entries(draft.valuesByLocale)) {
    catalogAssert(draft.supportedLocales.includes(locale as AppTranslationLocale));
    catalogAssert(values);
    for (const [key, text] of Object.entries(values))
      if (Object.prototype.hasOwnProperty.call(manifest.keys, key))
        validateCatalogValue(manifest, key, text.value);
  }
  for (const [key, value] of Object.entries(defaults.de!))
    if (!draft.valuesByLocale.de![key]) draft.valuesByLocale.de![key] = value;
  return save(draft);
};
export const createMunicipalDraft = async (
  context: CatalogRepositoryContext,
  baseReleaseId: string,
  locales: unknown
): Promise<CatalogDraft> => {
  const { client, scope, instanceId, organizationId, loadDraft, loadRelease } = context;

  catalogAssert(scope.kind === 'municipal', 'catalog_forbidden');
  const base = await loadRelease(baseReleaseId, true);
  const supportedLocales = validateCatalogLocales(locales);
  catalogAssert(base.supportedLocales.includes('de'), 'catalog_incomplete');
  await client.query(
    `INSERT INTO iam.app_translation_catalog_drafts(scope, instance_id, organization_id, contract_id, manifest_id, supported_locales, base_release_id) VALUES ('municipal',$1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT DO NOTHING`,
    [
      instanceId,
      organizationId,
      base.contractId,
      base.manifestId,
      JSON.stringify(supportedLocales),
      base.id,
    ]
  );
  const draft = await loadDraft(base.contractId);
  catalogAssert(
    draft.baseReleaseId === base.id &&
      JSON.stringify(draft.supportedLocales) === JSON.stringify(supportedLocales),
    'catalog_conflict'
  );
  return draft;
};
export const changeBase = async (
  context: CatalogRepositoryContext,
  contractId: string,
  expectedRevision: string,
  baseReleaseId: string,
  locales: unknown
) => {
  const { client, scope, loadRelease, save, locked } = context;

  catalogAssert(scope.kind === 'municipal', 'catalog_forbidden');
  const draft = await locked(contractId, expectedRevision);
  const base = await loadRelease(baseReleaseId, true);
  catalogAssert(base.contractId === contractId, 'catalog_conflict');
  draft.baseReleaseId = base.id;
  draft.manifestId = base.manifestId;
  const manifest = await client.query<{ manifest: CatalogManifest }>(
    'SELECT manifest FROM iam.app_translation_manifests WHERE id = $1',
    [base.manifestId]
  );
  catalogAssert(manifest.rows[0]);
  draft.manifest = manifest.rows[0].manifest;
  draft.supportedLocales = validateCatalogLocales(locales);
  catalogAssert(base.supportedLocales.includes('de'), 'catalog_incomplete');
  for (const values of Object.values(draft.valuesByLocale)) {
    catalogAssert(values);
    for (const [key, text] of Object.entries(values))
      if (Object.prototype.hasOwnProperty.call(draft.manifest.keys, key))
        validateCatalogValue(draft.manifest, key, text.value);
  }
  return save(draft);
};
