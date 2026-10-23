/** Transaction-bound internal catalog repository. Caller supplies an authorized scope. */
import { randomUUID } from 'node:crypto';
import {
  catalogAssert,
  exportCatalogTextsJs,
  CATALOG_TEXTS_EXPORT_MAX_BYTES,
  catalogDigest,
  catalogTextSource,
  prepareCatalogRelease,
  resolveCatalogValues,
  validateCatalogLocales,
  validateCatalogManifest,
  validateCatalogValue,
  type AppTranslationLocale,
  type CatalogDraft,
  type CatalogManifest,
  type CatalogRelease,
  type CatalogScope,
  type CatalogTexts,
  type CatalogText,
  type CatalogValue,
  type CatalogOverview,
  type CatalogReleaseSummary,
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
const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const revision = (value: unknown) =>
  catalogAssert(typeof value === 'string' && /^(0|[1-9][0-9]{0,17})$/.test(value));
const contract = (value: unknown) =>
  catalogAssert(typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value));

/** Must run within an existing transaction; all three settings are always replaced. */
export const createAppTranslationRepository = async (
  client: CatalogSqlClient,
  scope: CatalogScope
) => {
  catalogAssert(scope.kind === 'global' || scope.kind === 'municipal');
  if (scope.kind === 'municipal')
    catalogAssert(
      typeof scope.instanceId === 'string' &&
        scope.instanceId.length > 0 &&
        scope.instanceId.length <= 128 &&
        uuid(scope.organizationId)
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
  const loadDraft = async (contractId: string, lock = false): Promise<CatalogDraft> => {
    contract(contractId);
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
  const loadRelease = async (id: string, globalOnly = false): Promise<CatalogRelease> => {
    catalogAssert(uuid(id));
    const result = await client.query<{ payload: CatalogRelease }>(
      `SELECT payload FROM iam.app_translation_catalog_releases WHERE id = $1 AND ${globalOnly ? "scope = 'global'" : '(scope = $2 AND instance_id IS NOT DISTINCT FROM $3::text AND organization_id IS NOT DISTINCT FROM $4::uuid)'}`,
      globalOnly ? [id] : [id, ...params]
    );
    const release = result.rows[0]?.payload;
    catalogAssert(release, 'catalog_not_found');
    return release;
  };
  const baseOf = (draft: CatalogDraft) =>
    draft.baseReleaseId ? loadRelease(draft.baseReleaseId, true) : Promise.resolve(null);
  const save = async (draft: CatalogDraft): Promise<CatalogDraft> => {
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
    return loadDraft(draft.manifest.contractId);
  };
  const locked = async (contractId: string, expectedRevision: string) => {
    revision(expectedRevision);
    const draft = await loadDraft(contractId, true);
    catalogAssert(draft.draftRevision === expectedRevision, 'catalog_conflict');
    return draft;
  };
  return {
    loadDraft,
    overview: async (): Promise<CatalogOverview> => {
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
    },
    loadRelease: (id: string) => loadRelease(id),
    exportTexts: async (id: string) => {
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
          JSON.stringify(entry.payload.supportedLocales) ===
            JSON.stringify(entry.supportedLocales) &&
          entry.payload.manifestId === entry.manifestId &&
          entry.payload.id === id &&
          entry.payload.scope.kind === 'municipal' &&
          entry.payload.scope.instanceId === instanceId &&
          entry.payload.scope.organizationId === organizationId
      );
      catalogAssert((await catalogDigest(entry.manifest)) === entry.digest);
      return exportCatalogTextsJs(entry.payload, entry.manifest);
    },
    readEffective: async (contractId: string) => {
      const draft = await loadDraft(contractId);
      const base = await baseOf(draft);
      return {
        draft,
        values: resolveCatalogValues(draft, base),
        baseCatalogs: base?.catalogs ?? {},
      };
    },
    importManifest: async (
      raw: unknown,
      expectedRevision: string,
      locales: unknown
    ): Promise<CatalogDraft> => {
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
          JSON.stringify(draft.supportedLocales) === JSON.stringify(supportedLocales),
          'catalog_conflict'
        );
        return draft;
      }
      catalogAssert(draft.draftRevision === expectedRevision, 'catalog_conflict');
      draft.manifestId = entry.id;
      draft.manifest = manifest;
      draft.supportedLocales = supportedLocales;
      for (const [locale, values] of Object.entries(draft.valuesByLocale)) {
        catalogAssert(supportedLocales.includes(locale as AppTranslationLocale));
        catalogAssert(values);
        for (const [key, text] of Object.entries(values))
          validateCatalogValue(manifest, key, text.value);
      }
      for (const [key, value] of Object.entries(defaults.de!))
        if (!draft.valuesByLocale.de![key]) draft.valuesByLocale.de![key] = value;
      return save(draft);
    },
    createMunicipalDraft: async (
      baseReleaseId: string,
      locales: unknown
    ): Promise<CatalogDraft> => {
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
    },
    changeBase: async (
      contractId: string,
      expectedRevision: string,
      baseReleaseId: string,
      locales: unknown
    ) => {
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
          validateCatalogValue(draft.manifest, key, text.value);
      }
      return save(draft);
    },
    configureLocales: async (
      contractId: string,
      expectedRevision: string,
      locales: readonly AppTranslationLocale[]
    ) => {
      const draft = await locked(contractId, expectedRevision);
      draft.supportedLocales = validateCatalogLocales(locales);
      return save(draft);
    },
    editText: async (
      contractId: string,
      expectedRevision: string,
      locale: AppTranslationLocale,
      key: string,
      value: unknown,
      targetCode?: string
    ) => {
      const draft = await locked(contractId, expectedRevision);
      catalogAssert(draft.supportedLocales.includes(locale));
      const validValue = validateCatalogValue(draft.manifest, key, value);
      const effective = resolveCatalogValues(draft, await baseOf(draft));
      const current = effective[locale]?.[key];
      const sourceKind =
        current?.sourceKind ??
        (current?.origin === 'default' && draft.scope.kind === 'municipal'
          ? 'standard'
          : 'municipal');
      const source =
        locale === 'de'
          ? validValue
          : catalogTextSource(draft, await baseOf(draft), key, {
              ...effective[locale]?.[key],
              value: validValue,
              origin: 'manual',
              sourceDigest: '',
              confirmedSourceDigest: null,
              sourceKind,
            });
      catalogAssert(source !== undefined, 'catalog_incomplete');
      const digest = await catalogDigest(source);
      draft.valuesByLocale[locale] ??= {};
      draft.valuesByLocale[locale]![key] = {
        value: validValue,
        origin: 'manual',
        sourceKind,
        ...(targetCode ? { targetCode } : {}),
        sourceDigest: digest,
        confirmedSourceDigest: digest,
      };
      return save(draft);
    },
    resetOverride: async (
      contractId: string,
      expectedRevision: string,
      locale: AppTranslationLocale,
      key: string
    ) => {
      catalogAssert(scope.kind === 'municipal', 'catalog_forbidden');
      const draft = await locked(contractId, expectedRevision);
      catalogAssert(
        draft.supportedLocales.includes(locale) &&
          Object.prototype.hasOwnProperty.call(draft.manifest.keys, key)
      );
      delete draft.valuesByLocale[locale]?.[key];
      return save(draft);
    },
    confirmCorrection: async (
      contractId: string,
      expectedRevision: string,
      locale: AppTranslationLocale,
      key: string,
      targetCode?: string
    ) => {
      const draft = await locked(contractId, expectedRevision);
      catalogAssert(locale !== 'de' && draft.supportedLocales.includes(locale));
      const text = draft.valuesByLocale[locale]?.[key];
      catalogAssert(text?.origin === 'manual');
      const source = catalogTextSource(draft, await baseOf(draft), key, text);
      catalogAssert(source !== undefined, 'catalog_incomplete');
      text.confirmedSourceDigest = await catalogDigest(source);
      if (targetCode) text.targetCode = targetCode;
      return save(draft);
    },
    applyMachineBatch: async (
      contractId: string,
      expectedRevision: string,
      entries: readonly {
        locale: string;
        key: string;
        value: CatalogValue;
        sourceDigest: string;
        targetCode: string;
        sourceKind: 'standard' | 'municipal';
        overrideDigest?: string;
      }[]
    ) => {
      catalogAssert(scope.kind === 'municipal', 'catalog_forbidden');
      const draft = await locked(contractId, expectedRevision);
      const base = await baseOf(draft);
      catalogAssert(entries.length > 0 && entries.length <= 50);
      for (const entry of entries) {
        catalogAssert(entry.locale !== 'de' && draft.supportedLocales.includes(entry.locale));
        const text: CatalogText = {
          value: validateCatalogValue(draft.manifest, entry.key, entry.value),
          origin: 'machine',
          sourceKind: entry.sourceKind,
          targetCode: entry.targetCode,
          sourceDigest: entry.sourceDigest,
          confirmedSourceDigest: null,
        };
        const source = catalogTextSource(draft, base, entry.key, text);
        catalogAssert(
          source !== undefined && (await catalogDigest(source)) === entry.sourceDigest,
          'catalog_conflict'
        );
        const own = draft.valuesByLocale[entry.locale]?.[entry.key];
        if (own?.origin === 'manual' || entry.overrideDigest !== undefined)
          catalogAssert(
            entry.overrideDigest !== undefined &&
              (await catalogDigest(own ?? null)) === entry.overrideDigest,
            'catalog_conflict'
          );
        const values =
          entry.sourceKind === 'standard'
            ? (draft.machineStandardValuesByLocale ??= {})
            : draft.valuesByLocale;
        values[entry.locale] ??= {};
        values[entry.locale]![entry.key] = text;
        if (entry.sourceKind === 'standard' && entry.overrideDigest !== undefined)
          delete draft.valuesByLocale[entry.locale]?.[entry.key];
      }
      return save(draft);
    },
    seal: async (
      contractId: string,
      expectedRevision: string,
      sourceOnly = false,
      targetCodes?: Readonly<Record<string, string>>
    ): Promise<CatalogRelease> => {
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
    },
  };
};
export type AppTranslationRepository = Awaited<ReturnType<typeof createAppTranslationRepository>>;
