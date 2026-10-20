import { runCapture, runCommand, uploadJson, sha256 } from './runtime-io.mjs';
import { createReadStream, createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { finished } from 'node:stream/promises';
import { join } from 'node:path';

export const archiveSchemaCompatible = (listing) =>
  listing.includes('TABLE public goose_db_version') && listing.includes('TABLE iam instances');

export const wasteArchiveSchemaCompatible = (listing) =>
  listing.includes('TABLE public waste_regions') &&
  listing.includes('TABLE public waste_collection_locations') &&
  listing.includes('TABLE public waste_tours');

export const isRestoreSqlLineSupported = (line) => line !== 'SET transaction_timeout = 0;';

export const writeCompatibleRestoreSql = async (source, target) => {
  const input = createReadStream(source);
  const output = createWriteStream(target, { mode: 0o600 });
  try {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      if (isRestoreSqlLineSupported(line) && !output.write(`${line}\n`)) {
        await once(output, 'drain');
      }
    }
    output.end();
    await finished(output);
  } catch (error) {
    output.destroy();
    throw error;
  }
};

export const extractAppliedGooseVersion = (sql) => {
  const lines = sql.split('\n');
  const copyIndex = lines.findIndex((line) => line.startsWith('COPY public.goose_db_version ('));
  if (copyIndex < 0) return null;
  const columns = /^COPY public\.goose_db_version \(([^)]+)\) FROM stdin;$/u
    .exec(lines[copyIndex])?.[1]
    .split(', ')
    .map((column) => column.replaceAll('"', ''));
  if (!columns) return null;
  const versionIndex = columns.indexOf('version_id');
  const appliedIndex = columns.indexOf('is_applied');
  if (versionIndex < 0 || appliedIndex < 0) return null;
  const appliedVersions = lines
    .slice(copyIndex + 1, lines.indexOf('\\.', copyIndex + 1))
    .map((line) => line.split('\t'))
    .filter((values) => values[appliedIndex] === 't' || values[appliedIndex] === 'true')
    .map((values) => values[versionIndex])
    .filter((value) => /^\d+$/u.test(value))
    .map(Number);
  return appliedVersions.length > 0 ? Math.max(...appliedVersions) : null;
};

export const isHistoricalSchemaRestoreCompatible = (sourceGooseVersion, targetGooseVersion) =>
  Number.isSafeInteger(sourceGooseVersion) &&
  Number.isSafeInteger(targetGooseVersion) &&
  sourceGooseVersion <= targetGooseVersion;

export const ssfArchiveSchemaCompatible = (listing) =>
  listing.includes('TABLE ssf server_settings') &&
  listing.includes('TABLE ssf server_locales') &&
  listing.includes('TABLE ssf tenant_settings') &&
  listing.includes('TABLE ssf tenant_locales') &&
  listing.includes('TABLE ssf authorization_projections');

export const verifyArchiveSchema = async (archive, database = 'studio') => {
  const listing = await runCapture('pg_restore', ['--list', archive], {
    maxOutputBytes: 10 * 1024 * 1024,
  });
  if (
    database === 'waste'
      ? !wasteArchiveSchemaCompatible(listing)
      : database === 'ssf'
        ? !ssfArchiveSchemaCompatible(listing)
        : !archiveSchemaCompatible(listing)
  )
    throw new Error('archive_schema_incompatible');
};

export const readArchiveGooseVersion = async (archive) => {
  const sql = await runCapture(
    'pg_restore',
    ['--data-only', '--table', 'goose_db_version', '--file', '-', archive],
    { maxOutputBytes: 2 * 1024 * 1024 }
  );
  return extractAppliedGooseVersion(sql);
};

export const downloadSourceObject = async (target, request, endpoint, storageEnv, sourcePath) => {
  await runCommand(
    'aws',
    [
      '--endpoint-url',
      endpoint,
      's3',
      'cp',
      `s3://${target.bucket}/${request.sourceObjectKey}`,
      sourcePath,
      '--only-show-errors',
    ],
    { env: storageEnv, timeoutMs: 5 * 60_000 }
  );
};

export const createVerifiedSafetyBackup = async ({
  target,
  pgEnv,
  safetyDump,
  endpoint,
  storageEnv,
  workdir,
  safetyObjectKey,
  keys,
  evidence,
  complete,
}) => {
  await runCommand(
    'pg_dump',
    [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--role',
      target.schemaOwner,
      '--host',
      target.postgresHost,
      '--port',
      '5432',
      '--username',
      target.restoreUser,
      '--file',
      safetyDump,
      target.postgresDatabase,
    ],
    { env: pgEnv, timeoutMs: 10 * 60_000 }
  );
  await runCommand('pg_restore', ['--list', safetyDump], { timeoutMs: 60_000 });
  const safetySha256 = await sha256(safetyDump);
  await runCommand(
    'aws',
    [
      '--endpoint-url',
      endpoint,
      's3',
      'cp',
      safetyDump,
      `s3://${target.bucket}/${safetyObjectKey}`,
      '--only-show-errors',
    ],
    { env: storageEnv, timeoutMs: 5 * 60_000 }
  );
  const safetyDownloaded = join(workdir, 'safety.download');
  await runCommand(
    'aws',
    [
      '--endpoint-url',
      endpoint,
      's3',
      'cp',
      `s3://${target.bucket}/${safetyObjectKey}`,
      safetyDownloaded,
      '--only-show-errors',
    ],
    { env: storageEnv, timeoutMs: 5 * 60_000 }
  );
  if (safetySha256 !== (await sha256(safetyDownloaded))) throw new Error('checksum_mismatch');
  await uploadJson(target, keys.safetyBackup, {
    ...evidence,
    objectKey: safetyObjectKey,
    sha256: safetySha256,
    status: 'verified',
    completedAt: new Date().toISOString(),
  });
  complete('safety-backup', { objectKey: safetyObjectKey, sha256: safetySha256 });
};
