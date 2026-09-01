import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('SSF plugin schema snapshot', () => {
  it('matches the up migration exactly', () => {
    const migration = readFileSync(
      new URL('../migrations/0001_ssf_runtime_configuration.sql', import.meta.url),
      'utf8'
    );
    const snapshot = readFileSync(
      new URL('../../../docs/development/ssf-plugin-db-schema-final.sql', import.meta.url),
      'utf8'
    );
    const upSql = migration
      .split('-- +goose Down')[0]
      ?.split('\n')
      .filter((line) => !line.startsWith('-- +goose '))
      .join('\n')
      .trim();
    const expected = [
      '-- SSF-Plugin-Datenbank: reproduzierbarer Sollstand für Runtime-Konfiguration V1',
      '-- Quelle: packages/plugin-ssf/migrations/0001_ssf_runtime_configuration.sql',
      '-- Diese Datenbank ist getrennt von sva_studio.',
      '',
      upSql,
      '',
    ].join('\n');

    expect(`${snapshot.trimEnd()}\n`).toBe(expected);
  });
});
