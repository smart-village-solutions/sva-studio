import fs from 'node:fs';
import path from 'node:path';

const SONAR_PROJECT_PROPERTIES = 'sonar-project.properties';
const COVERAGE_EXCLUSIONS_KEY = 'sonar.coverage.exclusions';

const normalizePath = (value: string): string => value.replaceAll('\\', '/').split(path.sep).join('/');

const escapeRegExp = (value: string): string => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');

const toGlobRegExp = (pattern: string): RegExp => {
  let source = '';

  for (let index = 0; index < pattern.length; ) {
    const char = pattern[index];
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*';
        index += 2;
        continue;
      }

      source += '[^/]*';
      index += 1;
      continue;
    }

    source += escapeRegExp(char);
    index += 1;
  }

  return new RegExp(`^${source}$`);
};

const parseProperties = (contents: string): Map<string, string> => {
  const entries = new Map<string, string>();

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    entries.set(trimmed.slice(0, separatorIndex).trim(), trimmed.slice(separatorIndex + 1).trim());
  }

  return entries;
};

export const readSonarCoverageExclusions = (rootDir: string): string[] => {
  const propertiesPath = path.join(rootDir, SONAR_PROJECT_PROPERTIES);
  if (!fs.existsSync(propertiesPath)) {
    return [];
  }

  const rawValue = parseProperties(fs.readFileSync(propertiesPath, 'utf8')).get(COVERAGE_EXCLUSIONS_KEY);
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

export const isSonarCoverageExcludedPath = (filePath: string, exclusions: readonly string[]): boolean => {
  const normalizedPath = normalizePath(filePath);
  return exclusions.some((pattern) => toGlobRegExp(normalizePath(pattern)).test(normalizedPath));
};
