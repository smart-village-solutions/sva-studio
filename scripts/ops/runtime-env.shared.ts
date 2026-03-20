import { resolve } from 'node:path';

export type AcceptanceReleaseMode = 'app-only' | 'schema-and-app';
export type AcceptanceDeployStepName = 'precheck' | 'maintenance-window' | 'migrate' | 'deploy' | 'doctor' | 'smoke';
export type AcceptanceDeployStepStatus = 'ok' | 'skipped' | 'error';
export type AcceptanceFailureCategory =
  | 'config'
  | 'migration'
  | 'stack_rollout'
  | 'health'
  | 'smoke'
  | 'external_dependency';

export type RuntimeCliOptions = {
  actor?: string;
  grafanaUrl?: string;
  imageDigest?: string;
  imageTag?: string;
  jsonOutput: boolean;
  lokiUrl?: string;
  maintenanceWindow?: string;
  releaseMode?: AcceptanceReleaseMode;
  reportSlug?: string;
  rollbackHint?: string;
  workflow?: string;
};

export type AcceptanceDeployOptions = {
  actor: string;
  grafanaUrl?: string;
  imageDigest?: string;
  imageTag?: string;
  lokiUrl?: string;
  maintenanceWindow?: string;
  releaseMode: AcceptanceReleaseMode;
  reportSlug: string;
  rollbackHint: string;
  workflow: string;
};

export type AcceptanceDeployStep = {
  details?: Readonly<Record<string, unknown>>;
  durationMs: number;
  finishedAt: string;
  name: AcceptanceDeployStepName;
  startedAt: string;
  status: AcceptanceDeployStepStatus;
  summary: string;
};

export type AcceptanceDeployReport = {
  actor: string;
  artifacts: {
    jsonPath: string;
    markdownPath: string;
  };
  failureCategory?: AcceptanceFailureCategory;
  generatedAt: string;
  imageDigest?: string;
  imageTag?: string;
  maintenanceWindow?: string;
  migrationFiles: readonly string[];
  observability: {
    grafanaUrl?: string;
    lokiUrl?: string;
    notes: readonly string[];
  };
  profile: 'acceptance-hb';
  releaseMode: AcceptanceReleaseMode;
  reportId: string;
  rollbackHint: string;
  stackName: string;
  stackStatus?: {
    services?: string;
    tasks?: string;
  };
  status: 'ok' | 'error';
  steps: readonly AcceptanceDeployStep[];
  workflow: string;
};

const takeOptionValue = (raw: string, all: readonly string[], index: number) => {
  const [flag, inlineValue] = raw.split('=', 2);
  if (inlineValue !== undefined) {
    return { nextIndex: index, value: inlineValue };
  }

  const nextValue = all[index + 1];
  if (!nextValue || nextValue.startsWith('--')) {
    throw new Error(`Option ${flag} erwartet einen Wert.`);
  }

  return { nextIndex: index + 1, value: nextValue };
};

export const parseRuntimeCliOptions = (rawOptions: readonly string[]): RuntimeCliOptions => {
  const parsed: RuntimeCliOptions = {
    jsonOutput: false,
  };

  for (let index = 0; index < rawOptions.length; index += 1) {
    const rawOption = rawOptions[index];

    if (rawOption === '--json') {
      parsed.jsonOutput = true;
      continue;
    }

    if (!rawOption.startsWith('--')) {
      throw new Error(`Unbekannte Option: ${rawOption}`);
    }

    const optionName = rawOption.includes('=') ? rawOption.slice(0, rawOption.indexOf('=')) : rawOption;
    const { nextIndex, value } = takeOptionValue(rawOption, rawOptions, index);
    index = nextIndex;

    switch (optionName) {
      case '--release-mode':
        if (value !== 'app-only' && value !== 'schema-and-app') {
          throw new Error(`Ungueltiger Release-Modus: ${value}`);
        }
        parsed.releaseMode = value;
        break;
      case '--maintenance-window':
        parsed.maintenanceWindow = value;
        break;
      case '--actor':
        parsed.actor = value;
        break;
      case '--workflow':
        parsed.workflow = value;
        break;
      case '--image-tag':
        parsed.imageTag = value;
        break;
      case '--image-digest':
        parsed.imageDigest = value;
        break;
      case '--rollback-hint':
        parsed.rollbackHint = value;
        break;
      case '--report-slug':
        parsed.reportSlug = value;
        break;
      case '--grafana-url':
        parsed.grafanaUrl = value;
        break;
      case '--loki-url':
        parsed.lokiUrl = value;
        break;
      default:
        throw new Error(`Unbekannte Option: ${optionName}`);
    }
  }

  return parsed;
};

const sanitizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/-{2,}/gu, '-')
    .replace(/^-|-$/gu, '');

export const resolveAcceptanceDeployOptions = (
  env: NodeJS.ProcessEnv,
  cliOptions: RuntimeCliOptions
): AcceptanceDeployOptions => {
  const releaseMode = cliOptions.releaseMode ?? (env.SVA_ACCEPTANCE_RELEASE_MODE as AcceptanceReleaseMode | undefined) ?? 'app-only';
  if (releaseMode !== 'app-only' && releaseMode !== 'schema-and-app') {
    throw new Error(`Ungueltiger Acceptance-Release-Modus: ${releaseMode}`);
  }

  const maintenanceWindow =
    cliOptions.maintenanceWindow ?? env.SVA_ACCEPTANCE_MAINTENANCE_WINDOW?.trim() ?? undefined;
  const rollbackHint =
    cliOptions.rollbackHint?.trim() ||
    env.SVA_ACCEPTANCE_ROLLBACK_HINT?.trim() ||
    'Vorherigen unveraenderlichen Image-Tag oder Digest erneut deployen.';

  if (releaseMode === 'schema-and-app' && !maintenanceWindow) {
    throw new Error('Release-Modus schema-and-app erfordert ein Wartungsfenster (--maintenance-window oder SVA_ACCEPTANCE_MAINTENANCE_WINDOW).');
  }

  return {
    actor: cliOptions.actor?.trim() || env.SVA_ACCEPTANCE_DEPLOY_ACTOR?.trim() || env.GITHUB_ACTOR?.trim() || 'local-operator',
    workflow: cliOptions.workflow?.trim() || env.SVA_ACCEPTANCE_DEPLOY_WORKFLOW?.trim() || env.GITHUB_WORKFLOW?.trim() || 'manual',
    imageTag: cliOptions.imageTag?.trim() || env.SVA_IMAGE_TAG?.trim() || undefined,
    imageDigest: cliOptions.imageDigest?.trim() || env.SVA_IMAGE_DIGEST?.trim() || undefined,
    grafanaUrl: cliOptions.grafanaUrl?.trim() || env.SVA_GRAFANA_URL?.trim() || undefined,
    lokiUrl: cliOptions.lokiUrl?.trim() || env.SVA_LOKI_URL?.trim() || undefined,
    maintenanceWindow,
    releaseMode,
    reportSlug: sanitizeSlug(cliOptions.reportSlug || env.SVA_ACCEPTANCE_REPORT_SLUG || 'acceptance-deploy'),
    rollbackHint,
  };
};

export const buildAcceptanceReportPaths = (
  artifactsDir: string,
  reportSlug: string,
  generatedAt: string
) => {
  const safeTimestamp = generatedAt.replaceAll(':', '-').replaceAll('.', '-');
  const reportId = `${reportSlug}-${safeTimestamp}`;

  return {
    reportId,
    jsonPath: resolve(artifactsDir, `${reportId}.json`),
    markdownPath: resolve(artifactsDir, `${reportId}.md`),
  };
};

export const formatAcceptanceDeployReportMarkdown = (report: AcceptanceDeployReport) => {
  const lines = [
    `# Acceptance-Deploy-Report ${report.reportId}`,
    '',
    `- Profil: \`${report.profile}\``,
    `- Status: \`${report.status}\``,
    `- Release-Modus: \`${report.releaseMode}\``,
    `- Zeitpunkt: \`${report.generatedAt}\``,
    `- Actor: \`${report.actor}\``,
    `- Workflow: \`${report.workflow}\``,
    `- Stack: \`${report.stackName}\``,
    `- Image-Tag: \`${report.imageTag ?? 'n/a'}\``,
    `- Image-Digest: \`${report.imageDigest ?? 'n/a'}\``,
    `- Wartungsfenster: \`${report.maintenanceWindow ?? 'nicht erforderlich'}\``,
    `- Rollback-Hinweis: ${report.rollbackHint}`,
    report.failureCategory ? `- Fehlerkategorie: \`${report.failureCategory}\`` : null,
    '',
    '## Migrationen',
    '',
    ...(report.migrationFiles.length > 0 ? report.migrationFiles.map((file) => `- \`${file}\``) : ['- keine']),
    '',
    '## Schritte',
    '',
    ...report.steps.map(
      (step) =>
        `- \`${step.name}\` -> \`${step.status}\` (${step.durationMs} ms): ${step.summary}`
    ),
    '',
    '## Observability',
    '',
    `- Grafana: ${report.observability.grafanaUrl ?? 'n/a'}`,
    `- Loki: ${report.observability.lokiUrl ?? 'n/a'}`,
    ...report.observability.notes.map((note) => `- ${note}`),
    '',
    '## Stack-Status',
    '',
    '```text',
    report.stackStatus?.services?.trim() || 'Keine Service-Zusammenfassung vorhanden.',
    '',
    report.stackStatus?.tasks?.trim() || 'Keine Task-Zusammenfassung vorhanden.',
    '```',
    '',
  ];

  return lines.filter((line): line is string => line !== null).join('\n');
};
