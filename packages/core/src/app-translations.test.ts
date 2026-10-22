import { describe, expect, it } from 'vitest';
import {
  readDeepLSettings,
  deepLTargetCode,
  canonicalCatalogJson,
  catalogDigest,
  catalogTextSource,
  prepareCatalogRelease,
  validateCatalogLocales,
  validateCatalogManifest,
  validateCatalogValue,
  type CatalogDraft,
  type CatalogManifest,
  APP_TRANSLATION_LOCALES,
  type CatalogRelease,
  type CatalogText,
} from './app-translations.js';
const manifest: CatalogManifest = {
  contractId: 'ui-v1',
  manifestVersion: '1',
  appCompatibility: { minVersion: '1.0.0' },
  keys: {
    greeting: {
      type: 'string',
      defaultValue: 'Hallo {{name}}',
      placeholders: { name: 'string' },
      allowEmpty: false,
    },
  },
};
const draft: CatalogDraft = {
  id: 'draft',
  scope: { kind: 'global' },
  manifestId: 'manifest',
  manifest,
  draftRevision: '1',
  supportedLocales: ['de', 'en'],
  baseReleaseId: null,
  valuesByLocale: {
    de: {
      greeting: {
        value: 'Hallo {{name}}',
        origin: 'default',
        sourceDigest: '',
        confirmedSourceDigest: null,
      },
    },
  },
};
describe('fixed app catalogs', () => {
  it('resolves only the requested German source with the existing value precedence', async () => {
    const base: CatalogRelease = {
      id: 'base',
      scope: { kind: 'global' },
      manifestId: 'manifest',
      contractId: manifest.contractId,
      catalogSetRevision: '1',
      draftRevision: '1',
      baseReleaseId: null,
      supportedLocales: ['de'],
      state: 'sealed',
      ...(await prepareCatalogRelease({ ...draft, supportedLocales: ['de'] }, null, '1')),
    };
    const municipal: CatalogDraft = {
      ...structuredClone(draft),
      scope: { kind: 'municipal', instanceId: 'a', organizationId: 'org' },
      baseReleaseId: base.id,
      machineStandardValuesByLocale: {
        de: {
          greeting: {
            value: 'Maschinelle Quelle',
            origin: 'machine',
            sourceDigest: '',
            confirmedSourceDigest: null,
          },
        },
      },
    };
    municipal.valuesByLocale.de!.greeting!.value = '';
    municipal.valuesByLocale.en = {};
    for (const values of [municipal.valuesByLocale.de!, municipal.valuesByLocale.en])
      Object.defineProperty(values, 'unrelated', {
        enumerable: true,
        get() {
          throw new Error('unrelated_value_read');
        },
      });
    const legacy: CatalogText = {
      value: 'Translation',
      origin: 'manual',
      sourceDigest: '',
      confirmedSourceDigest: null,
    };
    for (const text of [legacy, { ...legacy, sourceKind: 'municipal' as const }]) {
      expect(catalogTextSource(municipal, base, 'greeting', text)).toBe('');
      expect(() =>
        catalogTextSource(municipal, { ...base, id: 'other' }, 'greeting', text)
      ).toThrow('catalog_conflict');
    }
    expect(
      catalogTextSource(municipal, base, 'greeting', { ...legacy, sourceKind: 'standard' })
    ).toBe('Hallo {{name}}');
    delete municipal.valuesByLocale.de!.greeting;
    expect(catalogTextSource(municipal, base, 'greeting', legacy)).toBe('Maschinelle Quelle');
    delete municipal.machineStandardValuesByLocale!.de!.greeting;
    expect(catalogTextSource(municipal, base, 'greeting', legacy)).toBe('Hallo {{name}}');
    expect(catalogTextSource(draft, null, 'greeting', legacy)).toBe('Hallo {{name}}');
    expect(
      catalogTextSource({ ...draft, valuesByLocale: {} }, null, 'greeting', legacy)
    ).toBeUndefined();
    expect(() => catalogTextSource(draft, base, 'greeting', legacy)).toThrow('catalog_conflict');
  });
  it('canonicalizes without normalizing text, rejects unsafe JSON and validates placeholders', async () => {
    expect(canonicalCatalogJson({ z: '😀', a: '\n' })).toBe('{"a":"\\n","z":"😀"}');
    expect(await catalogDigest({ a: 1, z: 'x' })).toBe(await catalogDigest({ z: 'x', a: 1 }));
    for (const value of [NaN, 0.1, undefined, '\ud800', new Date(), Array(2), { ä: 1 }])
      expect(() => canonicalCatalogJson(value)).toThrow('invalid_catalog');
    expect(validateCatalogManifest(manifest)).toEqual(manifest);
    for (const value of ['', 'Hello', 'Hi {{other}}', 'Hi {{name'])
      expect(() => validateCatalogValue(manifest, 'greeting', value)).toThrow();
    expect(() => validateCatalogManifest({ ...manifest, extra: true })).toThrow();
    expect(() => validateCatalogLocales(['de', 'en', 'en'])).toThrow();
  });
  it('requires complete reviewed values and creates byte-stable sealed artifacts', async () => {
    await expect(prepareCatalogRelease(draft, null, '1')).rejects.toThrow('catalog_incomplete');
    const complete = structuredClone(draft);
    complete.valuesByLocale.en = {
      greeting: {
        value: 'Hello {{name}}',
        origin: 'manual',
        sourceDigest: await catalogDigest('Hallo {{name}}'),
        confirmedSourceDigest: await catalogDigest('Hallo {{name}}'),
      },
    };
    const first = await prepareCatalogRelease(complete, null, '1');
    expect(await prepareCatalogRelease(complete, null, '1')).toEqual(first);
    expect(first.descriptor.catalogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locale: 'en',
          version: '1.0.0',
          name: expect.stringMatching(/-en-r1$/),
        }),
      ])
    );
    complete.valuesByLocale.de!.greeting!.value = 'Guten Tag {{name}}';
    await expect(prepareCatalogRelease(complete, null, '2')).rejects.toThrow(
      'catalog_review_required'
    );
  });
  it('validates typed arrays, explicit empty values and declared placeholder types', () => {
    const variants: CatalogManifest = {
      ...manifest,
      keys: {
        labels: {
          type: 'stringArray',
          defaultValue: ['Eintrag {{count}}'],
          placeholders: { count: 'number' },
          allowEmpty: false,
        },
        optional: { type: 'string', defaultValue: '', placeholders: {}, allowEmpty: true },
      },
    };
    expect(validateCatalogManifest(variants)).toEqual(variants);
    expect(
      validateCatalogValue(variants, 'labels', ['Item {{count}}', 'Result {{count}}'])
    ).toHaveLength(2);
    expect(validateCatalogValue(variants, 'optional', '')).toBe('');
    for (const bad of [['Missing token'], [42], [], 'Wrong type'])
      expect(() => validateCatalogValue(variants, 'labels', bad)).toThrow('invalid_catalog');
    expect(() => validateCatalogManifest({ ...manifest, contractId: '../bad' })).toThrow();
    expect(() =>
      validateCatalogManifest({ ...manifest, appCompatibility: { minVersion: 'invalid' } })
    ).toThrow();
    expect(() => validateCatalogLocales(['en'])).toThrow();
    expect(() => validateCatalogLocales(['de', '../xx'])).toThrow();
  });
  it('seals all approved languages under one set revision without a provider', async () => {
    const multilingual = structuredClone(draft);
    multilingual.supportedLocales = validateCatalogLocales([...APP_TRANSLATION_LOCALES]);
    for (const locale of multilingual.supportedLocales)
      if (locale !== 'de')
        multilingual.valuesByLocale[locale] = {
          greeting: {
            value: 'Hello {{name}}',
            origin: 'manual',
            sourceDigest: await catalogDigest('Hallo {{name}}'),
            confirmedSourceDigest: await catalogDigest('Hallo {{name}}'),
          },
        };
    const result = await prepareCatalogRelease(multilingual, null, '17');
    expect(Object.keys(result.catalogs)).toHaveLength(20);
    expect(
      Object.values(result.catalogs).every(
        (artifact) => artifact.catalogSetRevision === '17' && artifact.fallbackKeys.length === 0
      )
    ).toBe(true);
  });
  it('keeps machine standards under manual corrections and validates their real source', async () => {
    const base: CatalogRelease = {
      id: 'base',
      scope: { kind: 'global' },
      manifestId: 'manifest',
      contractId: manifest.contractId,
      catalogSetRevision: '1',
      draftRevision: '1',
      baseReleaseId: null,
      supportedLocales: ['de'],
      state: 'sealed',
      ...(await prepareCatalogRelease({ ...draft, supportedLocales: ['de'] }, null, '1')),
    };
    const standardDigest = await catalogDigest('Hallo {{name}}');
    const municipal: CatalogDraft = {
      ...structuredClone(draft),
      scope: { kind: 'municipal', instanceId: 'a', organizationId: 'org' },
      baseReleaseId: base.id,
      machineStandardValuesByLocale: {
        en: {
          greeting: {
            value: 'Hello {{name}}',
            origin: 'machine',
            sourceDigest: standardDigest,
            confirmedSourceDigest: null,
            sourceKind: 'standard',
            targetCode: 'en-GB',
          },
        },
      },
    };
    municipal.valuesByLocale.de!.greeting!.value = 'Guten Tag {{name}}';
    municipal.machineStandardValuesByLocale!.en!.retired = structuredClone(
      municipal.machineStandardValuesByLocale!.en!.greeting!
    );
    expect(
      (await prepareCatalogRelease(municipal, base, '2', { en: 'en-GB' })).catalogs.en?.values
        .retired
    ).toBeUndefined();
    expect(municipal.machineStandardValuesByLocale!.en!.retired).toBeDefined();
    expect(
      (await prepareCatalogRelease(municipal, base, '2', { en: 'en-GB' })).catalogs.en?.values
        .greeting
    ).toBe('Hello {{name}}');
    municipal.valuesByLocale.en = {
      greeting: {
        value: 'Welcome {{name}}',
        origin: 'manual',
        sourceDigest: standardDigest,
        confirmedSourceDigest: standardDigest,
        sourceKind: 'standard',
        targetCode: 'en-GB',
      },
    };
    expect(
      (await prepareCatalogRelease(municipal, base, '3', { en: 'en-GB' })).catalogs.en?.values
        .greeting
    ).toBe('Welcome {{name}}');
    await expect(prepareCatalogRelease(municipal, base, '4', { en: 'en-US' })).rejects.toThrow(
      'catalog_review_required'
    );
    delete municipal.valuesByLocale.en;
    municipal.machineStandardValuesByLocale!.en!.greeting!.sourceDigest = 'stale';
    await expect(prepareCatalogRelease(municipal, base, '5', { en: 'en-GB' })).rejects.toThrow(
      'catalog_review_required'
    );
  });
  it('keeps inherited languages independent from a German municipal override', async () => {
    const source = structuredClone(draft);
    source.valuesByLocale.en = {
      greeting: {
        value: 'Hello {{name}}',
        origin: 'manual',
        sourceDigest: '',
        confirmedSourceDigest: await catalogDigest('Hallo {{name}}'),
      },
    };
    const prepared = await prepareCatalogRelease(source, null, '1');
    const base: CatalogRelease = {
      id: 'base',
      scope: { kind: 'global' },
      manifestId: 'manifest',
      contractId: manifest.contractId,
      catalogSetRevision: '1',
      draftRevision: '1',
      baseReleaseId: null,
      supportedLocales: ['de', 'en'],
      ...prepared,
      state: 'sealed',
    };
    const municipal = {
      ...structuredClone(draft),
      scope: { kind: 'municipal' as const, instanceId: 'a', organizationId: 'org' },
      baseReleaseId: base.id,
      valuesByLocale: {
        de: {
          greeting: {
            value: 'Guten Tag {{name}}',
            origin: 'manual' as const,
            sourceDigest: '',
            confirmedSourceDigest: null,
          },
        },
      },
    };
    expect((await prepareCatalogRelease(municipal, base, '2')).catalogs.en?.values.greeting).toBe(
      'Hello {{name}}'
    );
    await expect(
      prepareCatalogRelease(municipal, { ...base, manifestId: 'other' }, '2')
    ).rejects.toThrow('catalog_conflict');
  });
});

describe('DeepL settings', () => {
  const config = {
    revision: 'v1',
    credentialRevision: 'key1',
    plan: 'pro',
    englishVariant: 'en-GB',
    selectedLocales: ['en'],
    availableLanguages: [{ code: 'en-GB', name: 'English', tagHandling: true }],
  };
  it('requires supported unique targets and keeps the English variant explicit', () => {
    expect(readDeepLSettings(config)?.selectedLocales).toEqual(['en']);
    expect(deepLTargetCode('en', 'en-GB')).toBe('en-GB');
    for (const selectedLocales of [['de'], ['de-CH'], ['../xx'], ['en', 'en'], ['pt-PT', 'pt-BR']])
      expect(readDeepLSettings({ ...config, selectedLocales })).toBeUndefined();
    expect(readDeepLSettings({ ...config, availableLanguages: [{}] })).toBeUndefined();
    expect(
      readDeepLSettings({ ...config, selectedLocales: ['ar', 'fr-CA', 'pt-BR', 'zh-Hant'] })
        ?.selectedLocales
    ).toEqual(['ar', 'fr-CA', 'pt-BR', 'zh-Hant']);
    expect(validateCatalogLocales(['de', 'ar', 'fr-CA', 'pt-BR', 'zh-Hant'])).toEqual([
      'ar',
      'de',
      'fr-CA',
      'pt-BR',
      'zh-Hant',
    ]);
    expect(() => validateCatalogLocales(['de', 'pt-br'])).toThrow();
  });
});
