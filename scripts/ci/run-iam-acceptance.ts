import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  KeycloakAdminClient,
  type KeycloakAdminClientConfig,
} from '../../packages/auth-runtime/src/keycloak-admin-client/core.ts';
import {
  buildAcceptanceReport,
  createAcceptanceReportFileBase,
  parseAcceptanceConfig,
  writeAcceptanceReports,
  type AcceptanceConfig,
} from './iam-acceptance.ts';
import { runLoginAndJitChecks } from './iam-acceptance-runner-login.ts';
import { verifyOrganizationsAndMembership } from './iam-acceptance-runner-organizations.ts';
import {
  resetAcceptanceTestData,
  runIdentityPreflight,
  verifyReadiness,
} from './iam-acceptance-runner-preflight.ts';
import {
  createAcceptanceRecorder,
  type AcceptanceRecorder,
  type Browser,
  type BrowserModule,
  type PgModule,
  type Pool,
} from './iam-acceptance-runner-runtime.ts';
import { verifyAdminUi } from './iam-acceptance-runner-ui.ts';
import { isCliEntrypoint } from './path-safety.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '../..');
const appRequire = createRequire(resolve(rootDir, 'apps/sva-studio-react/package.json'));
const authRuntimeRequire = createRequire(resolve(rootDir, 'packages/auth-runtime/package.json'));

const { chromium } = appRequire('@playwright/test') as BrowserModule;
const { Pool } = authRuntimeRequire('pg') as PgModule;

export const MANDATORY_ACCEPTANCE_STEP_NAMES = [
  'Preflight Testnutzer',
  'Testdaten-Reset',
  'Readiness',
  'OIDC Login Claims',
  'Admin JIT-Provisioning Erstlogin',
  'Member JIT-Provisioning Erstlogin',
  'Admin JIT-Provisioning Zweitlogin',
  'Organisations-CRUD',
  'Membership-Zuweisung',
  'UI Benutzerliste',
  'UI Organisationsstruktur',
] as const;

const createKeycloakAdmin = (config: AcceptanceConfig): KeycloakAdminClient => {
  const keycloakConfig: KeycloakAdminClientConfig = {
    baseUrl: config.keycloakAdmin.baseUrl,
    realm: config.keycloakAdmin.realm,
    clientId: config.keycloakAdmin.clientId,
    clientSecret: config.keycloakAdmin.clientSecret,
  };
  return new KeycloakAdminClient(keycloakConfig);
};

const executeMandatoryChecks = async (
  recorder: AcceptanceRecorder,
  input: { config: AcceptanceConfig; reportFileBase: string }
): Promise<void> => {
  const identities = await runIdentityPreflight(
    recorder,
    createKeycloakAdmin(input.config),
    input.config
  );
  const pool: Pool = new Pool({ connectionString: input.config.databaseUrl });
  const browser: Browser = await chromium.launch({ headless: true });
  try {
    await resetAcceptanceTestData(recorder, { ...identities, config: input.config, pool });
    await verifyReadiness(recorder, input.config);
    const loginEvidence = await runLoginAndJitChecks(recorder, {
      browser,
      config: input.config,
      pool,
    });
    try {
      await verifyOrganizationsAndMembership(recorder, {
        adminSession: loginEvidence.adminSession,
        config: input.config,
        memberAccountId: loginEvidence.memberAccountId,
        pool,
        reportFileBase: input.reportFileBase,
      });
      await verifyAdminUi(recorder, {
        adminSession: loginEvidence.adminSession,
        config: input.config,
        memberUser: loginEvidence.memberUser,
      });
    } finally {
      await loginEvidence.adminSession.context.close().catch(() => undefined);
    }
  } finally {
    await pool.end().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
};

const writeReport = async (
  recorder: AcceptanceRecorder,
  input: { config: AcceptanceConfig; generatedAt: Date; reportFileBase: string }
): Promise<void> => {
  const report = buildAcceptanceReport({
    baseUrl: input.config.baseUrl,
    generatedAt: input.generatedAt.toISOString(),
    instanceId: input.config.instanceId,
    steps: recorder.steps,
  });
  try {
    const reportPaths = await writeAcceptanceReports({
      generatedAt: input.generatedAt,
      report,
      reportDirectory: input.config.reportDirectory,
      reportFileBase: input.reportFileBase,
    });
    console.log(`[iam-acceptance] report written: ${reportPaths.markdownPath}`);
  } catch (error) {
    recorder.failStep({
      name: 'Acceptance-Bericht',
      failureCode: 'acceptance_report_write_failed',
      details: error instanceof Error ? error.message : String(error),
      metadata: {
        reportDirectory: input.config.reportDirectory,
        reportFileBase: input.reportFileBase,
      },
    });
  }
  if (report.summary.status === 'failed') {
    process.exitCode = 1;
  }
};

const createFallbackConfig = (): AcceptanceConfig =>
  parseAcceptanceConfig(
    {
      ...process.env,
      IAM_ACCEPTANCE_ADMIN_PASSWORD: process.env.IAM_ACCEPTANCE_ADMIN_PASSWORD ?? 'missing',
      IAM_ACCEPTANCE_ADMIN_USERNAME: process.env.IAM_ACCEPTANCE_ADMIN_USERNAME ?? 'missing',
      IAM_ACCEPTANCE_MEMBER_PASSWORD: process.env.IAM_ACCEPTANCE_MEMBER_PASSWORD ?? 'missing',
      IAM_ACCEPTANCE_MEMBER_USERNAME: process.env.IAM_ACCEPTANCE_MEMBER_USERNAME ?? 'missing',
      IAM_ACCEPTANCE_DATABASE_URL:
        process.env.IAM_ACCEPTANCE_DATABASE_URL ??
        process.env.IAM_DATABASE_URL ??
        'postgres://invalid/acceptance',
      KEYCLOAK_ADMIN_BASE_URL: process.env.KEYCLOAK_ADMIN_BASE_URL ?? 'https://invalid.example.com',
      KEYCLOAK_ADMIN_CLIENT_ID: process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? 'missing',
      KEYCLOAK_ADMIN_CLIENT_SECRET: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET ?? 'missing',
      KEYCLOAK_ADMIN_REALM: process.env.KEYCLOAK_ADMIN_REALM ?? 'missing',
    },
    rootDir
  );

const writeFallbackReport = async (
  recorder: AcceptanceRecorder,
  generatedAt: Date,
  reportFileBase: string
): Promise<void> => {
  try {
    const config = createFallbackConfig();
    const report = buildAcceptanceReport({
      baseUrl: config.baseUrl,
      generatedAt: generatedAt.toISOString(),
      instanceId: config.instanceId,
      steps: recorder.steps,
    });
    await writeAcceptanceReports({
      generatedAt,
      report,
      reportDirectory: config.reportDirectory,
      reportFileBase,
    });
  } catch {
    // The original classified error remains authoritative.
  }
};

export const runIamAcceptance = async (): Promise<void> => {
  const recorder = createAcceptanceRecorder();
  const startedAt = new Date();
  let reportFileBase = 'iam-foundation-acceptance';
  try {
    const config = parseAcceptanceConfig(process.env, rootDir);
    reportFileBase = createAcceptanceReportFileBase(config, startedAt);
    await executeMandatoryChecks(recorder, { config, reportFileBase });
    await writeReport(recorder, { config, generatedAt: startedAt, reportFileBase });
  } catch (error) {
    const configMissing =
      error instanceof Error && /Missing required acceptance env/.test(error.message);
    if (configMissing) {
      recorder.recordStep({
        name: 'Acceptance-Konfiguration',
        status: 'failed',
        failureCode: 'acceptance_config_missing',
        details: error.message,
      });
    } else if (!(error instanceof Error && /^acceptance_/.test(error.message))) {
      recorder.recordStep({
        name: 'Acceptance Runner',
        status: 'failed',
        failureCode: 'acceptance_runner_unexpected_error',
        details: error instanceof Error ? error.message : String(error),
      });
    }
    await writeFallbackReport(recorder, startedAt, reportFileBase);
    process.exitCode = 1;
  }
};

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  void runIamAcceptance();
}
