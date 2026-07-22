import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_LOCALE, i18nResources } from '../../apps/sva-studio-react/src/i18n/resources';
import { pluginEventsTranslations } from '../../packages/plugin-events/src/plugin.translations';
import { pluginFaqTranslations } from '../../packages/plugin-faq/src/plugin.translations';
import { pluginNewsTranslations } from '../../packages/plugin-news/src/plugin.translations';
import { pluginPoiTranslations } from '../../packages/plugin-poi/src/plugin.translations';
import { wasteManagementPluginTranslations } from '../../packages/plugin-waste-management/src/plugin.translations';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../..');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const I18N_USAGE_PATTERN = /\b(?:t|pt)\(\s*(['"`])([^'"`]+)\1/g;

export const SOURCE_ROOTS = [
  'apps/sva-studio-react/src',
  'packages/plugin-news/src',
  'packages/plugin-events/src',
  'packages/plugin-faq/src',
  'packages/plugin-poi/src',
  'packages/plugin-waste-management/src',
] as const;

const SOURCE_ROOT_CONFIGS = [
  { relativeRoot: 'apps/sva-studio-react/src', namespace: null },
  { relativeRoot: 'packages/plugin-news/src', namespace: 'news' },
  { relativeRoot: 'packages/plugin-events/src', namespace: 'events' },
  { relativeRoot: 'packages/plugin-faq/src', namespace: 'faq' },
  { relativeRoot: 'packages/plugin-poi/src', namespace: 'poi' },
  { relativeRoot: 'packages/plugin-waste-management/src', namespace: 'wasteManagement' },
] as const;

const pluginTranslationResources = [
  pluginNewsTranslations,
  pluginEventsTranslations,
  pluginFaqTranslations,
  pluginPoiTranslations,
  wasteManagementPluginTranslations,
] as const;

type TranslationNode = Readonly<Record<string, unknown>>;
type SourceFileContext = Readonly<{
  filePath: string;
  namespace: string | null;
}>;
type TranslationKeyExtractionOptions = Readonly<{
  namespace?: string | null;
}>;

const flattenTranslationKeys = (input: TranslationNode, prefix = ''): string[] => {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      keys.push(nextPrefix);
      continue;
    }

    if (value && typeof value === 'object') {
      keys.push(...flattenTranslationKeys(value as TranslationNode, nextPrefix));
    }
  }

  return keys;
};

const isTestSourceFile = (fileName: string): boolean => /\.(?:test|spec)\.[jt]sx?$/u.test(fileName);

const collectSourceFiles = async (directory: string, namespace: string | null): Promise<SourceFileContext[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: SourceFileContext[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath, namespace)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    if (isTestSourceFile(entry.name)) {
      continue;
    }

    files.push({ filePath: entryPath, namespace });
  }

  return files;
};

const resolveSourceRoot = (relativeRoot: string): string => path.join(PROJECT_ROOT, relativeRoot);

export const collectTranslationKeysFromSource = (
  sourceCode: string,
  options: TranslationKeyExtractionOptions = {}
): Set<string> => {
  const keyMatches = new Set<string>();

  for (const match of sourceCode.matchAll(I18N_USAGE_PATTERN)) {
    const functionName = match[0]?.startsWith('pt(') ? 'pt' : 't';
    const key = match[2]?.trim();
    if (!key || key.includes('${')) {
      continue;
    }

    if (functionName === 'pt' && options.namespace) {
      keyMatches.add(`${options.namespace}.${key}`);
      continue;
    }

    keyMatches.add(key);
  }

  return keyMatches;
};

const collectUsedTranslationKeys = async (
  files: readonly SourceFileContext[]
): Promise<Map<string, Set<string>>> => {
  const usedByFile = new Map<string, Set<string>>();

  for (const { filePath, namespace } of files) {
    const sourceCode = await readFile(filePath, 'utf8');
    const keyMatches = collectTranslationKeysFromSource(sourceCode, { namespace });

    if (keyMatches.size > 0) {
      usedByFile.set(filePath, keyMatches);
    }
  }

  return usedByFile;
};

const ensureLocaleParity = (): string[] => {
  const localeKeys = Object.fromEntries(
    Object.entries(i18nResources).map(([locale, translations]) => [locale, new Set(flattenTranslationKeys(translations))])
  ) as Record<string, Set<string>>;

  const referenceKeys = localeKeys[DEFAULT_LOCALE];
  if (!referenceKeys) {
    return [`Default locale '${DEFAULT_LOCALE}' existiert nicht in i18nResources.`];
  }

  const problems: string[] = [];

  for (const [locale, keys] of Object.entries(localeKeys)) {
    if (locale === DEFAULT_LOCALE) {
      continue;
    }

    const missingInLocale = [...referenceKeys].filter((key) => !keys.has(key));
    const extraInLocale = [...keys].filter((key) => !referenceKeys.has(key));

    if (missingInLocale.length > 0) {
      problems.push(`Locale '${locale}' fehlen ${missingInLocale.length} Keys: ${missingInLocale.join(', ')}`);
    }

    if (extraInLocale.length > 0) {
      problems.push(`Locale '${locale}' hat ${extraInLocale.length} unbekannte Keys: ${extraInLocale.join(', ')}`);
    }
  }

  return problems;
};

export const collectAvailableKeys = (): Set<string> => {
  const availableKeys = new Set(flattenTranslationKeys(i18nResources[DEFAULT_LOCALE]));

  for (const resources of pluginTranslationResources) {
    for (const key of flattenTranslationKeys(resources[DEFAULT_LOCALE] as TranslationNode)) {
      availableKeys.add(key);
    }
  }

  return availableKeys;
};

const run = async (): Promise<void> => {
  const parityProblems = ensureLocaleParity();

  const fileGroups = await Promise.all(
    SOURCE_ROOT_CONFIGS.map(({ relativeRoot, namespace }) => collectSourceFiles(resolveSourceRoot(relativeRoot), namespace))
  );
  const files = fileGroups.flat();
  const usedByFile = await collectUsedTranslationKeys(files);

  const availableKeys = collectAvailableKeys();
  const missingUsageKeys: string[] = [];

  for (const [filePath, keys] of usedByFile.entries()) {
    for (const key of keys) {
      if (!availableKeys.has(key)) {
        missingUsageKeys.push(`${path.relative(PROJECT_ROOT, filePath)} -> ${key}`);
      }
    }
  }

  if (parityProblems.length > 0 || missingUsageKeys.length > 0) {
    console.error('i18n-Key-Check fehlgeschlagen.');

    if (parityProblems.length > 0) {
      console.error('\nLocale-Paritaet:');
      for (const problem of parityProblems) {
        console.error(`- ${problem}`);
      }
    }

    if (missingUsageKeys.length > 0) {
      console.error('\nFehlende Keys aus t(...) Aufrufen:');
      for (const entry of missingUsageKeys) {
        console.error(`- ${entry}`);
      }
    }

    process.exit(1);
  }

  const usedKeyCount = [...usedByFile.values()].reduce((acc, current) => acc + current.size, 0);
  console.info(`i18n-Key-Check erfolgreich (${usedKeyCount} verwendete Keys, ${availableKeys.size} definierte Keys).`);
};

void run().catch((error: unknown) => {
  console.error('i18n-Key-Check fehlgeschlagen (unerwarteter Fehler).');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
