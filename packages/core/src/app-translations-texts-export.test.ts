import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  catalogDigest,
  prepareCatalogRelease,
  validateCatalogManifest,
  type CatalogDraft,
  type CatalogRelease,
  type CatalogTexts,
  catalogAssert,
} from './app-translations.js';
import { exportCatalogTextsJs } from './app-translations-texts-export.js';
const fixture = new URL('../tests/fixtures/mobile-texts/', import.meta.url);
const manifest = validateCatalogManifest(
  JSON.parse(readFileSync(new URL('manifest.json', fixture), 'utf8'))
);
const reference = readFileSync(new URL('texts.reference.js', fixture), 'utf8');
const scope = {
  kind: 'municipal' as const,
  instanceId: 'town',
  organizationId: '11111111-1111-4111-8111-111111111111',
};
const release = async (overrides: Record<string, string> = {}) => {
  const values: CatalogTexts = {};
  for (const locale of ['de', 'en', 'fr'])
    values[locale] = Object.fromEntries(
      Object.entries(manifest.keys).map(([key, definition]) => [
        key,
        {
          value:
            locale === 'de'
              ? definition.defaultValue
              : (overrides[key] ?? `${locale}: ${definition.defaultValue}`),
          origin: 'default' as const,
          sourceDigest: '',
          confirmedSourceDigest: null,
        },
      ])
    );
  const draft: CatalogDraft = {
    id: 'draft',
    manifestId: 'manifest',
    manifest,
    scope,
    draftRevision: '9',
    supportedLocales: ['de', 'en', 'fr'],
    valuesByLocale: values,
    baseReleaseId: null,
  };
  const base: CatalogRelease = {
    id: 'base',
    scope: { kind: 'global' },
    manifestId: draft.manifestId,
    contractId: manifest.contractId,
    catalogSetRevision: '1',
    draftRevision: '9',
    baseReleaseId: null,
    supportedLocales: draft.supportedLocales,
    state: 'sealed',
    ...(await prepareCatalogRelease({ ...draft, scope: { kind: 'global' } }, null, '1')),
  };
  draft.baseReleaseId = base.id;
  return {
    id: 'release',
    scope,
    manifestId: 'manifest',
    contractId: manifest.contractId,
    catalogSetRevision: '3',
    draftRevision: '9',
    baseReleaseId: base.id,
    supportedLocales: draft.supportedLocales,
    state: 'sealed',
    ...(await prepareCatalogRelease(draft, base, '3')),
  } satisfies CatalogRelease;
};
type RuntimeCatalog = Record<string, unknown>;
type RuntimeModule = {
  texts: RuntimeCatalog;
  textsByLocale: Record<string, RuntimeCatalog>;
  setTextsLocale(locale: unknown): string;
};
const load = (source: string, name = 'Fixture App') => {
  const exports = {} as RuntimeModule;
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  runInNewContext(javascript, { exports, require: () => ({ expo: { name } }) });
  return exports;
};
const leaves = (value: RuntimeCatalog, path: string[] = []): [string[], unknown][] =>
  Object.entries(value).flatMap(([key, entry]) =>
    typeof entry === 'object' && entry !== null
      ? leaves(entry as RuntimeCatalog, [...path, key])
      : [[[...path, key], entry] as [string[], unknown]]
  );
const get = (value: RuntimeCatalog, path: string[]): unknown =>
  path.reduce<unknown>((item, key) => {
    catalogAssert(typeof item === 'object' && item !== null);
    return (item as RuntimeCatalog)[key];
  }, value);
const callable = (value: unknown): ((...args: unknown[]) => string) => {
  catalogAssert(typeof value === 'function');
  return value as (...args: unknown[]) => string;
};

describe('sealed multilingual texts.js export', () => {
  it('preserves every real App key and callable including defaults and app names', async () => {
    expect(createHash('sha256').update(reference).digest('hex')).toBe(
      'f213f1b08a758c555931734391b0733be2ba380aeded557e1a2618972511e114'
    );
    const original = load(reference).texts;
    const snapshot = await release();
    const source = await exportCatalogTextsJs(snapshot, manifest);
    const result = load(source);
    const entries = leaves(original);
    expect(entries).toHaveLength(1460);
    expect(entries.filter(([, value]) => typeof value === 'function')).toHaveLength(22);
    expect(
      leaves(result.texts)
        .map(([path]) => path)
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    ).toEqual(
      entries
        .map(([path]) => path)
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    );
    for (const [path, value] of entries) {
      const exported = get(result.texts, path);
      if (typeof value !== 'function') expect(exported).toEqual(value);
      else {
        expect(callable(exported).length).toBe(value.length);
        for (const first of [undefined, null, 0, 1, 5, 'example']) {
          const args = Array.from({ length: value.length }, (_, index) =>
            index ? 'daily' : first
          );
          expect(callable(exported)(...args)).toEqual(value(...args));
          for (const locale of ['en', 'fr']) {
            const catalog = result.textsByLocale[locale];
            catalogAssert(catalog);
            const translated = callable(get(catalog, path));
            const expected =
              path.join('.') === 'voucher.detailScreen.frequency'
                ? `${locale}: ${first || 1}x pro Person ${get(catalog, ['voucher', 'detailScreen', 'daily'])} einlösbar`
                : `${locale}: ${value(...args)}`;
            expect(translated(...args)).toBe(expected);
          }
        }
      }
    }
    expect(get(load(source, 'Another App').texts, ['screenTitles', 'home'])).toBe('Another App');
    expect(
      get(load(source, 'Another App').textsByLocale.fr as RuntimeCatalog, [
        'screenTitles',
        'events',
      ])
    ).toBe('Another App');
    expect(await exportCatalogTextsJs(snapshot, manifest)).toBe(source);
  });
  it('switches existing direct and barrel consumers centrally and keeps functions language-local', async () => {
    const module = load(await exportCatalogTextsJs(await release(), manifest));
    const barrel = {} as RuntimeModule;
    runInNewContext(
      ts.transpileModule("export * from './texts';", {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText,
      { exports: barrel, require: () => module }
    );
    const modules: Record<string, RuntimeModule> = { './texts': module, './config': barrel };
    const consumer = (specifier: string) => {
      const exports = {};
      const code = ts.transpileModule(
        `import { texts } from '${specifier}'; export const read = () => texts.close;`,
        { compilerOptions: { module: ts.ModuleKind.CommonJS } }
      ).outputText;
      runInNewContext(code, { exports, require: (name: string) => modules[name] });
      return exports as { read(): string };
    };
    const direct = consumer('./texts'),
      barrelConsumer = consumer('./config');
    expect(direct.read()).toBe('Schließen');
    expect(module.setTextsLocale('en')).toBe('en');
    expect(direct.read()).toBe('en: Schließen');
    expect(barrelConsumer.read()).toBe('en: Schließen');
    const english = callable(get(module.texts, ['voucher', 'detailScreen', 'frequency']));
    module.setTextsLocale('fr');
    expect(english(0, 'daily')).toBe(
      `en: 1x pro Person ${get(module.textsByLocale.en as RuntimeCatalog, ['voucher', 'detailScreen', 'daily'])} einlösbar`
    );
    expect(module.setTextsLocale('pt-BR')).toBe('de');
    expect(barrelConsumer.read()).toBe('Schließen');
    expect(module.setTextsLocale('__proto__')).toBe('de');
  });
  it('escapes malicious literal text and allows translated token reordering without code execution', async () => {
    const payload = '` ${globalThis.hacked = true} \\ " \n \u2028\u2029';
    const module = load(
      await exportCatalogTextsJs(
        await release({ close: payload, 'components.sueReportProgress': '{{ofStep}} / {{step}}' }),
        manifest
      )
    );
    module.setTextsLocale('en');
    expect(module.texts.close).toBe(payload);
    expect(callable(get(module.texts, ['components', 'sueReportProgress']))(2, 5)).toBe('5 / 2');
  });
  it('rejects tampered, incomplete, foreign-scope and incompatible releases as a whole', async () => {
    for (const alter of [
      (value: CatalogRelease) => {
        value.catalogs.en!.values.close = 'tampered';
      },
      (value: CatalogRelease) => {
        delete value.catalogs.fr;
      },
      (value: CatalogRelease) => {
        value.scope = { ...scope, instanceId: 'foreign' };
      },
      (value: CatalogRelease) => {
        value.checksum = '0'.repeat(64);
      },
    ]) {
      const value = await release();
      alter(value);
      await expect(exportCatalogTextsJs(value, manifest)).rejects.toThrow();
    }
    await expect(
      exportCatalogTextsJs(await release(), { ...manifest, manifestVersion: 'other' })
    ).rejects.toThrow('catalog_export_incompatible');
    const invalid = await release();
    invalid.catalogs.en!.values.close = ['unexpected array'];
    await expect(exportCatalogTextsJs(invalid, manifest)).rejects.toThrow();
  });
  it('rejects size, token and type violations even when checksums have been recomputed', async () => {
    const resign = async (snapshot: CatalogRelease) => {
      const { checksum, ...payload } = snapshot.catalogs.en!;
      expect(checksum).toHaveLength(64);
      snapshot.catalogs.en!.checksum = await catalogDigest(payload);
      const entries = snapshot.descriptor.catalogs as { locale: string; checksum: string }[];
      entries.find((entry) => entry.locale === 'en')!.checksum = snapshot.catalogs.en!.checksum;
      snapshot.checksum = await catalogDigest(snapshot.descriptor);
    };
    for (const value of ['Missing tokens', ['wrong type']]) {
      const snapshot = await release();
      snapshot.catalogs.en!.values['components.sueReportProgress'] = value;
      await resign(snapshot);
      await expect(exportCatalogTextsJs(snapshot, manifest)).rejects.toThrow();
    }
    const large = await release();
    large.catalogs.en!.values.close = 'x'.repeat(8 * 1024 * 1024);
    await expect(exportCatalogTextsJs(large, manifest)).rejects.toThrow();
    const invalidRevision = await release();
    invalidRevision.catalogSetRevision = '1\nmalicious';
    await expect(exportCatalogTextsJs(invalidRevision, manifest)).rejects.toThrow();
  });
});
