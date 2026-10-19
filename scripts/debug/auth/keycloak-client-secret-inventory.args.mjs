import { existsSync, readFileSync } from 'node:fs';

const booleanArguments = new Map([
  ['--help', 'help'],
  ['-h', 'help'],
  ['--json', 'json'],
  ['--markdown', 'markdown'],
  ['--reveal', 'reveal'],
  ['--sync-db', 'sync-db'],
]);

export const parseArgs = (argv) => {
  const args = {};
  for (const raw of argv) {
    const booleanKey = booleanArguments.get(raw);
    if (booleanKey) {
      args[booleanKey] = true;
      continue;
    }
    const match = raw.match(/^--([^=]+)=(.*)$/u);
    if (!match) {
      throw new Error(`Unbekanntes Argument: ${raw}`);
    }
    const key = match[1];
    if (key === 'env-file' || key === 'load-env-file' || key === 'keyring-env-file') {
      args[key] = args[key] ? `${args[key]},${match[2]}` : match[2];
    } else {
      args[key] = match[2];
    }
  }
  return args;
};

const stripOptionalQuotes = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const loadEnvFile = (path, filter = () => true) => {
  if (!path) return;
  if (!existsSync(path)) {
    throw new Error(`Env-Datei nicht gefunden: ${path}`);
  }
  const content = readFileSync(path, 'utf8');
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!filter(key)) continue;
    const value = stripOptionalQuotes(trimmed.slice(separatorIndex + 1));
    process.env[key] = value;
  }
};

export const loadEnvFiles = (value) => {
  for (const path of readList(value)) {
    loadEnvFile(path);
  }
};

export const loadKeyringEnvFiles = (value) => {
  for (const path of readList(value)) {
    loadEnvFile(path, (key) => key.startsWith('IAM_PII_'));
  }
};

export const readList = (value) =>
  String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

export const requireValue = (value, name) => {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} fehlt.`);
  }
  return normalized;
};

export const trimTrailingSlash = (value) => value.replace(/\/+$/u, '');
export const DEFAULT_CLIENT_IDS = ['sva-studio', 'sva-studio-admin'];
