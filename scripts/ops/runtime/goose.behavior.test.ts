import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listGooseMigrationFiles, runGooseAgainstAcceptance } from './goose.ts';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  reconcileAppTranslationMigrations,
  type MigrationClient,
} from '../reconcile-app-translation-migrations.ts';
const requireFromAuthRuntime = createRequire(
  createRequire(import.meta.url).resolve('@sva/auth-runtime')
);
const { Client } = requireFromAuthRuntime('pg') as {
  Client: new (options: { connectionString: string }) => MigrationClient;
};

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const setup = () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'goose-characterization-'));
  roots.push(rootDir);
  const migrationsDir = join(rootDir, 'packages/data/migrations');
  mkdirSync(migrationsDir, { recursive: true });
  writeFileSync(join(migrationsDir, '001_create.sql'), 'SELECT 1;\n');
  return { rootDir, migrationsDir };
};

const config = { repo: 'pressly/goose', version: 'v3.1.0' };

describe('goose acceptance execution', () => {
  it('runs the local container command and cleans staged assets after an execution error', () => {
    const { rootDir, migrationsDir } = setup();
    const calls: string[][] = [];
    const deps: Parameters<typeof runGooseAgainstAcceptance>[0] = {
      commandExists: vi.fn(() => true),
      getConfiguredStackName: vi.fn(() => 'studio'),
      rootDir,
      run: vi.fn((_root, _command, args) => {
        calls.push([...args]);
      }),
      runAcceptanceServiceScript: vi.fn(() => ''),
      runCapture: vi.fn((_root, command, args) => {
        if (command === 'bash') return '/tmp/goose';
        if (args[0] === 'ps') return 'container-1';
        throw new Error('goose failed');
      }),
      shellEscape: (value) => `'${value}'`,
    };

    expect(() =>
      runGooseAgainstAcceptance(
        deps,
        config,
        migrationsDir,
        '/repo/run-goose.sh',
        { POSTGRES_PASSWORD: 'secret' },
        'studio',
        'up'
      )
    ).toThrow('goose failed');
    expect(calls.map((args) => args.slice(0, 4))).toEqual([
      ['exec', 'container-1', 'rm', '-rf'],
      ['exec', 'container-1', 'mkdir', '-p'],
      ['cp', '/tmp/goose', 'container-1:/var/tmp/sva-goose/goose'],
      ['exec', 'container-1', 'chmod', '+x'],
      ['cp', `${migrationsDir}/.`, 'container-1:/var/tmp/sva-goose/migrations/'],
      ['exec', 'container-1', 'rm', '-rf'],
    ]);
  });

  it('reads remote status without applying SQL and propagates a remote database error', () => {
    const { rootDir, migrationsDir } = setup();
    const scripts: string[] = [];
    const runAcceptanceServiceScript = vi.fn((_env, _service, script: string) => {
      scripts.push(script);
      if (script.includes('SELECT version_id')) throw new Error('database unavailable');
      return '';
    });
    const deps: Parameters<typeof runGooseAgainstAcceptance>[0] = {
      commandExists: vi.fn(() => true),
      getConfiguredStackName: vi.fn(() => 'studio'),
      rootDir,
      run: vi.fn(),
      runAcceptanceServiceScript,
      runCapture: vi.fn(() => ''),
      shellEscape: (value) => `'${value}'`,
    };

    expect(() =>
      runGooseAgainstAcceptance(
        deps,
        config,
        migrationsDir,
        '/repo/run-goose.sh',
        { POSTGRES_PASSWORD: 'secret' },
        'studio',
        'status'
      )
    ).toThrow('database unavailable');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain('SELECT version_id');
    expect(scripts[0]).not.toContain('INSERT INTO goose_db_version');
  });

  it('uploads remote assets before querying status and applies only pending migrations', () => {
    const { rootDir, migrationsDir } = setup();
    writeFileSync(join(migrationsDir, '002_add_column.sql'), 'SELECT 2;\n');
    const scripts: string[] = [];
    const deps: Parameters<typeof runGooseAgainstAcceptance>[0] = {
      commandExists: vi.fn(() => true),
      getConfiguredStackName: vi.fn(() => 'studio'),
      rootDir,
      run: vi.fn(),
      runAcceptanceServiceScript: vi.fn((_env, _service, script: string) => {
        scripts.push(script);
        if (script.includes('SELECT version_id')) return '1\n';
        if (script.includes('INSERT INTO goose_db_version')) return 'applied:002_add_column.sql';
        return '';
      }),
      runCapture: vi.fn(() => ''),
      shellEscape: (value) => `'${value}'`,
    };

    const result = runGooseAgainstAcceptance(
      deps,
      config,
      migrationsDir,
      '/repo/run-goose.sh',
      { POSTGRES_PASSWORD: 'secret' },
      'studio',
      'up'
    );

    expect(result.summary).toBe('applied:002_add_column.sql');
    expect(scripts[0]).toContain('goose_linux_x86_64');
    expect(scripts[1]).toContain('001_create.sql');
    expect(scripts[2]).toContain('002_add_column.sql');
    expect(scripts[3]).toContain('SELECT version_id');
    expect(scripts[4]).toContain('002_add_column.sql');
    expect(scripts[5]).toContain('INSERT INTO goose_db_version');
    expect(scripts.join('\n')).not.toContain(
      'INSERT INTO goose_db_version (version_id, is_applied, tstamp)\nSELECT 1,'
    );
  });
});

describe('migration version identity', () => {
  it('keeps one file per numeric version in the real migration directory', () => {
    const files = listGooseMigrationFiles(
      fileURLToPath(new URL('../../../packages/data/migrations', import.meta.url))
    );
    const versions = files.map((file) => Number(file.split('/').at(-1)!.split('_')[0]));
    expect(new Set(versions).size).toBe(files.length);
  });
});

const repairUrl = process.env.APP_TRANSLATION_MIGRATION_TEST_URL;
describe.skipIf(!repairUrl)(
  'local migration history reconciliation on a disposable legacy copy',
  () => {
    const connect = async () => {
      if (!repairUrl || !new URL(repairUrl).pathname.endsWith('_test'))
        throw new Error('disposable_database_required');
      const client = new Client({ connectionString: repairUrl });
      await client.connect();
      return client;
    };
    const data = async (client: MigrationClient) =>
      (
        await client.query(`
    SELECT 'manifests' AS kind, to_jsonb(t) AS value FROM iam.app_translation_manifests t
    UNION ALL SELECT 'drafts', to_jsonb(t) FROM iam.app_translation_catalog_drafts t
    UNION ALL SELECT 'releases', to_jsonb(t) FROM iam.app_translation_catalog_releases t
    UNION ALL SELECT 'interfaces', to_jsonb(t) FROM iam.instance_external_interfaces t
    UNION ALL SELECT 'media', to_jsonb(t) - ARRAY['editing_source_asset_id','editing_source_key','editing_document','deletion_pending'] FROM iam.media_assets t
    ORDER BY 1,2`)
      ).rows;
    const history = async (client: MigrationClient) =>
      (await client.query('SELECT * FROM public.goose_db_version ORDER BY id')).rows;

    it('rolls back history and DDL together when the missing media migration fails', async () => {
      const client = await connect();
      try {
        const before = await data(client),
          beforeHistory = await history(client);
        await client.query('CREATE INDEX idx_media_assets_editing_source ON iam.media_assets(id)');
        try {
          await expect(reconcileAppTranslationMigrations(client)).rejects.toThrow();
          expect(await history(client)).toEqual(beforeHistory);
          expect(await data(client)).toEqual(before);
          expect(
            (
              await client.query(
                "SELECT column_name FROM information_schema.columns WHERE table_schema='iam' AND table_name='media_assets' AND column_name='editing_document'"
              )
            ).rows
          ).toEqual([]);
        } finally {
          await client.query('DROP INDEX iam.idx_media_assets_editing_source');
        }
      } finally {
        await client.end();
      }
    });

    it('preserves all existing catalog, provider and media values while remapping only the legacy identities', async () => {
      const client = await connect();
      try {
        const before = await data(client),
          beforeHistory = await history(client);
        expect(before.some((row) => row.kind === 'releases')).toBe(true);
        expect(await reconcileAppTranslationMigrations(client)).toBe('reconciled');
        expect(await data(client)).toEqual(before);
        const after = await history(client);
        for (const row of beforeHistory) {
          expect(after.find((item) => item.id === row.id)).toEqual({
            ...row,
            version_id:
              Number(row.version_id) >= 106 ? String(Number(row.version_id) + 1) : row.version_id,
          });
        }
        expect(after.filter((row) => row.version_id === '106' && row.is_applied)).toHaveLength(1);
        expect(after.at(-1)?.version_id).toBe('110');
        expect(
          (
            await client.query(
              "SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='iam' AND table_name='media_assets' AND column_name IN ('editing_source_asset_id','editing_source_key','editing_document','deletion_pending')"
            )
          ).rows[0].count
        ).toBe(4);
        expect(await reconcileAppTranslationMigrations(client)).toBe('already_reconciled');
        expect(await history(client)).toEqual(after);
        expect(await data(client)).toEqual(before);
      } finally {
        await client.end();
      }
    });

    it('keeps the Goose history head at the complete version 110', async () => {
      const client = await connect();
      try {
        expect((await history(client)).at(-1)?.version_id).toBe('110');
      } finally {
        await client.end();
      }
    });

    it('rejects an unknown or rolled-back history without changing data', async () => {
      const client = await connect();
      try {
        await client.query(
          'UPDATE public.goose_db_version SET is_applied=false WHERE version_id=110'
        );
        const before = await data(client),
          beforeHistory = await history(client);
        try {
          await expect(reconcileAppTranslationMigrations(client)).rejects.toThrow(
            'app_translation_migration_history_ambiguous'
          );
          expect(await history(client)).toEqual(beforeHistory);
          expect(await data(client)).toEqual(before);
        } finally {
          await client.query(
            'UPDATE public.goose_db_version SET is_applied=true WHERE version_id=110'
          );
        }
      } finally {
        await client.end();
      }
    });
  }
);
