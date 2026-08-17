#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const workerPasswordKey = 'STUDIO_JOB_WORKER_DB_PASSWORD';

export const injectWorkerDatabaseSecret = (source: string, secret: string): string => {
  if (secret.trim().length < 32 || /[\r\n]/u.test(secret)) {
    throw new Error(`${workerPasswordKey} fehlt, ist zu kurz oder enthält einen Zeilenumbruch`);
  }

  const protectedPasswords = source
    .split(/\r?\n/u)
    .filter((line) => line.startsWith('APP_DB_PASSWORD=') || line.startsWith('POSTGRES_PASSWORD='))
    .map((line) => line.slice(line.indexOf('=') + 1));
  if (protectedPasswords.includes(secret)) {
    throw new Error(`${workerPasswordKey} muss sich von den bestehenden Datenbank-Passwörtern unterscheiden`);
  }

  const retainedLines = source
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0 && !line.startsWith(`${workerPasswordKey}=`));
  if (retainedLines.length === 0) {
    throw new Error('Die ausgewählte Remote-Konfiguration ist leer');
  }

  return `${retainedLines.join('\n')}\n${workerPasswordKey}=${secret}\n`;
};

export const runInjectWorkerDatabaseSecret = (
  args: readonly string[],
  secret = process.env.STUDIO_JOB_WORKER_DB_PASSWORD ?? ''
): number => {
  const inputIndex = args.indexOf('--input');
  const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  if (!inputPath) return 2;

  try {
    const source = readFileSync(inputPath, 'utf8');
    writeFileSync(inputPath, injectWorkerDatabaseSecret(source, secret), { encoding: 'utf8', mode: 0o600 });
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runInjectWorkerDatabaseSecret(process.argv.slice(2)));
}
