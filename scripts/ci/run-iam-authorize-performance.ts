import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AcceptanceConfig } from './iam-acceptance.ts';
import { parseAcceptanceConfig } from './iam-acceptance.ts';
import {
  renderAuthorizePerformanceMarkdownReport,
  type AuthorizeBenchmarkPayload,
  type AuthorizePerformanceReport,
  type ScenarioMeasurement,
} from './iam-authorize-performance.ts';
import type { Pool } from './iam-authorize-performance-request.js';
import { runScenario } from './iam-authorize-performance-scenario.js';
import { loginAndReadSession } from './iam-authorize-performance-session.js';
import type { Browser } from './iam-authorize-performance-session.js';

type BrowserModule = {
  chromium: {
    launch: (options?: { headless?: boolean }) => Promise<Browser>;
  };
};
type PgModule = {
  Pool: new (options: { connectionString: string }) => Pool;
};

type BenchmarkConfig = {
  readonly acceptance: AcceptanceConfig;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly organizationId?: string;
  readonly measuredRequests: number;
  readonly warmupRequests: number;
  readonly concurrency: number;
  readonly recomputeConcurrency: number;
  readonly invalidationDelayMs: number;
  readonly outputDirectory: string;
  readonly outputBasename: string;
};

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const appRequire = createRequire(resolve(rootDir, 'apps/sva-studio-react/package.json'));
const authRuntimeRequire = createRequire(resolve(rootDir, 'packages/auth-runtime/package.json'));

const { chromium } = appRequire('@playwright/test') as BrowserModule;
const { Pool } = authRuntimeRequire('pg') as PgModule;

const parsePositiveInteger = (raw: string | undefined, fallback: number): number => {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return fallback;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, received "${raw}".`);
  }
  return parsed;
};

const parseBenchmarkConfig = (env: NodeJS.ProcessEnv): BenchmarkConfig => {
  const acceptance = parseAcceptanceConfig(env, rootDir);

  return {
    acceptance,
    action: env.IAM_AUTHORIZE_BENCH_ACTION?.trim() || 'content.read',
    resourceType: env.IAM_AUTHORIZE_BENCH_RESOURCE_TYPE?.trim() || 'content',
    resourceId: env.IAM_AUTHORIZE_BENCH_RESOURCE_ID?.trim() || undefined,
    organizationId: env.IAM_AUTHORIZE_BENCH_ORGANIZATION_ID?.trim() || undefined,
    measuredRequests: parsePositiveInteger(env.IAM_AUTHORIZE_BENCH_MEASURED_REQUESTS, 100),
    warmupRequests: parsePositiveInteger(env.IAM_AUTHORIZE_BENCH_WARMUP_REQUESTS, 10),
    concurrency: parsePositiveInteger(env.IAM_AUTHORIZE_BENCH_CONCURRENCY, 100),
    recomputeConcurrency: parsePositiveInteger(env.IAM_AUTHORIZE_BENCH_RECOMPUTE_CONCURRENCY, 1),
    invalidationDelayMs: parsePositiveInteger(env.IAM_AUTHORIZE_BENCH_INVALIDATION_DELAY_MS, 100),
    outputDirectory: acceptance.reportDirectory,
    outputBasename: env.IAM_AUTHORIZE_BENCH_REPORT_SLUG?.trim() || 'iam-authorize-performance',
  };
};

const createReportFileBase = (basename: string, generatedAt: Date): string => {
  const isoDate = generatedAt
    .toISOString()
    .replace(/[:]/g, '-')
    .replace(/\.\d{3}Z$/, 'Z');
  return `${basename}-${isoDate}`;
};

const writeBenchmarkReports = async (input: {
  readonly generatedAt: Date;
  readonly outputDirectory: string;
  readonly outputFileBase: string;
  readonly report: AuthorizePerformanceReport;
}): Promise<{ readonly jsonPath: string; readonly markdownPath: string }> => {
  const markdownPath = resolve(input.outputDirectory, `${input.outputFileBase}.md`);
  const jsonPath = resolve(input.outputDirectory, `${input.outputFileBase}.json`);

  await mkdir(input.outputDirectory, { recursive: true });
  await writeFile(markdownPath, renderAuthorizePerformanceMarkdownReport(input.report), 'utf8');
  await writeFile(jsonPath, `${JSON.stringify(input.report, null, 2)}\n`, 'utf8');

  return { jsonPath, markdownPath };
};

const main = async (): Promise<void> => {
  const generatedAt = new Date();
  const config = parseBenchmarkConfig(process.env);
  const reportFileBase = createReportFileBase(config.outputBasename, generatedAt);

  const browser = await chromium.launch({ headless: true });
  const pool = new Pool({ connectionString: config.acceptance.databaseUrl });

  try {
    const { context, user } = await loginAndReadSession({
      baseUrl: config.acceptance.baseUrl,
      browser,
      password: config.acceptance.admin.password,
      username: config.acceptance.admin.username,
    });
    const keycloakSubject = user.id;
    if (!keycloakSubject) {
      throw new Error('Der angemeldete Benutzer liefert kein Keycloak-Subject.');
    }

    const basePayload: AuthorizeBenchmarkPayload = {
      instanceId: config.acceptance.instanceId,
      action: config.action,
      resource: {
        type: config.resourceType,
        ...(config.resourceId ? { id: config.resourceId } : {}),
        ...(config.organizationId ? { organizationId: config.organizationId } : {}),
      },
      context: {
        ...(config.organizationId ? { organizationId: config.organizationId } : {}),
      },
    };

    const scenarios: ScenarioMeasurement[] = [];
    for (const scenario of ['cache-hit', 'cache-miss', 'recompute'] as const) {
      const measurement = await runScenario({
        basePayload,
        baseUrl: config.acceptance.baseUrl,
        context,
        invalidationDelayMs: config.invalidationDelayMs,
        keycloakSubject,
        measuredRequests: config.measuredRequests,
        pool,
        runId: `${generatedAt.getTime()}-${scenario}`,
        scenario,
        scenarioConcurrency:
          scenario === 'recompute' ? config.recomputeConcurrency : config.concurrency,
        warmupRequests: config.warmupRequests,
      });
      scenarios.push(measurement);
    }

    const report: AuthorizePerformanceReport = {
      generatedAt: generatedAt.toISOString(),
      target: {
        baseUrl: config.acceptance.baseUrl,
        instanceId: config.acceptance.instanceId,
        keycloakSubject,
      },
      configuration: {
        concurrency: config.concurrency,
        measuredRequests: config.measuredRequests,
        warmupRequests: config.warmupRequests,
      },
      scenarios,
    };

    const output = await writeBenchmarkReports({
      generatedAt,
      outputDirectory: config.outputDirectory,
      outputFileBase: reportFileBase,
      report,
    });

    console.log(`[iam-authorize-benchmark] Report written to ${output.markdownPath}`);
    console.log(`[iam-authorize-benchmark] JSON written to ${output.jsonPath}`);
    for (const scenario of report.scenarios) {
      console.log(
        `[iam-authorize-benchmark] ${scenario.scenario} p95=${scenario.summary.p95Ms.toFixed(2)}ms p99=${scenario.summary.p99Ms.toFixed(2)}ms accepted=${scenario.accepted}`
      );
    }

    await context.close().catch(() => undefined);
  } finally {
    await pool.end().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
};

main().catch((error) => {
  console.error(
    '[iam-authorize-benchmark] Failed:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
