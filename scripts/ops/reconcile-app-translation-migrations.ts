import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

export interface MigrationClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
}
const requireFromAuthRuntime = createRequire(
  createRequire(import.meta.url).resolve('@sva/auth-runtime')
);
const { Client } = requireFromAuthRuntime('pg') as {
  Client: new (options: { connectionString: string }) => MigrationClient;
};

const migrationUrl = new URL(
  '../../packages/data/migrations/0106_iam_media_editing_sources.sql',
  import.meta.url
);
const mediaColumns = [
  'editing_source_asset_id',
  'editing_source_key',
  'editing_document',
  'deletion_pending',
];

// Only the fully applied, unpublished 106–109 branch history can be identified unambiguously.
export const reconcileAppTranslationMigrations = async (client: Pick<MigrationClient, 'query'>) => {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '30s'");
    await client.query('LOCK TABLE public.goose_db_version IN EXCLUSIVE MODE');
    const history = await client.query<{ version_id: string; is_applied: boolean }>(
      'SELECT version_id::text, is_applied FROM public.goose_db_version WHERE version_id >= 106 ORDER BY id'
    );
    const state = await client.query<{
      catalogs: boolean;
      machine: boolean;
      languages: boolean;
      deepl: boolean;
      media: number;
    }>(
      `
      SELECT to_regclass('iam.app_translation_manifests') IS NOT NULL
        AND to_regclass('iam.app_translation_catalog_drafts') IS NOT NULL
        AND to_regclass('iam.app_translation_catalog_releases') IS NOT NULL AS catalogs,
        EXISTS (SELECT FROM information_schema.columns WHERE table_schema='iam'
          AND table_name='app_translation_catalog_drafts' AND column_name='machine_standard_values_by_locale') AS machine,
        to_regclass('iam.available_languages') IS NOT NULL OR to_regclass('iam.instance_languages') IS NOT NULL AS languages,
        EXISTS (SELECT FROM iam.external_interface_types WHERE type_key='deepl') AS deepl,
        (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='iam'
          AND table_name='media_assets' AND column_name = ANY($1::text[])) AS media`,
      [mediaColumns]
    );
    const schema = state.rows[0];
    const versions = history.rows.map((row) => Number(row.version_id)).sort((a, b) => a - b);
    const applied = history.rows.every((row) => row.is_applied);
    const validCatalogs = schema.catalogs && schema.machine && schema.deepl && !schema.languages;
    if (
      applied &&
      validCatalogs &&
      ['106,107,108,109,110', '106,107,108,109,110,110'].includes(versions.join(',')) &&
      schema.media === 4
    ) {
      // Goose reports the last applied history row, rather than the highest version.
      if (history.rows.at(-1)?.version_id !== '110') {
        await client.query(
          'INSERT INTO public.goose_db_version(version_id,is_applied) VALUES (110,true)'
        );
        await client.query('COMMIT');
        return 'reconciled' as const;
      }
      await client.query('COMMIT');
      return 'already_reconciled' as const;
    }
    if (
      !applied ||
      !validCatalogs ||
      versions.join(',') !== '106,107,108,109' ||
      schema.media !== 0
    ) {
      throw new Error('app_translation_migration_history_ambiguous');
    }
    await client.query(`LOCK TABLE iam.app_translation_manifests, iam.app_translation_catalog_drafts,
      iam.app_translation_catalog_releases, iam.instance_external_interfaces, iam.media_assets IN ACCESS EXCLUSIVE MODE`);
    const fingerprints = () =>
      client.query<{ fingerprints: unknown }>(
        `
      SELECT jsonb_build_object(
        'manifests', (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM iam.app_translation_manifests t),
        'drafts', (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM iam.app_translation_catalog_drafts t),
        'releases', (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM iam.app_translation_catalog_releases t),
        'interfaces', (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'[]')) FROM iam.instance_external_interfaces t),
        'media', (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) - $1::text[] ORDER BY id)::text,'[]')) FROM iam.media_assets t)
      ) AS fingerprints`,
        [mediaColumns]
      );
    const before = (await fingerprints()).rows[0].fingerprints;
    const sql = await readFile(migrationUrl, 'utf8');
    const up = sql.split('-- +goose Down')[0].replace('-- +goose Up', '');
    await client.query(
      'UPDATE public.goose_db_version SET version_id = version_id + 1 WHERE version_id BETWEEN 106 AND 109'
    );
    await client.query(up);
    await client.query(
      'INSERT INTO public.goose_db_version(version_id,is_applied) VALUES (106,true),(110,true)'
    );
    const after = (await fingerprints()).rows[0].fingerprints;
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error('app_translation_migration_data_changed');
    await client.query('COMMIT');
    return 'reconciled' as const;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

const main = async () => {
  const url = new URL(process.env.IAM_DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('local_database_required');
  }
  const client = new Client({ connectionString: url.toString() });
  try {
    await client.connect();
    process.stdout.write(`${await reconcileAppTranslationMigrations(client)}\n`);
  } finally {
    await client.end();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'migration_reconciliation_failed'}\n`
    );
    process.exitCode = 1;
  });
}
