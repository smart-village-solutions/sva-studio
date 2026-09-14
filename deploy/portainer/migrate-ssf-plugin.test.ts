import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  assertDistinctDatabaseNames,
  assertSafeDatabaseLogins,
  readDatabasePassword,
} from './ssf-plugin-database-config.mjs';

describe('SSF plugin migration runner', () => {
  it('passes secret-bearing SQL to psql through stdin instead of process arguments', () => {
    const source = readFileSync(new URL('./migrate-ssf-plugin.mjs', import.meta.url), 'utf8');

    expect(source).toContain("'--file=-'");
    expect(source).toContain('input: sql');
    expect(source).not.toMatch(/['"]-c['"],\s*sql/u);
  });

  it('reconciles distinct runtime and root login roles', () => {
    const source = readFileSync(new URL('./migrate-ssf-plugin.mjs', import.meta.url), 'utf8');

    expect(source).toContain('SSF_PLUGIN_RUNTIME_DB_PASSWORD');
    expect(source).toContain('ssf_plugin_tenant_runtime');
    expect(source).toContain('SSF_PLUGIN_ROOT_DB_PASSWORD');
    expect(source).toContain('ssf_plugin_root');
    expect(source).toContain(
      'assertSafeDatabaseLogins({ postgresUser, rootLogin, runtimeLogin });'
    );
  });

  it('reads a role password only from a connection string bound to that role and database', () => {
    expect(
      readDatabasePassword({
        connectionString:
          'postgresql://sva_ssf_runtime:p%40ss@postgres:5432/sva_studio_ssf?sslmode=disable',
        expectedDatabase: 'sva_studio_ssf',
        expectedUser: 'sva_ssf_runtime',
        name: 'SVA_STUDIO_SSF_DATABASE_URL',
      })
    ).toBe('p@ss');
    expect(() =>
      readDatabasePassword({
        connectionString: 'postgresql://other:secret@postgres/sva_studio_ssf',
        expectedDatabase: 'sva_studio_ssf',
        expectedUser: 'sva_ssf_runtime',
        name: 'SVA_STUDIO_SSF_DATABASE_URL',
      })
    ).toThrow('SVA_STUDIO_SSF_DATABASE_URL_user_mismatch');
    expect(() =>
      readDatabasePassword({
        connectionString: 'postgresql://sva_ssf_runtime:secret@postgres/other',
        expectedDatabase: 'sva_studio_ssf',
        expectedUser: 'sva_ssf_runtime',
        name: 'SVA_STUDIO_SSF_DATABASE_URL',
      })
    ).toThrow('SVA_STUDIO_SSF_DATABASE_URL_database_mismatch');
  });

  it.each([
    {
      expectedError: 'SSF_PLUGIN_DATABASE_USERS_must_differ',
      rootLogin: 'shared_login',
      runtimeLogin: 'shared_login',
    },
    {
      expectedError: 'SSF_PLUGIN_RUNTIME_DB_USER_reserved',
      rootLogin: 'sva_ssf_root',
      runtimeLogin: 'sva',
    },
    {
      expectedError: 'SSF_PLUGIN_ROOT_DB_USER_reserved',
      rootLogin: 'sva',
      runtimeLogin: 'sva_ssf_runtime',
    },
    {
      expectedError: 'SSF_PLUGIN_RUNTIME_DB_USER_reserved',
      rootLogin: 'sva_ssf_root',
      runtimeLogin: 'ssf_plugin_tenant_runtime',
    },
    {
      expectedError: 'SSF_PLUGIN_ROOT_DB_USER_reserved',
      rootLogin: 'ssf_plugin_root',
      runtimeLogin: 'sva_ssf_runtime',
    },
  ])('rejects unsafe migration login names: $expectedError', (input) => {
    expect(() => assertSafeDatabaseLogins({ postgresUser: 'sva', ...input })).toThrow(
      input.expectedError
    );
  });

  it('accepts distinct unreserved migration login names', () => {
    expect(() =>
      assertSafeDatabaseLogins({
        postgresUser: 'sva',
        rootLogin: 'sva_ssf_root',
        runtimeLogin: 'sva_ssf_runtime',
      })
    ).not.toThrow();
  });

  it('rejects the Studio IAM database as the SSF migration target', () => {
    expect(() =>
      assertDistinctDatabaseNames({
        adminDatabase: 'sva_studio',
        targetDatabase: 'sva_studio',
      })
    ).toThrow('SSF_PLUGIN_DATABASE_NAME_matches_POSTGRES_DB');
  });
});
