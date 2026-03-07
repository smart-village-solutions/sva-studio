import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_LOCALE, i18nResources } from '../../apps/sva-studio-react/src/i18n/resources';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../..');
const APP_SOURCE_DIR = path.join(PROJECT_ROOT, 'apps/sva-studio-react/src');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const I18N_USAGE_PATTERN = /\bt\(\s*(['"`])([^'"`]+)\1/g;

type TranslationNode = Readonly<Record<string, unknown>>;

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

const collectSourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    files.push(entryPath);
  }

  return files;
};

const collectUsedTranslationKeys = async (files: readonly string[]): Promise<Map<string, Set<string>>> => {
  const usedByFile = new Map<string, Set<string>>();

  for (const filePath of files) {
    const sourceCode = await readFile(filePath, 'utf8');
    const keyMatches = new Set<string>();

    for (const match of sourceCode.matchAll(I18N_USAGE_PATTERN)) {
      const key = match[2]?.trim();
      if (key) {
        keyMatches.add(key);
      }
    }

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

const run = async (): Promise<void> => {
  const parityProblems = ensureLocaleParity();

  const files = await collectSourceFiles(APP_SOURCE_DIR);
  const usedByFile = await collectUsedTranslationKeys(files);

  const availableKeys = new Set(flattenTranslationKeys(i18nResources[DEFAULT_LOCALE]));
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
