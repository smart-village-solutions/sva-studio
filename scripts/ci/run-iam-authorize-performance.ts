import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import type { AcceptanceConfig } from './iam-acceptance.ts';
import { parseAcceptanceConfig } from './iam-acceptance.ts';
import {
  buildAuthorizeBenchmarkPayload,
  renderAuthorizePerformanceMarkdownReport,
  summarizeDurations,
  type AuthorizeBenchmarkPayload,
  type AuthorizeBenchmarkScenario,
  type AuthorizePerformanceReport,
  type ScenarioMeasurement,
} from './iam-authorize-performance.ts';

type BrowserModule = {
  chromium: {
    launch: (options?: { headless?: boolean }) => Promise<Browser>;
  };
};

type Browser = {
  close: () => Promise<void>;
  newContext: () => Promise<BrowserContext>;
};

type BrowserContext = {
  close: () => Promise<void>;
  newPage: () => Promise<Page>;
  request: {
    get: (url: string, options?: { failOnStatusCode?: boolean }) => Promise<ApiResponse>;
    post: (
      url: string,
      options: {
        data: unknown;
        failOnStatusCode?: boolean;
        headers?: Record<string, string>;
      }
    ) => Promise<ApiResponse>;
  };
};

type ApiResponse = {
  json: () => Promise<unknown>;
  status: () => number;
};

type Locator = {
  click: () => Promise<void>;
  count: () => Promise<number>;
  fill: (value: string) => Promise<void>;
  first: () => Locator;
  isVisible: () => Promise<boolean>;
};

type Page = {
  close: () => Promise<void>;
  getByRole: (role: string, options?: { exact?: boolean; name?: string | RegExp }) => Locator;
  goto: (url: string, options?: { waitUntil?: 'domcontentloaded' | 'load'; timeout?: number }) => Promise<unknown>;
  locator: (selector: string) => Locator;
  waitForLoadState: (state?: 'domcontentloaded' | 'load' | 'networkidle') => Promise<void>;
  waitForURL: (url: string | RegExp, options?: { timeout?: number }) => Promise<void>;
};

type PgModule = {
  Pool: new (options: { connectionString: string }) => Pool;
};

type Pool = {
  end: () => Promise<void>;
  query: <T>(text: string, values?: readonly unknown[]) => Promise<{ rowCount: number | null; rows: T[] }>;
};

type AuthMePayload = {
  user?: {
    email?: string;
    id?: string;
    instanceId?: string;
    name?: string;
    roles?: string[];
  };
};

type AuthorizeApiPayload = AuthorizeBenchmarkPayload;

type AuthorizeApiResponse = {
  allowed?: boolean;
  cacheStatus?: string;
  error?: string;
  reason?: string;
  requestId?: string;
  snapshotVersion?: string | null;
  traceId?: string;
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

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
} as const;

const AUTHORIZE_INVALIDATION_CHANNEL = 'iam_permission_snapshot_invalidation';
const LOGIN_TIMEOUT_MS = 45_000;

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

const fillIfVisible = async (locator: Locator, value: string): Promise<boolean> => {
  const count = await locator.count().catch(() => 0);
  if (count === 0) {
    return false;
  }
  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) {
    return false;
  }
  await first.fill(value);
  return true;
};

const clickIfVisible = async (locator: Locator): Promise<boolean> => {
  const count = await locator.count().catch(() => 0);
  if (count === 0) {
    return false;
  }
  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) {
    return false;
  }
  await first.click();
  return true;
};

const performKeycloakLogin = async (page: Page, input: { password: string; username: string }): Promise<void> => {
  const usernameFilled =
    (await fillIfVisible(page.locator('input[name="username"]'), input.username)) ||
    (await fillIfVisible(page.locator('#username'), input.username));
  const passwordFilled =
    (await fillIfVisible(page.locator('input[name="password"]'), input.password)) ||
    (await fillIfVisible(page.locator('#password'), input.password));

  if (!usernameFilled || !passwordFilled) {
    throw new Error('Die Keycloak-Loginmaske konnte nicht automatisiert bedient werden.');
  }

  const clicked =
    (await clickIfVisible(page.locator('#kc-login'))) ||
    (await clickIfVisible(page.getByRole('button', { name: /anmelden|sign in|login/i })));

  if (!clicked) {
    throw new Error('Der Keycloak-Login-Button wurde nicht gefunden.');
  }
};

const loginAndReadSession = async (input: {
  readonly baseUrl: string;
  readonly browser: Browser;
  readonly password: string;
  readonly username: string;
}): Promise<{
  readonly context: BrowserContext;
  readonly user: NonNullable<AuthMePayload['user']>;
}> => {
  const context = await input.browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(new URL('/auth/login', input.baseUrl).toString(), {
      timeout: LOGIN_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });
    await performKeycloakLogin(page, { username: input.username, password: input.password });
    await page.waitForURL(new RegExp(`${input.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/.*`), {
      timeout: LOGIN_TIMEOUT_MS,
    });
    await page.waitForLoadState('networkidle');

    const meResponse = await context.request.get(new URL('/auth/me', input.baseUrl).toString(), {
      failOnStatusCode: false,
    });
    if (meResponse.status() !== 200) {
      throw new Error(`/auth/me antwortete mit HTTP ${meResponse.status()}.`);
    }

    const mePayload = (await meResponse.json()) as AuthMePayload;
    const user = mePayload.user;
    if (!user?.id || !user.instanceId || !Array.isArray(user.roles)) {
      throw new Error('Der User-Kontext aus /auth/me ist unvollständig.');
    }

    await page.close().catch(() => undefined);
    return {
      context,
      user: user as NonNullable<AuthMePayload['user']>,
    };
  } catch (error) {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    throw error;
  }
};

const createReportFileBase = (basename: string, generatedAt: Date): string => {
  const isoDate = generatedAt.toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z');
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

const sleep = async (durationMs: number): Promise<void> =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs));

const invokeAuthorize = async (input: {
  readonly baseUrl: string;
  readonly context: BrowserContext;
  readonly payload: AuthorizeApiPayload;
}): Promise<{ readonly cacheStatus?: string; readonly durationMs: number; readonly response: AuthorizeApiResponse }> => {
  const startedAt = performance.now();
  const apiResponse = await input.context.request.post(new URL('/iam/authorize', input.baseUrl).toString(), {
    data: input.payload,
    failOnStatusCode: false,
    headers: JSON_HEADERS,
  });
  const durationMs = performance.now() - startedAt;

  const response = (await apiResponse.json()) as AuthorizeApiResponse;
  if (apiResponse.status() !== 200) {
    throw new Error(`/iam/authorize antwortete mit HTTP ${apiResponse.status()} (${response.error ?? 'unknown_error'}).`);
  }
  if (typeof response.allowed !== 'boolean') {
    throw new Error('/iam/authorize lieferte keine fachliche Allow-/Deny-Entscheidung.');
  }

  return { cacheStatus: response.cacheStatus, durationMs, response };
};

const emitUserScopeInvalidation = async (input: {
  readonly keycloakSubject: string;
  readonly instanceId: string;
  readonly pool: Pool;
  readonly scenarioRunId: string;
  readonly sampleIndex: number;
}): Promise<void> => {
  const payload = JSON.stringify({
    eventId: `bench-${input.scenarioRunId}-invalidate-${input.sampleIndex}`,
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    reason: 'benchmark_recompute',
    trigger: 'pg_notify',
  });

  await input.pool.query('SELECT pg_notify($1, $2);', [AUTHORIZE_INVALIDATION_CHANNEL, payload]);
};

const scenarioThresholdMs = (scenario: AuthorizeBenchmarkScenario): number => {
  switch (scenario) {
    case 'cache-hit':
      return 100;
    case 'cache-miss':
      return 300;
    case 'recompute':
      return 300;
  }
};

const assertScenarioStatuses = (input: {
  readonly observedStatuses: readonly string[];
  readonly scenario: AuthorizeBenchmarkScenario;
}): void => {
  if (input.observedStatuses.length === 0) {
    throw new Error(`Szenario ${input.scenario} lieferte keine cacheStatus-Werte.`);
  }

  if (input.scenario === 'cache-hit' && input.observedStatuses.some((status) => status !== 'hit')) {
    throw new Error(`Szenario cache-hit lieferte unerwartete cacheStatus-Werte: ${input.observedStatuses.join(', ')}.`);
  }

  if (input.scenario === 'cache-miss' && input.observedStatuses.some((status) => status !== 'miss')) {
    throw new Error(`Szenario cache-miss lieferte unerwartete cacheStatus-Werte: ${input.observedStatuses.join(', ')}.`);
  }

  if (input.scenario === 'recompute' && input.observedStatuses.some((status) => status === 'hit')) {
    throw new Error(`Szenario recompute blieb im Cache-Hit hängen: ${input.observedStatuses.join(', ')}.`);
  }
};

const runScenario = async (input: {
  readonly basePayload: AuthorizeBenchmarkPayload;
  readonly baseUrl: string;
  readonly context: BrowserContext;
  readonly invalidationDelayMs: number;
  readonly keycloakSubject: string;
  readonly measuredRequests: number;
  readonly pool: Pool;
  readonly runId: string;
  readonly scenario: AuthorizeBenchmarkScenario;
  readonly scenarioConcurrency: number;
  readonly warmupRequests: number;
}): Promise<ScenarioMeasurement> => {
  const stableWarmupPayload = buildAuthorizeBenchmarkPayload({
    basePayload: input.basePayload,
    runId: input.runId,
    sampleIndex: 0,
    scenario: input.scenario === 'cache-miss' ? 'cache-hit' : input.scenario,
  });

  for (let index = 0; index < input.warmupRequests; index += 1) {
    if (input.scenario === 'recompute') {
      await emitUserScopeInvalidation({
        pool: input.pool,
        instanceId: input.basePayload.instanceId,
        keycloakSubject: input.keycloakSubject,
        scenarioRunId: input.runId,
        sampleIndex: index,
      });
      await sleep(input.invalidationDelayMs);
    }

    const warmupPayload =
      input.scenario === 'cache-miss'
        ? buildAuthorizeBenchmarkPayload({
            basePayload: input.basePayload,
            runId: `${input.runId}-warmup`,
            sampleIndex: index,
            scenario: 'cache-miss',
          })
        : stableWarmupPayload;
    await invokeAuthorize({
      baseUrl: input.baseUrl,
      context: input.context,
      payload: warmupPayload,
    });
  }

  const samplesMs = new Array<number>(input.measuredRequests);
  const observedStatuses = new Array<string>(input.measuredRequests);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const sampleIndex = cursor;
      cursor += 1;

      if (sampleIndex >= input.measuredRequests) {
        return;
      }

      if (input.scenario === 'recompute') {
        await emitUserScopeInvalidation({
          pool: input.pool,
          instanceId: input.basePayload.instanceId,
          keycloakSubject: input.keycloakSubject,
          scenarioRunId: input.runId,
          sampleIndex,
        });
        await sleep(input.invalidationDelayMs);
      }

      const payload = buildAuthorizeBenchmarkPayload({
        basePayload: input.basePayload,
        runId: input.runId,
        sampleIndex,
        scenario: input.scenario,
      });

      const result = await invokeAuthorize({
        baseUrl: input.baseUrl,
        context: input.context,
        payload,
      });

      samplesMs[sampleIndex] = result.durationMs;
      observedStatuses[sampleIndex] = result.cacheStatus ?? 'unknown';
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, input.scenarioConcurrency) }, async () => worker())
  );

  assertScenarioStatuses({
    observedStatuses,
    scenario: input.scenario,
  });

  const summary = summarizeDurations(samplesMs);
  return {
    scenario: input.scenario,
    samplesMs,
    summary,
    accepted: summary.p95Ms < scenarioThresholdMs(input.scenario),
  };
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

    const basePayload: AuthorizeApiPayload = {
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
        scenarioConcurrency: scenario === 'recompute' ? config.recomputeConcurrency : config.concurrency,
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
  console.error('[iam-authorize-benchmark] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
