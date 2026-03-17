import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type AcceptanceParticipantConfig = {
  readonly password: string;
  readonly username: string;
};

export type AcceptanceConfig = {
  readonly admin: AcceptanceParticipantConfig & {
    readonly expectedRoles: readonly string[];
  };
  readonly baseUrl: string;
  readonly databaseUrl: string;
  readonly instanceId: string;
  readonly keycloakAdmin: {
    readonly baseUrl: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly realm: string;
  };
  readonly member: AcceptanceParticipantConfig;
  readonly organizationKeyPrefix: string;
  readonly reportBasename: string;
  readonly reportDirectory: string;
};

export type AcceptanceStepStatus = 'passed' | 'failed' | 'skipped';

export type AcceptanceFailureCode =
  | 'acceptance_config_missing'
  | 'acceptance_database_query_failed'
  | 'acceptance_dependency_not_ready'
  | 'acceptance_expected_claim_missing'
  | 'acceptance_expected_role_missing'
  | 'acceptance_http_request_failed'
  | 'acceptance_keycloak_user_missing'
  | 'acceptance_keycloak_user_not_unique'
  | 'acceptance_login_failed'
  | 'acceptance_membership_missing'
  | 'acceptance_organization_assertion_failed'
  | 'acceptance_report_write_failed'
  | 'acceptance_test_data_reset_failed'
  | 'acceptance_ui_assertion_failed';

export type AcceptanceStepRecord = {
  readonly details?: string;
  readonly failureCode?: AcceptanceFailureCode;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly name: string;
  readonly status: AcceptanceStepStatus;
};

export type AcceptanceReport = {
  readonly generatedAt: string;
  readonly steps: readonly AcceptanceStepRecord[];
  readonly summary: {
    readonly failed: number;
    readonly passed: number;
    readonly skipped: number;
    readonly status: 'failed' | 'passed';
  };
  readonly target: {
    readonly baseUrl: string;
    readonly instanceId: string;
  };
};

const readRequiredEnv = (env: NodeJS.ProcessEnv, key: string): string | null => {
  const value = env[key]?.trim();
  return value ? value : null;
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

const normalizeCsv = (value: string | undefined, fallback: readonly string[]): readonly string[] => {
  const rawValues = value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return rawValues && rawValues.length > 0 ? rawValues : fallback;
};

export const parseAcceptanceConfig = (
  env: NodeJS.ProcessEnv,
  rootDir = process.cwd()
): AcceptanceConfig => {
  const missingKeys = [
    'IAM_ACCEPTANCE_ADMIN_USERNAME',
    'IAM_ACCEPTANCE_ADMIN_PASSWORD',
    'IAM_ACCEPTANCE_MEMBER_USERNAME',
    'IAM_ACCEPTANCE_MEMBER_PASSWORD',
    'KEYCLOAK_ADMIN_BASE_URL',
    'KEYCLOAK_ADMIN_REALM',
    'KEYCLOAK_ADMIN_CLIENT_ID',
    'KEYCLOAK_ADMIN_CLIENT_SECRET',
  ].filter((key) => !readRequiredEnv(env, key));

  const databaseUrl = readRequiredEnv(env, 'IAM_ACCEPTANCE_DATABASE_URL') ?? readRequiredEnv(env, 'IAM_DATABASE_URL');
  if (!databaseUrl) {
    missingKeys.push('IAM_ACCEPTANCE_DATABASE_URL|IAM_DATABASE_URL');
  }

  if (missingKeys.length > 0) {
    throw new Error(`Missing required acceptance env: ${missingKeys.join(', ')}`);
  }

  return {
    admin: {
      username: readRequiredEnv(env, 'IAM_ACCEPTANCE_ADMIN_USERNAME') as string,
      password: readRequiredEnv(env, 'IAM_ACCEPTANCE_ADMIN_PASSWORD') as string,
      expectedRoles: normalizeCsv(env.IAM_ACCEPTANCE_EXPECTED_ADMIN_ROLES, ['system_admin']),
    },
    member: {
      username: readRequiredEnv(env, 'IAM_ACCEPTANCE_MEMBER_USERNAME') as string,
      password: readRequiredEnv(env, 'IAM_ACCEPTANCE_MEMBER_PASSWORD') as string,
    },
    baseUrl: normalizeBaseUrl(env.IAM_ACCEPTANCE_BASE_URL?.trim() || 'http://127.0.0.1:3000'),
    databaseUrl: databaseUrl as string,
    instanceId: env.IAM_ACCEPTANCE_INSTANCE_ID?.trim() || 'de-musterhausen',
    keycloakAdmin: {
      baseUrl: readRequiredEnv(env, 'KEYCLOAK_ADMIN_BASE_URL') as string,
      realm: readRequiredEnv(env, 'KEYCLOAK_ADMIN_REALM') as string,
      clientId: readRequiredEnv(env, 'KEYCLOAK_ADMIN_CLIENT_ID') as string,
      clientSecret: readRequiredEnv(env, 'KEYCLOAK_ADMIN_CLIENT_SECRET') as string,
    },
    organizationKeyPrefix: env.IAM_ACCEPTANCE_ORGANIZATION_KEY_PREFIX?.trim() || 'acceptance',
    reportBasename: env.IAM_ACCEPTANCE_REPORT_SLUG?.trim() || 'iam-foundation-acceptance',
    reportDirectory: resolve(rootDir, env.IAM_ACCEPTANCE_REPORT_DIR?.trim() || 'docs/reports'),
  };
};

export const summarizeAcceptanceSteps = (
  steps: readonly AcceptanceStepRecord[]
): AcceptanceReport['summary'] => {
  const passed = steps.filter((step) => step.status === 'passed').length;
  const failed = steps.filter((step) => step.status === 'failed').length;
  const skipped = steps.filter((step) => step.status === 'skipped').length;
  return {
    passed,
    failed,
    skipped,
    status: failed > 0 ? 'failed' : 'passed',
  };
};

export const renderAcceptanceMarkdownReport = (report: AcceptanceReport): string => {
  const lines = [
    '# Verifikationsbericht: IAM Foundation Acceptance',
    '',
    '## Kontext',
    '',
    `- Zeitpunkt: ${report.generatedAt}`,
    `- Zielumgebung: ${report.target.baseUrl}`,
    `- Instanzkontext: ${report.target.instanceId}`,
    `- Ergebnis: ${report.summary.status === 'passed' ? 'erfolgreich' : 'fehlgeschlagen'}`,
    '',
    '## Zusammenfassung',
    '',
    `- Erfolgreiche Schritte: ${report.summary.passed}`,
    `- Fehlgeschlagene Schritte: ${report.summary.failed}`,
    `- Übersprungene Schritte: ${report.summary.skipped}`,
    '',
    '## Prüfschritte',
    '',
  ];

  for (const step of report.steps) {
    lines.push(`### ${step.name}`);
    lines.push('');
    lines.push(`- Status: ${step.status}`);
    if (step.failureCode) {
      lines.push(`- Fehlercode: ${step.failureCode}`);
    }
    if (step.details) {
      lines.push(`- Details: ${step.details}`);
    }
    if (step.metadata && Object.keys(step.metadata).length > 0) {
      lines.push('- Metadaten:');
      lines.push('```json');
      lines.push(JSON.stringify(step.metadata, null, 2));
      lines.push('```');
    }
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
};

export const buildAcceptanceReport = (input: {
  baseUrl: string;
  generatedAt?: string;
  instanceId: string;
  steps: readonly AcceptanceStepRecord[];
}): AcceptanceReport => ({
  generatedAt: input.generatedAt ?? new Date().toISOString(),
  steps: input.steps,
  summary: summarizeAcceptanceSteps(input.steps),
  target: {
    baseUrl: input.baseUrl,
    instanceId: input.instanceId,
  },
});

export const createAcceptanceReportFileBase = (
  config: AcceptanceConfig,
  generatedAt: Date
): string => {
  const isoDate = generatedAt.toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z');
  return `${config.reportBasename}-${isoDate}`;
};

export const writeAcceptanceReports = async (input: {
  generatedAt: Date;
  report: AcceptanceReport;
  reportDirectory: string;
  reportFileBase: string;
}): Promise<{ jsonPath: string; markdownPath: string }> => {
  const markdownPath = resolve(input.reportDirectory, `${input.reportFileBase}.md`);
  const jsonPath = resolve(input.reportDirectory, `${input.reportFileBase}.json`);
  await mkdir(input.reportDirectory, { recursive: true });
  await writeFile(markdownPath, renderAcceptanceMarkdownReport(input.report), 'utf8');
  await writeFile(jsonPath, `${JSON.stringify(input.report, null, 2)}\n`, 'utf8');
  return { jsonPath, markdownPath };
};
