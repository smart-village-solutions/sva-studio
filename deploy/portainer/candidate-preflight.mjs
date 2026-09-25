import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`candidate_required_config_missing:${name}`);
  return value;
};

export const isCandidatePreflightEntrypoint = (moduleUrl, executablePath) =>
  Boolean(executablePath) && moduleUrl === pathToFileURL(resolve(executablePath)).href;

const candidateFailureRules = [
  {
    code: 'PROMOTE_PREFLIGHT_SECRET_REFERENCE_MISSING',
    exitCode: 23,
    matches: (message) => message.includes('ENOENT') || message.includes('EACCES'),
  },
  {
    code: 'PROMOTE_PREFLIGHT_CONFIG_INVALID',
    exitCode: 24,
    matches: (message) => message.includes('candidate_'),
  },
];

export const classifyCandidateFailure = (message) =>
  candidateFailureRules.find((rule) => rule.matches(message)) ?? {
    code: 'PROMOTE_INTERNAL_ERROR',
    exitCode: 25,
  };

export const runCandidatePreflight = async () => {
  const { default: pg } = await import('pg');
  const { Client } = pg;
  if (required('SVA_RUNTIME_PROFILE') !== 'studio')
    throw new Error('candidate_runtime_profile_mismatch');
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
    await client.query('SELECT 1');
    await client.query('ROLLBACK');
    process.stdout.write(
      `${JSON.stringify({ status: 'ok' })}\n`
    );
  } finally {
    await client.end();
  }
};

if (isCandidatePreflightEntrypoint(import.meta.url, process.argv[1])) {
  runCandidatePreflight().catch((error) => {
    const message = error instanceof Error ? error.message : 'candidate_internal_error';
    const failure = classifyCandidateFailure(message);
    process.stderr.write(
      `${JSON.stringify({ code: failure.code, phase: 'candidate-preflight', retryable: false })}\n`
    );
    process.exitCode = failure.exitCode;
  });
}
