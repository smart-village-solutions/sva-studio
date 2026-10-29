import { describe, expect, it, vi } from 'vitest';
import { catalogDigest, type CatalogManifest, type CatalogTexts } from '@sva/core';
import { createAppTranslationRepository, type CatalogSqlClient } from './app-translations.js';

describe('source manifest upgrades', () => {
  it('keeps translations, retired keys and target locales when importing a new German basis', async () => {
    const definition = {
      type: 'string' as const,
      defaultValue: 'Neu',
      placeholders: {},
      allowEmpty: false,
    };
    const manifest: CatalogManifest = {
      contractId: 'app-texts',
      manifestVersion: '2',
      appCompatibility: { minVersion: '5.0.0' },
      keys: { shared: definition, added: definition },
    };
    const text = (value: string) => ({
      value,
      origin: 'manual' as const,
      sourceDigest: 'source',
      confirmedSourceDigest: 'reviewed',
    });
    const values: CatalogTexts = {
      de: { shared: text('Eigener Kundentext'), retired: text('Alter Text') },
      en: { shared: text('Existing translation'), retired: text('Retired translation') },
    };
    const before = structuredClone(values);
    const row = {
      id: 'draft',
      manifest_id: 'v1',
      manifest: { ...manifest, manifestVersion: '1' },
      draft_revision: '3',
      supported_locales: ['de', 'en'],
      values_by_locale: values,
      machine_standard_values_by_locale: { en: { shared: text('Existing machine standard') } },
      base_release_id: null,
    };
    const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
      if (sql.startsWith('SELECT id, digest'))
        return { rows: [{ id: 'v2', digest: await catalogDigest(manifest) }], rowCount: 1 };
      if (sql.startsWith('SELECT d.*')) return { rows: [structuredClone(row)], rowCount: 1 };
      if (sql.startsWith('UPDATE iam.app_translation_catalog_drafts')) {
        row.manifest_id = params![1] as string;
        row.manifest = manifest;
        row.supported_locales = JSON.parse(params![2] as string);
        row.values_by_locale = JSON.parse(params![3] as string);
        row.draft_revision = '4';
        return { rows: [{ id: 'draft' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const repo = await createAppTranslationRepository({ query }, { kind: 'global' });
    const result = await repo.importManifest(manifest, '3', ['de']);
    expect(result.supportedLocales).toEqual(['de', 'en']);
    expect(result.valuesByLocale.en).toEqual(before.en);
    expect(result.valuesByLocale.de!.shared).toEqual(before.de!.shared);
    expect(result.valuesByLocale.de!.retired).toEqual(before.de!.retired);
    expect(result.valuesByLocale.de!.added!.value).toBe('Neu');
    expect(result.valuesByLocale.en!.added).toBeUndefined();
    expect(result.machineStandardValuesByLocale).toEqual(row.machine_standard_values_by_locale);
    expect(await repo.importManifest(manifest, '4', ['de'])).toEqual(result);
    expect(query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'))).toHaveLength(1);
  });
});

const municipal = {
  kind: 'municipal' as const,
  instanceId: 'tenant-a',
  organizationId: '11111111-1111-4111-8111-111111111111',
};
const baseId = '22222222-2222-4222-8222-222222222222';
const repositoryManifest: CatalogManifest = {
  contractId: 'app-texts',
  manifestVersion: '1',
  appCompatibility: { minVersion: '1.0.0' },
  keys: { title: { type: 'string', defaultValue: 'Titel', placeholders: {}, allowEmpty: false } },
};
const manualText = {
  value: 'Edited title',
  origin: 'manual' as const,
  sourceDigest: 'old',
  confirmedSourceDigest: 'old',
  sourceKind: 'standard' as const,
};
const draftRow = (): {
  id: string;
  manifest_id: string;
  manifest: CatalogManifest;
  draft_revision: string;
  supported_locales: string[];
  values_by_locale: CatalogTexts;
  machine_standard_values_by_locale: CatalogTexts;
  base_release_id: string | null;
} => ({
  id: 'draft',
  manifest_id: 'manifest',
  manifest: repositoryManifest,
  draft_revision: '7',
  supported_locales: ['de', 'en'],
  values_by_locale: { en: { title: manualText } },
  machine_standard_values_by_locale: {},
  base_release_id: baseId,
});
const baseRelease = {
  id: baseId,
  scope: { kind: 'global' },
  contractId: 'app-texts',
  manifestId: 'manifest',
  supportedLocales: ['de', 'en'],
  catalogs: { de: { values: { title: 'Titel' } }, en: { values: { title: 'Title' } } },
};
const result = (rows: unknown[] = [], rowCount = rows.length) => ({ rows, rowCount });
const catalogQuery = () => vi.fn<CatalogSqlClient['query']>().mockResolvedValueOnce(result());
const queueDraft = (query: ReturnType<typeof catalogQuery>, row = draftRow()) =>
  query.mockResolvedValueOnce(result([structuredClone(row)]));
const queueBase = (query: ReturnType<typeof catalogQuery>) =>
  query.mockResolvedValueOnce(result([{ payload: baseRelease }]));

// Explicit responses model the caller's query results; every write is checked against its bound values.
describe('transaction-bound catalog guards and edits', () => {
  it('sets all tenant settings and binds the tenant and organization to reads', async () => {
    const query = catalogQuery();
    queueDraft(query);
    const repo = await createAppTranslationRepository({ query }, municipal);
    const draft = await repo.loadDraft('app-texts');
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('app.catalog_platform'), [
      municipal.instanceId,
      municipal.organizationId,
      'false',
    ]);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('organization_id IS NOT DISTINCT FROM $3::uuid'),
      ['municipal', municipal.instanceId, municipal.organizationId, 'app-texts']
    );
    expect(draft.scope).toEqual(municipal);
    expect(draft.machineStandardValuesByLocale).toEqual({});
  });

  it('does not query a malformed tenant or release identity', async () => {
    const query = catalogQuery();
    await expect(
      createAppTranslationRepository({ query }, { ...municipal, organizationId: 'other' })
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    const repo = await createAppTranslationRepository({ query }, municipal);
    await expect(repo.loadRelease('not-a-uuid')).rejects.toThrow();
    await expect(repo.loadDraft('invalid.contract')).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('keeps private release reads scoped and reports missing releases', async () => {
    const query = catalogQuery().mockResolvedValueOnce(result());
    const repo = await createAppTranslationRepository({ query }, municipal);
    await expect(repo.loadRelease(baseId)).rejects.toThrow('catalog_not_found');
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('scope = $2'), [
      baseId,
      'municipal',
      municipal.instanceId,
      municipal.organizationId,
    ]);
  });

  it.each(['6', '08'])(
    'rejects stale or malformed revision %s before writing',
    async (revision) => {
      const query = catalogQuery();
      queueDraft(query);
      const repo = await createAppTranslationRepository({ query }, municipal);
      await expect(repo.configureLocales('app-texts', revision, ['de'])).rejects.toThrow();
      expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
      if (revision === '6')
        expect(query).toHaveBeenLastCalledWith(expect.stringContaining('FOR UPDATE OF d'), [
          'municipal',
          municipal.instanceId,
          municipal.organizationId,
          'app-texts',
        ]);
    }
  );

  it('checks optimistic write conflicts without reloading or committing the caller transaction', async () => {
    const query = catalogQuery();
    queueDraft(query);
    query.mockResolvedValueOnce(result([], 0));
    const repo = await createAppTranslationRepository({ query }, municipal);
    await expect(repo.configureLocales('app-texts', '7', ['de'])).rejects.toThrow(
      'catalog_conflict'
    );
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('draft_revision = $6::bigint'), [
      'draft',
      'manifest',
      '["de"]',
      JSON.stringify(draftRow().values_by_locale),
      baseId,
      '7',
      '{}',
    ]);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('stores manual translations with their actual source digest and target variant', async () => {
    const query = catalogQuery();
    queueDraft(query);
    queueBase(query);
    queueBase(query);
    query.mockResolvedValueOnce(result([{ id: 'draft' }]));
    queueDraft(query);
    const repo = await createAppTranslationRepository({ query }, municipal);
    await repo.editText('app-texts', '7', 'en', 'title', 'Corrected', 'EN-GB');
    const write = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE'));
    const digest = await catalogDigest('Titel');
    expect(JSON.parse(write?.[1]?.[3] as string).en.title).toEqual({
      value: 'Corrected',
      origin: 'manual',
      sourceKind: 'standard',
      targetCode: 'EN-GB',
      sourceDigest: digest,
      confirmedSourceDigest: digest,
    });
    expect(write?.[1]?.[5]).toBe('7');
    expect(query.mock.calls.filter(([sql]) => sql.includes("scope = 'global'"))).toEqual([
      [expect.any(String), [baseId]],
      [expect.any(String), [baseId]],
    ]);
  });

  it('confirms an existing manual correction against the current source', async () => {
    const query = catalogQuery();
    queueDraft(query);
    queueBase(query);
    query.mockResolvedValueOnce(result([{ id: 'draft' }]));
    queueDraft(query);
    const repo = await createAppTranslationRepository({ query }, municipal);
    await repo.confirmCorrection('app-texts', '7', 'en', 'title', 'EN-US');
    const write = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE'));
    expect(JSON.parse(write?.[1]?.[3] as string).en.title).toEqual({
      ...manualText,
      confirmedSourceDigest: await catalogDigest('Titel'),
      targetCode: 'EN-US',
    });
  });

  it('removes only the selected municipal override', async () => {
    const query = catalogQuery();
    queueDraft(query);
    query.mockResolvedValueOnce(result([{ id: 'draft' }]));
    queueDraft(query);
    const repo = await createAppTranslationRepository({ query }, municipal);
    await repo.resetOverride('app-texts', '7', 'en', 'title');
    const write = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE'));
    expect(JSON.parse(write?.[1]?.[3] as string)).toEqual({ en: {} });
    expect((write?.[1] ?? []).slice(4)).toEqual([baseId, '7', '{}']);
  });

  it.each(['unconfirmed', 'stale confirmation', 'stale source'])(
    'rejects a machine batch with %s without writes',
    async (reason) => {
      const query = catalogQuery();
      queueDraft(query);
      queueBase(query);
      const repo = await createAppTranslationRepository({ query }, municipal);
      await expect(
        repo.applyMachineBatch('app-texts', '7', [
          {
            locale: 'en',
            key: 'title',
            value: 'Machine',
            targetCode: 'EN-GB',
            sourceKind: 'standard',
            sourceDigest: reason === 'stale source' ? '0'.repeat(64) : await catalogDigest('Titel'),
            ...(reason === 'stale confirmation' ? { overrideDigest: '0'.repeat(64) } : {}),
            ...(reason === 'stale source' ? { overrideDigest: await catalogDigest(manualText) } : {}),
          },
        ])
      ).rejects.toThrow('catalog_conflict');
      expect(query).toHaveBeenCalledTimes(3);
      expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
    }
  );

  it('replaces exactly the confirmed manual override and retains machine standards separately', async () => {
    const query = catalogQuery();
    queueDraft(query);
    queueBase(query);
    query.mockResolvedValueOnce(result([{ id: 'draft' }]));
    queueDraft(query);
    const repo = await createAppTranslationRepository({ query }, municipal);
    const sourceDigest = await catalogDigest('Titel');
    await repo.applyMachineBatch('app-texts', '7', [
      {
        locale: 'en',
        key: 'title',
        value: 'Machine',
        targetCode: 'EN-GB',
        sourceKind: 'standard',
        sourceDigest,
        overrideDigest: await catalogDigest(manualText),
      },
    ]);
    const write = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE'));
    expect(JSON.parse(write?.[1]?.[3] as string)).toEqual({ en: {} });
    expect(JSON.parse(write?.[1]?.[6] as string)).toEqual({
      en: {
        title: {
          value: 'Machine',
          origin: 'machine',
          sourceKind: 'standard',
          targetCode: 'EN-GB',
          sourceDigest,
          confirmedSourceDigest: null,
        },
      },
    });
    expect(write?.[1]?.[5]).toBe('7');
  });

  it('propagates database errors and leaves transaction ownership with the caller', async () => {
    const query = catalogQuery();
    queueDraft(query);
    const error = new Error('write unavailable');
    query.mockRejectedValueOnce(error);
    const repo = await createAppTranslationRepository({ query }, municipal);
    await expect(repo.resetOverride('app-texts', '7', 'en', 'title')).rejects.toBe(error);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.some(([sql]) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(sql))).toBe(false);
  });
});

describe('catalog release and import boundaries', () => {
  it('lists every municipal release while offering only global releases as bases', async () => {
    const query = catalogQuery()
      .mockResolvedValueOnce(result([{ contractId: 'app-texts' }]))
      .mockResolvedValueOnce(result([{ id: 'private' }]))
      .mockResolvedValueOnce(result([{ id: 'global' }]));
    const repo = await createAppTranslationRepository({ query }, municipal);
    expect(await repo.overview()).toEqual({
      scope: municipal,
      catalogs: [{ contractId: 'app-texts' }],
      releases: [{ id: 'private' }],
      bases: [{ id: 'global' }],
    });
    for (const index of [1, 2])
      expect(query.mock.calls[index]?.[1]).toEqual([
        'municipal',
        municipal.instanceId,
        municipal.organizationId,
      ]);
    expect(query.mock.calls[3]).toEqual([expect.stringContaining("WHERE scope = 'global'")]);
  });

  it('does not expose a global base selector to the platform scope', async () => {
    const query = catalogQuery().mockResolvedValueOnce(result()).mockResolvedValueOnce(result());
    const repo = await createAppTranslationRepository({ query }, { kind: 'global' });
    expect((await repo.overview()).bases).toEqual([]);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[1]?.[1]).toEqual(['global', null, null]);
  });

  it('resolves inherited values without changing the stored draft', async () => {
    const query = catalogQuery();
    queueDraft(query);
    queueBase(query);
    const repo = await createAppTranslationRepository({ query }, municipal);
    const effective = await repo.readEffective('app-texts');
    expect(effective.values.de?.title?.value).toBe('Titel');
    expect(effective.values.en?.title).toEqual(manualText);
    expect(effective.baseCatalogs).toEqual(baseRelease.catalogs);
    expect(effective.draft.valuesByLocale.de).toBeUndefined();
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('seals a German-only snapshot without removing translations from the draft', async () => {
    const query = catalogQuery();
    queueDraft(query);
    query.mockResolvedValueOnce(result()).mockResolvedValueOnce(result([{ revision: '4' }]));
    queueBase(query);
    query.mockResolvedValueOnce(result());
    const repo = await createAppTranslationRepository({ query }, municipal);
    const release = await repo.seal('app-texts', '7', true);
    expect(release).toMatchObject({
      catalogSetRevision: '5',
      draftRevision: '7',
      supportedLocales: ['de'],
      state: 'sealed',
      catalogs: { de: { values: { title: 'Titel' } } },
    });
    expect(Object.keys(release.catalogs)).toEqual(['de']);
    expect(query.mock.calls[2]?.[1]).toEqual([
      'municipal',
      municipal.instanceId,
      municipal.organizationId,
      'app-texts',
      '7',
      '["de"]',
    ]);
    expect(query.mock.calls[5]?.[1]).toEqual([
      release.id,
      'municipal',
      municipal.instanceId,
      municipal.organizationId,
      'app-texts',
      'manifest',
      '5',
      '7',
      baseId,
      '["de"]',
      JSON.stringify(release),
      release.checksum,
    ]);
    expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });

  it('reuses a sealed revision but still validates the current source before returning it', async () => {
    const query = catalogQuery();
    queueDraft(query);
    const existing = { catalogSetRevision: '5' };
    query.mockResolvedValueOnce(result([{ payload: existing }]));
    queueBase(query);
    const repo = await createAppTranslationRepository({ query }, municipal);
    expect(await repo.seal('app-texts', '7', true)).toBe(existing);
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
  });

  it('does not reuse a sealed multilingual revision while its manual correction is stale', async () => {
    const query = catalogQuery();
    queueDraft(query);
    query.mockResolvedValueOnce(result([{ payload: { catalogSetRevision: '5' } }]));
    queueBase(query);
    const repo = await createAppTranslationRepository({ query }, municipal);
    await expect(repo.seal('app-texts', '7')).rejects.toThrow('catalog_review_required');
    expect(query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
  });

  it.each([null, { id: 'different' }])(
    'rejects absent or inconsistent export payloads before rendering: %j',
    async (payload) => {
      const query = catalogQuery().mockResolvedValueOnce(result([{ payload, checksum: 'stored' }]));
      const repo = await createAppTranslationRepository({ query }, municipal);
      await expect(repo.exportTexts(baseId)).rejects.toThrow();
      expect(query).toHaveBeenLastCalledWith(
        expect.stringContaining('octet_length(r.payload::text) <= $5'),
        [
          baseId,
          municipal.instanceId,
          municipal.organizationId,
          'sva-mobile-app-texts',
          8 * 1024 * 1024,
        ]
      );
    }
  );

  it('refuses a conflicting manifest version before creating or replacing a draft', async () => {
    const query = catalogQuery()
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([{ id: 'manifest', digest: 'different' }]));
    const repo = await createAppTranslationRepository({ query }, { kind: 'global' });
    await expect(repo.importManifest(repositoryManifest, '0', ['de'])).rejects.toThrow(
      'catalog_conflict'
    );
    expect(query.mock.calls[1]?.[1]).toEqual([
      'app-texts',
      '1',
      JSON.stringify(repositoryManifest),
      await catalogDigest(repositoryManifest),
    ]);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('creates the initial global draft only at revision zero with German defaults', async () => {
    const query = catalogQuery()
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(
        result([{ id: 'manifest', digest: await catalogDigest(repositoryManifest) }])
      )
      .mockResolvedValueOnce(result([{ id: 'draft' }]));
    queueDraft(query, { ...draftRow(), base_release_id: null });
    const repo = await createAppTranslationRepository({ query }, { kind: 'global' });
    await repo.importManifest(repositoryManifest, '0', ['de']);
    const write = query.mock.calls[3]?.[1] ?? [];
    expect((write ?? []).slice(0, 3)).toEqual(['app-texts', 'manifest', '["de"]']);
    expect(JSON.parse(write?.[3] as string)).toEqual({
      de: {
        title: {
          value: 'Titel',
          origin: 'default',
          sourceDigest: await catalogDigest('Titel'),
          confirmedSourceDigest: null,
        },
      },
    });
    expect(query).toHaveBeenCalledTimes(5);
  });

  it.each([false, true])(
    'creates a municipal draft without replacing an existing different base: conflict=%s',
    async (conflict) => {
      const query = catalogQuery();
      queueBase(query);
      query.mockResolvedValueOnce(result());
      queueDraft(query, { ...draftRow(), base_release_id: conflict ? 'other-base' : baseId });
      const repo = await createAppTranslationRepository({ query }, municipal);
      const operation = repo.createMunicipalDraft(baseId, ['de', 'en']);
      if (conflict) await expect(operation).rejects.toThrow('catalog_conflict');
      else expect((await operation).baseReleaseId).toBe(baseId);
      expect(query.mock.calls[1]).toEqual([expect.stringContaining("scope = 'global'"), [baseId]]);
      expect(query.mock.calls[2]?.[1]).toEqual([
        municipal.instanceId,
        municipal.organizationId,
        'app-texts',
        'manifest',
        '["de","en"]',
        baseId,
      ]);
      expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
    }
  );

  it('changes the central basis while preserving manual translations and checking the old revision', async () => {
    const query = catalogQuery();
    queueDraft(query);
    queueBase(query);
    query
      .mockResolvedValueOnce(result([{ manifest: repositoryManifest }]))
      .mockResolvedValueOnce(result([{ id: 'draft' }]));
    queueDraft(query);
    const repo = await createAppTranslationRepository({ query }, municipal);
    await repo.changeBase('app-texts', '7', baseId, ['de', 'en']);
    expect(query.mock.calls[3]).toEqual([expect.stringContaining('WHERE id = $1'), ['manifest']]);
    const write = query.mock.calls[4]?.[1] ?? [];
    expect(write?.[3]).toBe(JSON.stringify(draftRow().values_by_locale));
    expect((write ?? []).slice(4)).toEqual([baseId, '7', '{}']);
  });
});

describe('immutable export metadata', () => {
  const payload = {
    id: baseId,
    scope: municipal,
    checksum: 'sealed-checksum',
    catalogSetRevision: '5',
    draftRevision: '7',
    supportedLocales: ['de'],
    manifestId: 'manifest',
  };
  const stored = async () => ({
    payload,
    manifest: repositoryManifest,
    digest: await catalogDigest(repositoryManifest),
    checksum: payload.checksum,
    catalogSetRevision: '5',
    draftRevision: '7',
    supportedLocales: ['de'],
    manifestId: 'manifest',
  });

  it.each([
    { checksum: 'changed' },
    { catalogSetRevision: '6' },
    { draftRevision: '8' },
    { supportedLocales: ['de', 'en'] },
    { manifestId: 'different' },
    { id: 'different' },
    { scope: { kind: 'global' } },
    { scope: { ...municipal, instanceId: 'other' } },
    { scope: { ...municipal, organizationId: baseId } },
  ])('rejects a payload whose stored metadata disagrees with %j', async (change) => {
    const entry = await stored();
    const query = catalogQuery().mockResolvedValueOnce(
      result([{ ...entry, payload: { ...payload, ...change } }])
    );
    const repo = await createAppTranslationRepository({ query }, municipal);
    await expect(repo.exportTexts(baseId)).rejects.toThrow('invalid_catalog');
    expect(query.mock.calls[1]?.[1]?.slice(0, 4)).toEqual([
      baseId,
      municipal.instanceId,
      municipal.organizationId,
      'sva-mobile-app-texts',
    ]);
  });

  it('checks the persisted manifest digest before allowing the reviewed-format renderer', async () => {
    const entry = await stored();
    const query = catalogQuery()
      .mockResolvedValueOnce(result([{ ...entry, digest: 'changed' }]))
      .mockResolvedValueOnce(result([entry]));
    const repo = await createAppTranslationRepository({ query }, municipal);
    await expect(repo.exportTexts(baseId)).rejects.toThrow('invalid_catalog');
    // This validly bound but unsupported test manifest must reach the core compatibility guard.
    await expect(repo.exportTexts(baseId)).rejects.toThrow('catalog_export_incompatible');
    expect(query).toHaveBeenCalledTimes(3);
  });
});
