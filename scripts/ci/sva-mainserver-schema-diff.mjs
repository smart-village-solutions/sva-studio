#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const requiredVars = [
  'SVA_MAINSERVER_SCHEMA_GRAPHQL_URL',
  'SVA_MAINSERVER_SCHEMA_OAUTH_TOKEN_URL',
  'SVA_MAINSERVER_SCHEMA_CLIENT_ID',
  'SVA_MAINSERVER_SCHEMA_CLIENT_SECRET',
];

const missingVars = requiredVars.filter((name) => !process.env[name]);
if (missingVars.length > 0) {
  console.error(
    `[schema-diff] Missing required environment variables: ${missingVars.join(', ')}`,
  );
  process.exit(2);
}

const snapshotPath = resolve(
  process.cwd(),
  'packages/sva-mainserver/src/generated/schema.snapshot.json',
);
const outputPath = resolve(
  process.cwd(),
  process.env.SVA_MAINSERVER_SCHEMA_DIFF_OUTPUT ?? 'artifacts/schema-diff/sva-mainserver-schema-diff.md',
);
const requestTimeoutMs = Number.parseInt(process.env.SVA_MAINSERVER_SCHEMA_REQUEST_TIMEOUT_MS ?? '10000', 10);

const isTimeoutError = (error) =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

const fetchAccessToken = async () => {
  const tokenUrl = process.env.SVA_MAINSERVER_SCHEMA_OAUTH_TOKEN_URL;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SVA_MAINSERVER_SCHEMA_CLIENT_ID,
    client_secret: process.env.SVA_MAINSERVER_SCHEMA_CLIENT_SECRET,
  });

  let response;
  try {
    response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error(`Token request timed out after ${requestTimeoutMs}ms`);
    }
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token request failed with ${response.status}: ${text.slice(0, 300)}`);
  }

  const payload = await response.json();
  if (!payload?.access_token || typeof payload.access_token !== 'string') {
    throw new Error('Token response does not contain access_token');
  }

  return payload.access_token;
};

const run = async () => {
  const token = await fetchAccessToken();
  const graphqlUrl = process.env.SVA_MAINSERVER_SCHEMA_GRAPHQL_URL;

  const diff = spawnSync(
    'pnpm',
    [
      'dlx',
      '@graphql-inspector/cli',
      'diff',
      snapshotPath,
      graphqlUrl,
      '--header',
      `Authorization: Bearer ${token}`,
      '--format',
      'markdown',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const outputDir = dirname(outputPath);
  mkdirSync(outputDir, { recursive: true });

  const output = [
    '# SVA Mainserver Schema Diff',
    '',
    `- Snapshot: ${snapshotPath}`,
    `- Target: ${graphqlUrl}`,
    `- Exit code: ${diff.status ?? 1}`,
    '',
    '## Diff Output',
    '',
    diff.stdout?.trim() ? diff.stdout : '_No output returned by graphql-inspector._',
    '',
    diff.stderr?.trim() ? '## STDERR\n\n' + diff.stderr : '',
  ]
    .filter(Boolean)
    .join('\n');

  writeFileSync(outputPath, `${output}\n`, 'utf8');
  console.log(`[schema-diff] Wrote diff report to ${outputPath}`);

  if (diff.error) {
    throw diff.error;
  }

  process.exit(diff.status ?? 1);
};

try {
  await run();
} catch (error) {
  console.error('[schema-diff] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
