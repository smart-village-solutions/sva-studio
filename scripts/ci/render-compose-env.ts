#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;

const quoteComposeEnvValue = (value: string): string => `'${value.replaceAll("'", "\\'")}'`;

export const renderComposeEnv = (source: string): string => {
  const renderedLines = source.split(/\r?\n/u).flatMap((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      return [];
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 1) {
      throw new Error(`Ungültiger APP_CONFIG-Eintrag in Zeile ${index + 1}: KEY=VALUE erwartet.`);
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!ENV_KEY_PATTERN.test(key)) {
      throw new Error(`Ungültiger APP_CONFIG-Schlüssel in Zeile ${index + 1}: ${key}`);
    }

    const value = line.slice(separatorIndex + 1);
    return [`${key}=${quoteComposeEnvValue(value)}`];
  });

  if (renderedLines.length === 0) {
    throw new Error('APP_CONFIG enthält keine Umgebungsvariablen.');
  }

  return `${renderedLines.join('\n')}\n`;
};

export const runRenderComposeEnv = (args: readonly string[], appConfig = process.env.APP_CONFIG ?? ''): number => {
  const outputIndex = args.indexOf('--output');
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  if (!outputPath) {
    process.stderr.write('Fehlender Wert für --output.\n');
    return 2;
  }

  try {
    writeFileSync(outputPath, renderComposeEnv(appConfig), { encoding: 'utf8', mode: 0o600 });
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runRenderComposeEnv(process.argv.slice(2)));
}
