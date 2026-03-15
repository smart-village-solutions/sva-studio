#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const requiredVars = [
  'SVA_MS_BENCH_GRAPHQL_URL',
  'SVA_MS_BENCH_OAUTH_TOKEN_URL',
  'SVA_MS_BENCH_CLIENT_ID',
  'SVA_MS_BENCH_CLIENT_SECRET',
];

const missingVars = requiredVars.filter((name) => !process.env[name]);
if (missingVars.length > 0) {
  console.error(`[benchmark] Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(2);
}

const coldRuns = Number.parseInt(process.env.SVA_MS_BENCH_COLD_RUNS ?? '3', 10);
const warmRuns = Number.parseInt(process.env.SVA_MS_BENCH_WARM_RUNS ?? '20', 10);
const outputPath = resolve(
  process.cwd(),
  process.env.SVA_MS_BENCH_OUTPUT ?? 'artifacts/benchmark/sva-mainserver-benchmark.json',
);

const oauthUrl = process.env.SVA_MS_BENCH_OAUTH_TOKEN_URL;
const graphqlUrl = process.env.SVA_MS_BENCH_GRAPHQL_URL;
const clientId = process.env.SVA_MS_BENCH_CLIENT_ID;
const clientSecret = process.env.SVA_MS_BENCH_CLIENT_SECRET;

const query = process.env.SVA_MS_BENCH_QUERY ?? '{ __typename }';

const median = (values) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

const summarize = (values) => {
  if (values.length === 0) {
    return { count: 0, minMs: 0, maxMs: 0, avgMs: 0, p50Ms: 0, p95Ms: 0 };
  }

  const total = values.reduce((sum, current) => sum + current, 0);
  return {
    count: values.length,
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
    avgMs: total / values.length,
    p50Ms: median(values),
    p95Ms: percentile(values, 95),
  };
};

const fetchAccessToken = async () => {
  const start = performance.now();
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(oauthUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const elapsedMs = performance.now() - start;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth token request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const payload = await response.json();
  if (!payload?.access_token || typeof payload.access_token !== 'string') {
    throw new Error('OAuth token response missing access_token');
  }

  return { accessToken: payload.access_token, elapsedMs };
};

const executeGraphql = async (accessToken) => {
  const start = performance.now();
  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
  });

  const elapsedMs = performance.now() - start;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GraphQL request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const payload = await response.json();
  if (payload?.errors?.length) {
    throw new Error(`GraphQL returned errors: ${JSON.stringify(payload.errors).slice(0, 300)}`);
  }

  return elapsedMs;
};

const runCold = async () => {
  const oauthDurations = [];
  const graphqlDurations = [];

  for (let i = 0; i < coldRuns; i += 1) {
    const tokenResult = await fetchAccessToken();
    oauthDurations.push(tokenResult.elapsedMs);
    graphqlDurations.push(await executeGraphql(tokenResult.accessToken));
  }

  return {
    oauth: summarize(oauthDurations),
    graphql: summarize(graphqlDurations),
  };
};

const runWarm = async () => {
  const oauthDurations = [];
  const graphqlDurations = [];

  const tokenResult = await fetchAccessToken();
  oauthDurations.push(tokenResult.elapsedMs);

  for (let i = 0; i < warmRuns; i += 1) {
    graphqlDurations.push(await executeGraphql(tokenResult.accessToken));
  }

  return {
    oauth: summarize(oauthDurations),
    graphql: summarize(graphqlDurations),
  };
};

const run = async () => {
  console.log(`[benchmark] Running cold path (${coldRuns} runs) and warm path (${warmRuns} runs)`);

  const coldPath = await runCold();
  const warmPath = await runWarm();

  const result = {
    generatedAt: new Date().toISOString(),
    target: {
      graphqlUrl,
      oauthUrl,
    },
    configuration: {
      coldRuns,
      warmRuns,
      query,
    },
    coldPath,
    warmPath,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(`[benchmark] Report written to ${outputPath}`);
  console.log(`[benchmark] Cold GraphQL p95: ${coldPath.graphql.p95Ms.toFixed(2)} ms`);
  console.log(`[benchmark] Warm GraphQL p95: ${warmPath.graphql.p95Ms.toFixed(2)} ms`);
};

try {
  await run();
} catch (error) {
  console.error('[benchmark] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
