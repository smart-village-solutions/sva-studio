import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import {
  buildPromoteFailure,
  normalizePromoteEnvironment,
  parsePromoteFailure,
  type PromoteEnvironment,
  type PromoteFailure,
  type PromotePhase,
} from './promote-result.ts';

export type PromoteGateStatus = 'passed' | 'failed' | 'cancelled' | 'skipped';
export type PromoteEvidenceStatus = 'passed' | 'failed' | 'cancelled';
export type PromoteGateName =
  | 'workspace-setup'
  | 'input-validation'
  | 'permission-snapshot-secret'
  | 'source-preparation'
  | 'source-contract'
  | 'registry-login'
  | 'image-contract'
  | 'config-build'
  | 'change-policy-evaluation'
  | 'migration-bootstrap-policy'
  | 'deployment-tooling'
  | 'target-resolution'
  | 'readiness'
  | 'candidate-preflight'
  | 'staging-parity'
  | 'previous-live-capture'
  | 'backup-capabilities'
  | 'studio-backup-request'
  | 'waste-backup-request'
  | 'temporary-backup'
  | 'studio-backup-verification'
  | 'waste-backup-verification'
  | 'migration'
  | 'bootstrap'
  | 'postconditions'
  | 'deploy'
  | 'runtime-smoke'
  | 'digest-verification'
  | 'staging-parity-evidence'
  | 'staging-parity-upload'
  | 'one-shot-evidence-upload'
  | 'config-cleanup';

export type PromoteGateEvidence = Readonly<{
  gate: PromoteGateName;
  phase: PromotePhase;
  status: PromoteGateStatus;
  blocking: boolean;
  failure?: PromoteFailure;
}>;

export type PromoteBackupAgentEvidence = Readonly<{
  agentRevision: string;
  protocolVersions: readonly number[];
  databaseTargets: readonly string[];
  resultFields: readonly string[];
  wasteInventory: boolean;
}>;

export type PromoteEvidence = Readonly<{
  schemaVersion: 1;
  run: Readonly<{ id: string; attempt: number }>;
  environment: PromoteEnvironment;
  status: PromoteEvidenceStatus;
  git: Readonly<{
    baseRef: string;
    headRef: string;
    baseSha: string | null;
    headSha: string | null;
  }>;
  image: Readonly<{
    previousDigest: string | null;
    targetDigest: string | null;
    revision: string | null;
  }>;
  config: Readonly<{
    revision: string | null;
    externalSecretReferences: readonly string[];
  }>;
  backupAgent: PromoteBackupAgentEvidence | null;
  gates: readonly PromoteGateEvidence[];
  terminalFailure: PromoteFailure | null;
}>;

export type BuildPromoteEvidenceInput = Readonly<{
  runId: string;
  runAttempt: number;
  environment: PromoteEnvironment;
  status: PromoteEvidenceStatus;
  baseRef: string;
  headRef: string;
  baseSha?: string | null;
  headSha?: string | null;
  previousImage?: string | null;
  targetImage?: string | null;
  imageRevision?: string | null;
  configRevision?: string | null;
  externalSecretReferences?: readonly string[];
  backupAgent?: PromoteBackupAgentEvidence | null;
  gates: readonly Readonly<{
    gate: PromoteGateName;
    phase: PromotePhase;
    status: PromoteGateStatus;
    blocking?: boolean;
  }>[];
  recordedFailure?: PromoteFailure | null;
}>;

const shaPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const digestPattern = /sha256:[0-9a-f]{64}/u;
const revisionPattern = /^[0-9a-f]{64}$/u;
const gitRefPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/u;
const safeReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/u;
const safeFieldPattern = /^[a-z][A-Za-z0-9_-]{0,63}$/u;
const imageRevisionPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64}|sha256:[0-9a-f]{64}|[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})$/u;
const backupAgentRevisionPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64}|[A-Za-z0-9._/-]+@sha256:[0-9a-f]{64})$/u;
const gateStatuses: readonly PromoteGateStatus[] = ['passed', 'failed', 'cancelled', 'skipped'];
const evidenceStatuses: readonly PromoteEvidenceStatus[] = ['passed', 'failed', 'cancelled'];
const evidenceEnvironments: readonly PromoteEnvironment[] = ['dev', 'staging', 'prod', 'invalid'];
const gateNames: readonly PromoteGateName[] = [
  'workspace-setup', 'input-validation', 'permission-snapshot-secret', 'source-preparation', 'source-contract',
  'registry-login', 'image-contract', 'config-build', 'change-policy-evaluation',
  'migration-bootstrap-policy',
  'deployment-tooling', 'target-resolution', 'readiness', 'previous-live-capture',
  'candidate-preflight', 'staging-parity', 'backup-capabilities', 'studio-backup-request', 'waste-backup-request',
  'temporary-backup', 'studio-backup-verification', 'waste-backup-verification', 'migration',
  'bootstrap', 'postconditions', 'deploy', 'runtime-smoke', 'digest-verification',
  'staging-parity-evidence', 'staging-parity-upload', 'one-shot-evidence-upload',
  'config-cleanup',
];
const evidencePhases: readonly PromotePhase[] = [
  'input-validation', 'source-contract', 'image-contract', 'config-build', 'static-preflight',
  'candidate-preflight', 'staging-parity', 'backup-capabilities', 'backup', 'migration',
  'bootstrap', 'postconditions', 'deploy', 'swarm-convergence', 'external-smoke',
  'digest-verification', 'evidence',
];

const assertGitRef = (value: string, label: string): string => {
  if (!gitRefPattern.test(value) || value.includes('..') || value.includes('@{'))
    throw new Error(`${label} verletzt den redigierten Evidenzvertrag.`);
  return value;
};

const normalizeWorkflowRef = (value: string | undefined): string => {
  if (!value?.trim()) return 'invalid-ref';
  try {
    return assertGitRef(value, 'Git-Ref');
  } catch {
    return 'invalid-ref';
  }
};

const assertRunId = (value: string): string => {
  if (!/^\d+$/u.test(value)) throw new Error('Run-ID verletzt den Evidenzvertrag.');
  return value;
};

const assertSafeField = (value: string, label: string): string => {
  if (!safeFieldPattern.test(value)) throw new Error(`${label} verletzt den Evidenzvertrag.`);
  return value;
};

const assertImageRevision = (value: string): string => {
  if (!imageRevisionPattern.test(value))
    throw new Error('Image-Revision verletzt den Evidenzvertrag.');
  return value;
};

const assertBackupAgentRevision = (value: string): string => {
  if (!backupAgentRevisionPattern.test(value))
    throw new Error('Agent-Revision verletzt den Evidenzvertrag.');
  return value;
};

const assertSha = (value: string, label: string): string => {
  if (!shaPattern.test(value)) throw new Error(`${label} ist kein vollständiges Git-SHA.`);
  return value;
};

const normalizeDigest = (value: string | null | undefined): string | null => {
  if (!value?.trim()) return null;
  if (value === 'not-pinned' || value === 'not-evaluated') return null;
  const match = value.match(digestPattern);
  if (!match) throw new Error('Image-Digest verletzt den Evidenzvertrag.');
  return match[0];
};

const normalizeConfigRevision = (value: string | null | undefined): string | null => {
  if (!value?.trim()) return null;
  if (!revisionPattern.test(value)) throw new Error('Config-Revision verletzt den Evidenzvertrag.');
  return value;
};

const normalizeBackupAgent = (
  value: PromoteBackupAgentEvidence | null | undefined
): PromoteBackupAgentEvidence | null => {
  if (!value) return null;
  if (
    !Array.isArray(value.protocolVersions) ||
    !value.protocolVersions.every((version) => Number.isSafeInteger(version) && version > 0) ||
    !Array.isArray(value.databaseTargets) ||
    !Array.isArray(value.resultFields)
  )
    throw new Error('Backup-Agent-Evidenz ist ungültig.');
  return {
    agentRevision: assertBackupAgentRevision(value.agentRevision),
    protocolVersions: [...value.protocolVersions].sort((left, right) => left - right),
    databaseTargets: [
      ...new Set(
        value.databaseTargets.map((target) => assertSafeField(target, 'Datenbankziel'))
      ),
    ].sort(),
    resultFields: [
      ...new Set(value.resultFields.map((field) => assertSafeField(field, 'Ergebnisfeld'))),
    ].sort(),
    wasteInventory: value.wasteInventory === true,
  };
};

export const buildPromoteEvidence = (input: BuildPromoteEvidenceInput): PromoteEvidence => {
  if (!Number.isSafeInteger(input.runAttempt) || input.runAttempt < 1)
    throw new Error('Run-Attempt ist ungültig.');
  if (!evidenceEnvironments.includes(input.environment))
    throw new Error('Environment ist ungültig.');
  if (!evidenceStatuses.includes(input.status)) throw new Error('Evidenzstatus ist ungültig.');
  const gates = input.gates.map((gate): PromoteGateEvidence => {
    if (!gateStatuses.includes(gate.status)) throw new Error('Gate-Status ist ungültig.');
    if (!gateNames.includes(gate.gate)) throw new Error('Gate-Name ist ungültig.');
    if (!evidencePhases.includes(gate.phase)) throw new Error('Gate-Phase ist ungültig.');
    return {
      gate: gate.gate,
      phase: gate.phase,
      status: gate.status,
      blocking: gate.blocking !== false,
    };
  });
  const firstFailedPhase = gates.find(
    (gate) => gate.blocking && (gate.status === 'failed' || gate.status === 'cancelled')
  )?.phase;
  const canonicalRecordedFailure = parsePromoteFailure(input.recordedFailure);
  const recordedFailure =
    canonicalRecordedFailure &&
    canonicalRecordedFailure.environment === input.environment &&
    (!firstFailedPhase || canonicalRecordedFailure.phase === firstFailedPhase)
      ? canonicalRecordedFailure
      : null;
  const terminalFailure =
    input.status === 'passed'
      ? null
      : (recordedFailure ??
        buildPromoteFailure({
          code: 'PROMOTE_INTERNAL_ERROR',
          environment: input.environment,
          phase: firstFailedPhase ?? 'evidence',
        }));
  const gatesWithFailure = gates.map((gate) =>
    gate.phase === terminalFailure?.phase &&
    gate.blocking &&
    (gate.status === 'failed' || gate.status === 'cancelled')
      ? { ...gate, failure: terminalFailure }
      : gate
  );

  return {
    schemaVersion: 1,
    run: { id: assertRunId(input.runId), attempt: input.runAttempt },
    environment: input.environment,
    status: input.status,
    git: {
      baseRef: assertGitRef(input.baseRef, 'Base-Ref'),
      headRef: assertGitRef(input.headRef, 'Head-Ref'),
      baseSha: input.baseSha?.trim() ? assertSha(input.baseSha, 'Base-SHA') : null,
      headSha: input.headSha?.trim() ? assertSha(input.headSha, 'Head-SHA') : null,
    },
    image: {
      previousDigest: normalizeDigest(input.previousImage),
      targetDigest: normalizeDigest(input.targetImage),
      revision: input.imageRevision?.trim()
        ? assertImageRevision(input.imageRevision)
        : null,
    },
    config: {
      revision: normalizeConfigRevision(input.configRevision),
      externalSecretReferences: [
        ...new Set(
          (input.externalSecretReferences ?? []).map((reference) => {
            if (!safeReferencePattern.test(reference))
              throw new Error('Secret-Referenz verletzt den Evidenzvertrag.');
            return reference;
          })
        ),
      ].sort(),
    },
    backupAgent: normalizeBackupAgent(input.backupAgent),
    gates: gatesWithFailure,
    terminalFailure,
  };
};

const escapeWorkflowCommand = (value: string): string =>
  value
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A')
    .replaceAll(':', '%3A')
    .replaceAll(',', '%2C');

const escapeMarkdownCell = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', ' ');

export const renderPromoteAnnotation = (evidence: PromoteEvidence): string | null => {
  const failure = evidence.terminalFailure;
  if (!failure) return null;
  return `::error title=${escapeWorkflowCommand(failure.code)}::${escapeWorkflowCommand(`${failure.summary} Nächster Schritt: ${failure.nextAction}`)}`;
};

export const renderPromoteSummary = (evidence: PromoteEvidence): string => {
  const rows: readonly [string, string][] = [
    ['status', evidence.status],
    ['environment', evidence.environment],
    ['run', `${evidence.run.id}/${evidence.run.attempt}`],
    ['base_ref', evidence.git.baseRef],
    ['head_ref', evidence.git.headRef],
    ['base_sha', evidence.git.baseSha ?? 'not-resolved'],
    ['head_sha', evidence.git.headSha ?? 'not-resolved'],
    ['previous_digest', evidence.image.previousDigest ?? 'not-captured'],
    ['target_digest', evidence.image.targetDigest ?? 'not-evaluated'],
    ['image_revision', evidence.image.revision ?? 'not-evaluated'],
    ['config_revision', evidence.config.revision ?? 'not-evaluated'],
    ['external_secret_references', evidence.config.externalSecretReferences.join(', ') || 'none'],
    ['backup_agent_revision', evidence.backupAgent?.agentRevision ?? 'not-evaluated'],
    ['terminal_code', evidence.terminalFailure?.code ?? 'none'],
  ];
  return [
    '## Promote-Evidenz',
    '',
    '| Feld | Wert |',
    '| --- | --- |',
    ...rows.map(([label, value]) => `| ${label} | ${escapeMarkdownCell(value)} |`),
    '',
    '### Gate-Ergebnisse',
    '',
    '| Phase | Status | Blockierend | Fehlercode |',
    '| --- | --- | --- | --- |',
    ...evidence.gates.map(
      (gate) => `| ${gate.gate} (${gate.phase}) | ${gate.status} | ${gate.blocking ? 'ja' : 'nein'} | ${gate.failure?.code ?? 'none'} |`
    ),
    ...(evidence.terminalFailure
      ? [
          '',
          `**${evidence.terminalFailure.code}:** ${evidence.terminalFailure.summary}`,
          '',
          `Nächster Schritt: ${evidence.terminalFailure.nextAction}`,
        ]
      : []),
    '',
  ].join('\n');
};

export const writePromoteEvidence = (
  evidence: PromoteEvidence,
  options: Readonly<{
    outputPath: string;
    summaryPath?: string | null;
    stdout?: Pick<NodeJS.WriteStream, 'write'>;
  }>
): string => {
  mkdirSync(dirname(options.outputPath), { recursive: true });
  writeFileSync(options.outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  if (options.summaryPath)
    appendFileSync(options.summaryPath, renderPromoteSummary(evidence), 'utf8');
  const annotation = renderPromoteAnnotation(evidence);
  if (annotation) (options.stdout ?? process.stdout).write(`${annotation}\n`);
  return options.outputPath;
};

const parseJson = <T>(value: string | undefined, fallback: T): T => {
  if (!value?.trim()) return fallback;
  return JSON.parse(value) as T;
};

const readRecordedFailure = (path: string | undefined): PromoteFailure | null => {
  if (!path) return null;
  try {
    return parsePromoteFailure(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return null;
  }
};

const normalizeWorkflowStatus = (value: string | undefined): PromoteEvidenceStatus =>
  value === 'success' ? 'passed' : value === 'cancelled' ? 'cancelled' : 'failed';

const normalizeGateStatus = (value: string | undefined): PromoteGateStatus =>
  value === 'success'
    ? 'passed'
    : value === 'failure'
      ? 'failed'
      : value === 'cancelled'
        ? 'cancelled'
        : 'skipped';

const required = (value: string | undefined, label: string): string => {
  if (!value?.trim()) throw new Error(`${label} fehlt.`);
  return value;
};

const gateEnvironmentKeys: readonly Readonly<{
  gate: PromoteGateName;
  phase: PromotePhase;
  key: string;
  blockingKey?: string;
}>[] = [
  { gate: 'workspace-setup', phase: 'source-contract', key: 'PROMOTE_GATE_WORKSPACE_SETUP' },
  { gate: 'input-validation', phase: 'input-validation', key: 'PROMOTE_GATE_INPUT' },
  { gate: 'permission-snapshot-secret', phase: 'input-validation', key: 'PROMOTE_GATE_PERMISSION_SECRET' },
  { gate: 'source-preparation', phase: 'source-contract', key: 'PROMOTE_GATE_SOURCE_PREPARATION' },
  { gate: 'source-contract', phase: 'source-contract', key: 'PROMOTE_GATE_SOURCE' },
  { gate: 'registry-login', phase: 'image-contract', key: 'PROMOTE_GATE_REGISTRY_LOGIN' },
  { gate: 'image-contract', phase: 'image-contract', key: 'PROMOTE_GATE_IMAGE' },
  { gate: 'config-build', phase: 'config-build', key: 'PROMOTE_GATE_CONFIG_BUILD' },
  { gate: 'change-policy-evaluation', phase: 'static-preflight', key: 'PROMOTE_GATE_POLICY_EVALUATION' },
  { gate: 'migration-bootstrap-policy', phase: 'static-preflight', key: 'PROMOTE_GATE_STATIC_PREFLIGHT' },
  { gate: 'deployment-tooling', phase: 'deploy', key: 'PROMOTE_GATE_DEPLOYMENT_TOOLING' },
  { gate: 'target-resolution', phase: 'deploy', key: 'PROMOTE_GATE_TARGET' },
  { gate: 'readiness', phase: 'static-preflight', key: 'PROMOTE_GATE_READINESS' },
  { gate: 'previous-live-capture', phase: 'digest-verification', key: 'PROMOTE_GATE_PREVIOUS_LIVE' },
  { gate: 'candidate-preflight', phase: 'candidate-preflight', key: 'PROMOTE_GATE_CANDIDATE_PREFLIGHT', blockingKey: 'PROMOTE_GATE_CANDIDATE_PREFLIGHT_BLOCKING' },
  { gate: 'staging-parity', phase: 'staging-parity', key: 'PROMOTE_GATE_STAGING_PARITY' },
  { gate: 'backup-capabilities', phase: 'backup-capabilities', key: 'PROMOTE_GATE_BACKUP_CAPABILITIES', blockingKey: 'PROMOTE_GATE_BACKUP_CAPABILITIES_BLOCKING' },
  { gate: 'studio-backup-request', phase: 'backup', key: 'PROMOTE_GATE_BACKUP_REQUEST' },
  { gate: 'waste-backup-request', phase: 'backup', key: 'PROMOTE_GATE_WASTE_BACKUP_REQUEST' },
  { gate: 'temporary-backup', phase: 'backup', key: 'PROMOTE_GATE_BACKUP_FALLBACK' },
  { gate: 'studio-backup-verification', phase: 'backup', key: 'PROMOTE_GATE_BACKUP' },
  { gate: 'waste-backup-verification', phase: 'backup', key: 'PROMOTE_GATE_WASTE_BACKUP' },
  { gate: 'migration', phase: 'migration', key: 'PROMOTE_GATE_MIGRATION' },
  { gate: 'bootstrap', phase: 'bootstrap', key: 'PROMOTE_GATE_BOOTSTRAP' },
  { gate: 'postconditions', phase: 'postconditions', key: 'PROMOTE_GATE_POSTCONDITIONS' },
  { gate: 'deploy', phase: 'deploy', key: 'PROMOTE_GATE_DEPLOY' },
  { gate: 'runtime-smoke', phase: 'external-smoke', key: 'PROMOTE_GATE_EXTERNAL_SMOKE' },
  { gate: 'digest-verification', phase: 'digest-verification', key: 'PROMOTE_GATE_DIGEST_VERIFICATION' },
  { gate: 'staging-parity-evidence', phase: 'evidence', key: 'PROMOTE_GATE_STAGING_EVIDENCE' },
  { gate: 'staging-parity-upload', phase: 'evidence', key: 'PROMOTE_GATE_STAGING_EVIDENCE_UPLOAD' },
  { gate: 'one-shot-evidence-upload', phase: 'evidence', key: 'PROMOTE_GATE_ONE_SHOT_EVIDENCE_UPLOAD' },
  { gate: 'config-cleanup', phase: 'evidence', key: 'PROMOTE_GATE_CONFIG_CLEANUP' },
];

export const writePromoteEvidenceFromEnvironment = (
  env: NodeJS.ProcessEnv = process.env
): string => {
  const runnerTemp = required(env.RUNNER_TEMP, 'RUNNER_TEMP');
  const runId = required(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const attempt = Number(required(env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT'));
  const environment = normalizePromoteEnvironment(env.PROMOTE_ENVIRONMENT);
  const evidence = buildPromoteEvidence({
    runId,
    runAttempt: attempt,
    environment,
    status: normalizeWorkflowStatus(env.PROMOTE_JOB_STATUS),
    baseRef: normalizeWorkflowRef(env.PROMOTE_BASE_REF),
    headRef: normalizeWorkflowRef(env.PROMOTE_HEAD_REF),
    baseSha: env.PROMOTE_BASE_SHA,
    headSha: env.PROMOTE_HEAD_SHA,
    previousImage: env.PROMOTE_PREVIOUS_IMAGE,
    targetImage: env.PROMOTE_TARGET_IMAGE,
    imageRevision: env.PROMOTE_IMAGE_REVISION,
    configRevision: env.PROMOTE_CONFIG_REVISION,
    externalSecretReferences: parseJson<readonly string[]>(env.PROMOTE_SECRET_REFERENCES, []),
    backupAgent: parseJson<PromoteBackupAgentEvidence | null>(env.PROMOTE_BACKUP_AGENT, null),
    gates: gateEnvironmentKeys.map(({ gate, phase, key, blockingKey }) => ({
      gate,
      phase,
      status: normalizeGateStatus(env[key]),
      blocking: blockingKey ? env[blockingKey] === 'true' : true,
    })),
    recordedFailure: readRecordedFailure(env.PROMOTE_FAILURE_PATH),
  });
  const outputPath = resolve(runnerTemp, `promote-evidence-${runId}-${attempt}.json`);
  writePromoteEvidence(evidence, { outputPath, summaryPath: env.GITHUB_STEP_SUMMARY });
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `evidence_path=${outputPath}\n`, 'utf8');
  process.stdout.write(`Promote-Evidenz: ${relative(process.cwd(), outputPath)}\n`);
  return outputPath;
};
