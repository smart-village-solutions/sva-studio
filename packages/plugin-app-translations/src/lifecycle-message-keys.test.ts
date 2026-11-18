import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { isPluginOwnedMessageKey } from '@sva/plugin-sdk';
import { describe, expect, it } from 'vitest';

import { appTranslationsPlugin } from './descriptor.js';

// Readiness checks are reported by src/server.ts.
// Vitest runs with the package root as working directory.
const sourceDir = resolve(process.cwd(), 'src');

const readEmittedMessageKeys = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .flatMap((file) =>
      [...readFileSync(join(dir, file), 'utf8').matchAll(/messageKey:\s*'([^']+)'/g)].map(
        (match) => match[1] as string
      )
    );

describe('App translations lifecycle message keys', () => {
  it('ships de and en text for every message key it reports', () => {
    const emitted = readEmittedMessageKeys(sourceDir);

    expect(emitted.length).toBeGreaterThan(0);
    expect(Object.keys(appTranslationsPlugin.translations ?? {}).sort()).toEqual(['de', 'en']);
    expect(emitted.filter((key) => !isPluginOwnedMessageKey(key, appTranslationsPlugin.translations))).toEqual([]);
  });
});
