import { describe, expect, it, vi } from 'vitest';
import { catalogDigest, type CatalogManifest, type CatalogTexts } from '@sva/core';
import { createAppTranslationRepository } from './app-translations.js';

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
