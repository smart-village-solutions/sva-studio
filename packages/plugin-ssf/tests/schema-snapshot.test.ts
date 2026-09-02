import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('SSF plugin schema snapshot', () => {
  it('matches all up migrations exactly', () => {
    const migrationFiles = [
      '0001_ssf_runtime_configuration.sql',
      '0002_ssf_authorization_projection.sql',
    ] as const;
    const snapshot = readFileSync(
      new URL('../../../docs/development/ssf-plugin-db-schema-final.sql', import.meta.url),
      'utf8'
    );
    const upSql = migrationFiles
      .map((migrationFile) =>
        readFileSync(new URL(`../migrations/${migrationFile}`, import.meta.url), 'utf8')
          .split('-- +goose Down')[0]
          ?.split('\n')
          .filter((line) => !line.startsWith('-- +goose '))
          .join('\n')
          .trim()
      )
      .join('\n\n');
    const expected = [
      '-- SSF-Plugin-Datenbank: reproduzierbarer Sollstand für Runtime-Konfiguration V1',
      '-- Quelle: packages/plugin-ssf/migrations/0001_*.sql bis 0002_*.sql',
      '-- Diese Datenbank ist getrennt von sva_studio.',
      '',
      upSql,
      '',
    ].join('\n');

    expect(`${snapshot.trimEnd()}\n`).toBe(expected);
  });
});
