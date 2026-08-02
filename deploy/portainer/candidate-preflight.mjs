import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { revealField } from '@sva/auth-runtime/server';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`candidate_required_config_missing:${name}`);
  return value;
};

export const parseAllowedInstanceIds = (value) =>
  [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))].sort();

export const verifyTenantRows = (rows, allowedInstanceIds) => {
  const allowed = new Set(allowedInstanceIds);
  for (const row of rows) {
    if (!allowed.has(row.id)) throw new Error('candidate_release_tenant_scope_mismatch');
    if (!revealField(row.auth_client_secret_ciphertext, `iam.instances.auth_client_secret:${row.id}`)) {
      throw new Error('candidate_tenant_auth_secret_unreadable');
    }
    if (row.tenant_admin_client_id && !revealField(row.tenant_admin_client_secret_ciphertext, `iam.instances.tenant_admin_client_secret:${row.id}`)) {
      throw new Error('candidate_tenant_admin_secret_unreadable');
    }
  }
};

export const isCandidatePreflightEntrypoint = (moduleUrl, executablePath) =>
  Boolean(executablePath) && moduleUrl === pathToFileURL(resolve(executablePath)).href;

export const runCandidatePreflight = async () => {
  const { default: pg } = await import('pg');
  const { Client } = pg;
  if (required('SVA_RUNTIME_PROFILE') !== 'studio') throw new Error('candidate_runtime_profile_mismatch');
  const allowedInstanceIds = parseAllowedInstanceIds(required('SVA_ALLOWED_INSTANCE_IDS'));
  if (allowedInstanceIds.length === 0) throw new Error('candidate_release_tenant_scope_missing');
  await access(required('WASTE_DATABASE_PROVISIONER_PASSWORD_FILE'), constants.R_OK);

  const client = new Client({
    database: required('POSTGRES_DB'),
    host: required('POSTGRES_HOST'),
    password: required('APP_DB_PASSWORD'),
    port: Number(required('POSTGRES_PORT')),
    user: required('APP_DB_USER'),
  });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const result = await client.query(`
      SELECT id, auth_client_secret_ciphertext, tenant_admin_client_id, tenant_admin_client_secret_ciphertext
      FROM iam.instances
      WHERE status = 'active'
      ORDER BY id
    `);
    verifyTenantRows(result.rows, allowedInstanceIds);
    await client.query('ROLLBACK');
    process.stdout.write(`${JSON.stringify({ checkedActiveTenantCount: result.rowCount ?? 0, status: 'ok' })}\n`);
  } finally {
    await client.end();
  }
};

if (isCandidatePreflightEntrypoint(import.meta.url, process.argv[1])) {
  runCandidatePreflight().catch((error) => {
    const message = error instanceof Error ? error.message : 'candidate_internal_error';
    const code = message.includes('secret_unreadable')
      ? 'PROMOTE_PREFLIGHT_TENANT_SECRET_UNREADABLE'
      : message.includes('tenant_scope')
        ? 'PROMOTE_PREFLIGHT_TENANT_SCOPE_MISMATCH'
        : message.includes('ENOENT') || message.includes('EACCES')
          ? 'PROMOTE_PREFLIGHT_SECRET_REFERENCE_MISSING'
          : message.includes('candidate_')
            ? 'PROMOTE_PREFLIGHT_CONFIG_INVALID'
            : 'PROMOTE_INTERNAL_ERROR';
    process.stderr.write(`${JSON.stringify({ code, phase: 'candidate-preflight', retryable: false })}\n`);
    process.exitCode = 1;
  });
}
