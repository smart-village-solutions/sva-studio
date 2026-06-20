import { resolve } from 'node:path';

import type { RuntimeProfile } from '../../packages/core/src/runtime-profile.ts';
import { getRuntimeProfileDefinition } from '../../packages/core/src/runtime-profile.ts';
import type {
  AcceptanceDeployOptions,
  AcceptanceDeployReport,
  AcceptanceReleaseMode,
  GithubVerifyArtifactEvidence,
  GithubVerifyEvidenceOptions,
  ProdParityProbePlan,
  RemoteMutationCommand,
  RemoteRuntimeProfile,
  RuntimeCliOptions,
} from './runtime-env.shared.types.ts';

export const getRuntimeStatusExecutionMode = (runtimeProfile: RuntimeProfile): 'local' | 'remote' =>
  getRuntimeProfileDefinition(runtimeProfile).isLocal ? 'local' : 'remote';

export const buildProdParityProbePlan = (env: NodeJS.ProcessEnv): ProdParityProbePlan => {
  const rootHost =
    env.SVA_PUBLIC_HOST?.trim() ||
    (() => {
      const configuredBaseUrl = env.SVA_PUBLIC_BASE_URL?.trim();
      if (!configuredBaseUrl) {
        return 'localhost';
      }

      try {
        return new URL(configuredBaseUrl).host;
      } catch {
        return configuredBaseUrl;
      }
    })();
  const parentDomain = env.SVA_PARENT_DOMAIN?.trim() || rootHost;
  const tenantHosts = (env.SVA_ALLOWED_INSTANCE_IDS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((instanceId) => ({
      host: `${instanceId}.${parentDomain}`,
      instanceId,
    }));

  return { rootHost, tenantHosts };
};

export const buildTrustedForwardedHeaders = (host: string): Record<string, string> => ({
  forwarded: `for=127.0.0.1;proto=https;host=${host}`,
  'x-forwarded-host': host,
  'x-forwarded-proto': 'https',
});

const parseJsonCandidate = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const parseJsonFromCommandOutput = <T>(rawOutput: string): T => {
  const normalized = rawOutput.trim();
  if (normalized.length === 0) {
    throw new Error('Leere JSON-Ausgabe.');
  }

  const direct = parseJsonCandidate<T>(normalized);
  if (direct !== null) {
    return direct;
  }

  const nonEmptyLines = normalized
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (let index = nonEmptyLines.length - 1; index >= 0; index -= 1) {
    const candidate = parseJsonCandidate<T>(nonEmptyLines[index] ?? '');
    if (candidate !== null) {
      return candidate;
    }
  }

  const trailingJsonMatch = normalized.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/u);
  const trailingCandidate = trailingJsonMatch?.[1] ? parseJsonCandidate<T>(trailingJsonMatch[1]) : null;
  if (trailingCandidate !== null) {
    return trailingCandidate;
  }

  throw new Error(`JSON-Ausgabe konnte nicht gelesen werden: ${normalized}`);
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
  const parsed: RuntimeCliOptions = { jsonOutput: false };

  for (let index = 0; index < rawOptions.length; index += 1) {
    const rawOption = rawOptions[index];
    if (rawOption === '--') continue;
    if (rawOption === '--json') {
      parsed.jsonOutput = true;
      continue;
    }
    if (rawOption === '--authoritative') {
      parsed.authoritative = true;
      continue;
    }
    if (!rawOption.startsWith('--')) {
      throw new Error(`Unbekannte Option: ${rawOption}`);
    }

    const optionName = rawOption.includes('=') ? rawOption.slice(0, rawOption.indexOf('=')) : rawOption;
    const { nextIndex, value } = takeOptionValue(rawOption, rawOptions, index);
    index = nextIndex;

    switch (optionName) {
      case '--approve-dangerous': parsed.approvalToken = value; break;
      case '--release-mode':
        if (value !== 'app-only' && value !== 'schema-and-app') throw new Error(`Ungueltiger Release-Modus: ${value}`);
        parsed.releaseMode = value;
        break;
      case '--maintenance-window': parsed.maintenanceWindow = value; break;
      case '--actor': parsed.actor = value; break;
      case '--workflow': parsed.workflow = value; break;
      case '--image-tag': parsed.imageTag = value; break;
      case '--image-digest': parsed.imageDigest = value; break;
      case '--rollback-hint': parsed.rollbackHint = value; break;
      case '--report-slug': parsed.reportSlug = value; break;
      case '--grafana-url': parsed.grafanaUrl = value; break;
      case '--loki-url': parsed.lokiUrl = value; break;
      case '--local-override-file': parsed.localOverrideFile = value; break;
      default: throw new Error(`Unbekannte Option: ${optionName}`);
    }
  }

  return parsed;
};

const sanitizeSlug = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9-]+/gu, '-').replace(/-{2,}/gu, '-').replace(/^-|-$/gu, '');

export const resolveAcceptanceDeployOptions = (
  env: NodeJS.ProcessEnv,
  cliOptions: RuntimeCliOptions,
  runtimeProfile: RemoteRuntimeProfile = 'studio',
): AcceptanceDeployOptions => {
  const releaseMode = cliOptions.releaseMode ?? (env.SVA_ACCEPTANCE_RELEASE_MODE as AcceptanceReleaseMode | undefined) ?? 'app-only';
  if (releaseMode !== 'app-only' && releaseMode !== 'schema-and-app') {
    throw new Error(`Ungueltiger Release-Modus fuer ${runtimeProfile}: ${releaseMode}`);
  }

  const maintenanceWindow = cliOptions.maintenanceWindow ?? env.SVA_ACCEPTANCE_MAINTENANCE_WINDOW?.trim() ?? undefined;
  const rollbackHint =
    cliOptions.rollbackHint?.trim() ||
    env.SVA_ACCEPTANCE_ROLLBACK_HINT?.trim() ||
    'Vorherigen unveraenderlichen Image-Tag oder Digest erneut deployen.';
  if (releaseMode === 'schema-and-app' && !maintenanceWindow) {
    throw new Error('Release-Modus schema-and-app erfordert ein Wartungsfenster (--maintenance-window oder SVA_ACCEPTANCE_MAINTENANCE_WINDOW).');
  }

  const imageDigest = cliOptions.imageDigest?.trim() || env.SVA_IMAGE_DIGEST?.trim() || undefined;
  if (!imageDigest) {
    throw new Error(`Produktionsnahe Releases fuer ${runtimeProfile} erfordern einen Image-Digest (--image-digest oder SVA_IMAGE_DIGEST).`);
  }

  const imageRepository = env.SVA_IMAGE_REPOSITORY?.trim() || 'sva-studio';
  const imageRegistry = env.SVA_REGISTRY?.trim() || 'ghcr.io/smart-village-solutions';
  return {
    actor: cliOptions.actor?.trim() || env.SVA_REMOTE_DEPLOY_ACTOR?.trim() || env.SVA_ACCEPTANCE_DEPLOY_ACTOR?.trim() || env.GITHUB_ACTOR?.trim() || 'local-operator',
    workflow: cliOptions.workflow?.trim() || env.SVA_REMOTE_DEPLOY_WORKFLOW?.trim() || env.SVA_ACCEPTANCE_DEPLOY_WORKFLOW?.trim() || env.GITHUB_WORKFLOW?.trim() || 'manual',
    imageTag: cliOptions.imageTag?.trim() || env.SVA_IMAGE_TAG?.trim() || undefined,
    imageDigest,
    imageRef: env.SVA_IMAGE_REF?.trim() || `${imageRegistry}/${imageRepository}@${imageDigest}`,
    imageRepository,
    grafanaUrl: cliOptions.grafanaUrl?.trim() || env.SVA_GRAFANA_URL?.trim() || undefined,
    lokiUrl: cliOptions.lokiUrl?.trim() || env.SVA_LOKI_URL?.trim() || undefined,
    maintenanceWindow,
    monitoringConfigImageTag: env.SVA_MONITORING_CONFIG_INIT_IMAGE_TAG?.trim() || undefined,
    releaseMode,
    reportSlug: sanitizeSlug(cliOptions.reportSlug || env.SVA_REMOTE_REPORT_SLUG || env.SVA_ACCEPTANCE_REPORT_SLUG || `${runtimeProfile}-deploy`),
    rollbackHint,
  };
};

export const isTruthyFlag = (value: string | undefined) =>
  ['1', 'true', 'yes', 'on'].includes((value?.trim() || '').toLowerCase());

export const hasLocalEmergencyRemoteMutationOverride = (env: NodeJS.ProcessEnv) =>
  isTruthyFlag(env.SVA_ALLOW_LOCAL_REMOTE_MUTATIONS);

export const assertDeterministicRemoteMutationContext = (
  env: NodeJS.ProcessEnv,
  runtimeProfile: RemoteRuntimeProfile,
  command: RemoteMutationCommand,
) => {
  const operatorContext = env.SVA_REMOTE_OPERATOR_CONTEXT?.trim().toLowerCase() || '';
  const hasCiRunnerContext =
    operatorContext === 'ci-runner' ||
    (isTruthyFlag(env.GITHUB_ACTIONS) &&
      (env.GITHUB_WORKFLOW?.trim() || env.SVA_REMOTE_DEPLOY_WORKFLOW?.trim() || env.SVA_ACCEPTANCE_DEPLOY_WORKFLOW?.trim() || '').length > 0);
  const hasLocalOperatorContext = operatorContext === 'local-operator';
  const allowLocalEmergency = hasLocalEmergencyRemoteMutationOverride(env);

  if (hasCiRunnerContext) return { mode: 'ci-runner' as const };
  if (hasLocalOperatorContext) {
    if (runtimeProfile !== 'studio') {
      throw new Error(`Remote-Mutation ${command} fuer ${runtimeProfile} ist nicht fuer den lokalen Operator-Pfad freigegeben. Nutze den Workflow-Pfad. Der dokumentierte Notfallpfad mit SVA_ALLOW_LOCAL_REMOTE_MUTATIONS=true greift nur, wenn SVA_REMOTE_OPERATOR_CONTEXT nicht auf local-operator steht.`);
    }
    return { mode: 'local-operator' as const };
  }
  if (runtimeProfile === 'studio') {
    throw new Error(`Remote-Mutation ${command} fuer ${runtimeProfile} ist nur im kanonischen CI-/Runner-Kontext oder ueber den expliziten lokalen Operator-Pfad erlaubt.`);
  }
  if (allowLocalEmergency) return { mode: 'local-emergency' as const };
  throw new Error(`Remote-Mutation ${command} fuer ${runtimeProfile} ist nur im kanonischen CI-/Runner-Kontext erlaubt. Nutze den Workflow-Pfad oder setze SVA_ALLOW_LOCAL_REMOTE_MUTATIONS=true fuer einen dokumentierten Notfallpfad.`);
};

export const buildAcceptanceReportPaths = (artifactsDir: string, reportSlug: string, generatedAt: string) => {
  const safeTimestamp = generatedAt.replaceAll(':', '-').replaceAll('.', '-');
  const reportId = `${reportSlug}-${safeTimestamp}`;
  return {
    reportId,
    jsonPath: resolve(artifactsDir, `${reportId}.json`),
    markdownPath: resolve(artifactsDir, `${reportId}.md`),
    releaseManifestPath: resolve(artifactsDir, `${reportId}.manifest.json`),
    phaseReportPath: resolve(artifactsDir, `${reportId}.phases.json`),
    bootstrapJobPath: resolve(artifactsDir, `${reportId}.bootstrap-job.json`),
    bootstrapReportPath: resolve(artifactsDir, `${reportId}.bootstrap.json`),
    migrationJobPath: resolve(artifactsDir, `${reportId}.migration-job.json`),
    migrationReportPath: resolve(artifactsDir, `${reportId}.migration.json`),
    internalVerifyPath: resolve(artifactsDir, `${reportId}.internal-probes.json`),
    externalSmokePath: resolve(artifactsDir, `${reportId}.external-probes.json`),
  };
};

export const formatAcceptanceDeployReportMarkdown = (report: AcceptanceDeployReport) => {
  const renderProbe = (probe: { durationMs: number; httpStatus?: number; message: string; name: string; status: string; target: string }) =>
    `- \`${probe.name}\` -> \`${probe.status}\` (${probe.durationMs} ms, target=${probe.target}, http=${probe.httpStatus ?? 'n/a'}): ${probe.message}`;
  const lines = [
    `# Deploy-Report ${report.reportId}`,
    '',
    `- Profil: \`${report.profile}\``,
    `- Status: \`${report.status}\``,
    `- Release-Modus: \`${report.releaseMode}\``,
    `- Zeitpunkt: \`${report.generatedAt}\``,
    `- Actor: \`${report.actor}\``,
    `- Workflow: \`${report.workflow}\``,
    `- Stack: \`${report.stackName}\``,
    `- Image-Ref: \`${report.imageRef}\``,
    `- Image-Tag: \`${report.imageTag ?? 'n/a'}\``,
    `- Image-Digest: \`${report.imageDigest}\``,
    `- Wartungsfenster: \`${report.maintenanceWindow ?? 'nicht erforderlich'}\``,
    `- Rollback-Hinweis: ${report.rollbackHint}`,
    report.failureCategory ? `- Fehlerkategorie: \`${report.failureCategory}\`` : null,
    `- Technical Gate: \`${report.releaseDecision.technicalGatePassed ? 'passed' : 'failed'}\``,
    `- Freigabeentscheidung: ${report.releaseDecision.summary}`,
    '',
    '## Schritte',
    '',
    ...report.steps.map((step) => `- \`${step.name}\` -> \`${step.status}\` (${step.durationMs} ms): ${step.summary}`),
    '',
    '## Interne Probes',
    '',
    ...(report.internalProbes.length > 0 ? report.internalProbes.map(renderProbe) : ['- keine']),
    '',
    '## Externe Probes',
    '',
    ...(report.externalProbes.length > 0 ? report.externalProbes.map(renderProbe) : ['- keine']),
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
};

export type { GithubVerifyArtifactEvidence, GithubVerifyEvidenceOptions };
