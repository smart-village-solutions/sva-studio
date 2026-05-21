#!/usr/bin/env node
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '../..');
const authRuntimeRequire = createRequire(resolve(rootDir, 'packages/auth-runtime/package.json'));
const { Pool } = authRuntimeRequire('pg');

const parseOptions = (rawArgs) => {
  const values = new Map();
  const flags = new Set();

  for (const rawArg of rawArgs) {
    const arg = rawArg.trim();
    if (!arg.startsWith('--')) {
      continue;
    }

    const [key, ...rest] = arg.slice(2).split('=');
    const value = rest.join('=').trim();
    if (value.length > 0) {
      values.set(key, value);
    } else {
      flags.add(key);
    }
  }

  return {
    dryRun: flags.has('dryRun') || flags.has('dry-run'),
    instanceId: values.get('instanceId') ?? values.get('instance-id'),
  };
};

const options = parseOptions(process.argv.slice(2));
const databaseUrl = process.env.IAM_DATABASE_URL;

if (!databaseUrl) {
  console.error('[run-iam-account-deletion-rules] IAM_DATABASE_URL fehlt.');
  process.exit(1);
}

if (!options.instanceId) {
  console.error('[run-iam-account-deletion-rules] --instanceId=<tenant-id> fehlt.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  idleTimeoutMillis: 10_000,
});

const run = async () => {
  let client;

  try {
    client = await pool.connect();

    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE iam_app;');
    await client.query('SELECT set_config($1, $2, true);', ['app.instance_id', options.instanceId]);

    const { runDeletionRulesMaintenance } = await import(
      new URL('../../packages/iam-governance/src/deletion-rules-maintenance.js', import.meta.url).href
    );

    const summary = await runDeletionRulesMaintenance(client, {
      instanceId: options.instanceId,
      dryRun: options.dryRun,
    });

    await client.query('COMMIT');
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => undefined);
    }
    console.error(
      '[run-iam-account-deletion-rules] failed',
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error(
    '[run-iam-account-deletion-rules] unexpected error',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
