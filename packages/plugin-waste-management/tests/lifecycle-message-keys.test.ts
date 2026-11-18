import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { isPluginOwnedMessageKey } from '@sva/plugin-sdk';
import { describe, expect, it } from 'vitest';

import { wasteManagementPluginTranslations } from '../src/plugin.translations.js';

// The readiness operation runs in @sva/waste-management-runtime but renders this plugin's text.
// Vitest runs with the package root as working directory.
const sourceDir = resolve(process.cwd(), '../waste-management-runtime/src');

const readEmittedMessageKeys = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .flatMap((file) =>
      [...readFileSync(join(dir, file), 'utf8').matchAll(/messageKey:\s*'([^']+)'/g)].map(
        (match) => match[1] as string
      )
    );

describe('Waste management lifecycle message keys', () => {
  it('ships de and en text for every message key it reports', () => {
    const emitted = readEmittedMessageKeys(sourceDir);

    expect(emitted.length).toBeGreaterThan(0);
    expect(Object.keys(wasteManagementPluginTranslations).sort()).toEqual(['de', 'en']);
    expect(emitted.filter((key) => !isPluginOwnedMessageKey(key, wasteManagementPluginTranslations))).toEqual([]);
  });
});
