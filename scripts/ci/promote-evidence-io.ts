import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import { buildPromoteEvidence, normalizeWorkflowRef } from './promote-evidence-contract.ts';
import type {
  PromoteBackupAgentEvidence,
  PromoteEvidence,
  PromoteEvidenceStatus,
  PromoteGateName,
  PromoteGateStatus,
} from './promote-evidence-types.ts';
import {
  normalizePromoteEnvironment,
  parsePromoteFailure,
  type PromoteFailure,
  type PromotePhase,
} from './promote-result.ts';

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
  return failure
    ? `::error title=${escapeWorkflowCommand(failure.code)}::${escapeWorkflowCommand(`${failure.summary} Nächster Schritt: ${failure.nextAction}`)}`
    : null;
};

type SummaryRow = readonly [string, string];

const buildRecoverySummaryRows = (evidence: PromoteEvidence): readonly SummaryRow[] => [
  ['promote_mode', evidence.mode],
  ['recovery_reason_provided', evidence.recoveryReasonProvided ? 'yes' : 'no'],
  ['previous_config_revision', evidence.config.previousRevision ?? 'not-captured'],
  ['rollback_image_digest', evidence.rollback?.imageDigest ?? 'not-ready'],
  ['rollback_config_revision', evidence.rollback?.configRevision ?? 'not-ready'],
  ['recovery_context_recorded', evidence.recovery ? 'yes' : 'no'],
  ['same_digest_retry', evidence.recovery?.sameDigestRetry?.authorization ?? 'not-applicable'],
  ['previous_failure_code', evidence.recovery?.sameDigestRetry?.previousFailureCode ?? 'none'],
];

export const renderPromoteSummary = (evidence: PromoteEvidence): string => {
  const rows: readonly SummaryRow[] = [
    ['status', evidence.status],
    ['environment', evidence.environment],
    ...buildRecoverySummaryRows(evidence),
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
    [
      'main_e2e_run',
      evidence.mainE2E
        ? `${evidence.mainE2E.run.id}/${evidence.mainE2E.run.attempt}`
        : 'not-evaluated',
    ],
    ['main_e2e_head_sha', evidence.mainE2E?.headSha ?? 'not-evaluated'],
    ['main_e2e_result', evidence.mainE2E?.result ?? 'not-evaluated'],
    ['main_e2e_test_outcome', evidence.mainE2E?.testOutcome ?? 'not-evaluated'],
    ['main_e2e_evidence_class', evidence.mainE2E?.evidenceClass ?? 'not-evaluated'],
    ['seed_preparation', 'none'],
    ['seed_evidence_run', 'none'],
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
      (gate) =>
        `| ${gate.gate} (${gate.phase}) | ${gate.status} | ${gate.blocking ? 'ja' : 'nein'} | ${gate.failure?.code ?? 'none'} |`
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

const parseJson = <T>(value: string | undefined, fallback: T): T =>
  value?.trim() ? (JSON.parse(value) as T) : fallback;
const parseMainE2EReference = (value: string | undefined): unknown => {
  if (!value?.trim()) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
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
  {
    gate: 'permission-snapshot-secret',
    phase: 'input-validation',
    key: 'PROMOTE_GATE_PERMISSION_SECRET',
  },
  {
    gate: 'worker-database-secret',
    phase: 'input-validation',
    key: 'PROMOTE_GATE_WORKER_DATABASE_SECRET',
  },
  { gate: 'source-preparation', phase: 'source-contract', key: 'PROMOTE_GATE_SOURCE_PREPARATION' },
  { gate: 'source-contract', phase: 'source-contract', key: 'PROMOTE_GATE_SOURCE' },
  { gate: 'deployment-base', phase: 'source-contract', key: 'PROMOTE_GATE_DEPLOYMENT_BASE' },
  { gate: 'registry-login', phase: 'image-contract', key: 'PROMOTE_GATE_REGISTRY_LOGIN' },
  { gate: 'image-contract', phase: 'image-contract', key: 'PROMOTE_GATE_IMAGE' },
  {
    gate: 'main-e2e-evidence',
    phase: 'main-e2e-evidence',
    key: 'PROMOTE_GATE_MAIN_E2E_EVIDENCE',
    blockingKey: 'PROMOTE_GATE_MAIN_E2E_EVIDENCE_BLOCKING',
  },
  { gate: 'config-build', phase: 'config-build', key: 'PROMOTE_GATE_CONFIG_BUILD' },
  {
    gate: 'config-revision-contract',
    phase: 'static-preflight',
    key: 'PROMOTE_GATE_CONFIG_REVISION_CONTRACT',
  },
  {
    gate: 'worker-database-secret-injection',
    phase: 'config-build',
    key: 'PROMOTE_GATE_WORKER_DATABASE_SECRET_INJECTION',
  },
  {
    gate: 'change-policy-evaluation',
    phase: 'static-preflight',
    key: 'PROMOTE_GATE_POLICY_EVALUATION',
  },
  {
    gate: 'migration-bootstrap-policy',
    phase: 'static-preflight',
    key: 'PROMOTE_GATE_STATIC_PREFLIGHT',
  },
  { gate: 'deployment-tooling', phase: 'deploy', key: 'PROMOTE_GATE_DEPLOYMENT_TOOLING' },
  { gate: 'target-resolution', phase: 'deploy', key: 'PROMOTE_GATE_TARGET' },
  { gate: 'readiness', phase: 'static-preflight', key: 'PROMOTE_GATE_READINESS' },
  {
    gate: 'previous-live-capture',
    phase: 'digest-verification',
    key: 'PROMOTE_GATE_PREVIOUS_LIVE',
  },
  {
    gate: 'promote-mode-validation',
    phase: 'static-preflight',
    key: 'PROMOTE_GATE_PROMOTE_MODE',
  },
  {
    gate: 'candidate-preflight',
    phase: 'candidate-preflight',
    key: 'PROMOTE_GATE_CANDIDATE_PREFLIGHT',
    blockingKey: 'PROMOTE_GATE_CANDIDATE_PREFLIGHT_BLOCKING',
  },
  { gate: 'staging-parity', phase: 'staging-parity', key: 'PROMOTE_GATE_STAGING_PARITY' },
  {
    gate: 'backup-capabilities',
    phase: 'backup-capabilities',
    key: 'PROMOTE_GATE_BACKUP_CAPABILITIES',
    blockingKey: 'PROMOTE_GATE_BACKUP_CAPABILITIES_BLOCKING',
  },
  { gate: 'studio-backup-request', phase: 'backup', key: 'PROMOTE_GATE_BACKUP_REQUEST' },
  { gate: 'waste-backup-request', phase: 'backup', key: 'PROMOTE_GATE_WASTE_BACKUP_REQUEST' },
  { gate: 'ssf-backup-request', phase: 'backup', key: 'PROMOTE_GATE_SSF_BACKUP_REQUEST' },
  { gate: 'studio-backup-verification', phase: 'backup', key: 'PROMOTE_GATE_BACKUP' },
  { gate: 'waste-backup-verification', phase: 'backup', key: 'PROMOTE_GATE_WASTE_BACKUP' },
  { gate: 'ssf-backup-verification', phase: 'backup', key: 'PROMOTE_GATE_SSF_BACKUP' },
  { gate: 'migration', phase: 'migration', key: 'PROMOTE_GATE_MIGRATION' },
  { gate: 'bootstrap', phase: 'bootstrap', key: 'PROMOTE_GATE_BOOTSTRAP' },
  { gate: 'postconditions', phase: 'postconditions', key: 'PROMOTE_GATE_POSTCONDITIONS' },
  { gate: 'deploy', phase: 'deploy', key: 'PROMOTE_GATE_DEPLOY' },
  {
    gate: 'swarm-convergence',
    phase: 'swarm-convergence',
    key: 'PROMOTE_GATE_SWARM_CONVERGENCE',
  },
  { gate: 'runtime-smoke', phase: 'external-smoke', key: 'PROMOTE_GATE_EXTERNAL_SMOKE' },
  {
    gate: 'digest-verification',
    phase: 'digest-verification',
    key: 'PROMOTE_GATE_DIGEST_VERIFICATION',
  },
  { gate: 'staging-parity-evidence', phase: 'evidence', key: 'PROMOTE_GATE_STAGING_EVIDENCE' },
  { gate: 'staging-parity-upload', phase: 'evidence', key: 'PROMOTE_GATE_STAGING_EVIDENCE_UPLOAD' },
  {
    gate: 'one-shot-evidence-upload',
    phase: 'evidence',
    key: 'PROMOTE_GATE_ONE_SHOT_EVIDENCE_UPLOAD',
  },
  { gate: 'config-cleanup', phase: 'evidence', key: 'PROMOTE_GATE_CONFIG_CLEANUP' },
];

export const writePromoteEvidenceFromEnvironment = (
  env: NodeJS.ProcessEnv = process.env
): string => {
  const runnerTemp = required(env.RUNNER_TEMP, 'RUNNER_TEMP');
  const runId = required(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const attempt = Number(required(env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT'));
  const evidence = buildPromoteEvidence({
    runId,
    runAttempt: attempt,
    environment: normalizePromoteEnvironment(env.PROMOTE_ENVIRONMENT),
    status: normalizeWorkflowStatus(env.PROMOTE_JOB_STATUS),
    promoteMode: env.PROMOTE_MODE,
    recoveryReasonProvided: env.PROMOTE_RECOVERY_REASON_PROVIDED,
    baseRef: normalizeWorkflowRef(env.PROMOTE_BASE_REF),
    headRef: normalizeWorkflowRef(env.PROMOTE_HEAD_REF),
    baseSha: env.PROMOTE_BASE_SHA,
    headSha: env.PROMOTE_HEAD_SHA,
    previousImage: env.PROMOTE_PREVIOUS_IMAGE,
    targetImage: env.PROMOTE_TARGET_IMAGE,
    imageRevision: env.PROMOTE_IMAGE_REVISION,
    configRevision: env.PROMOTE_CONFIG_REVISION,
    previousConfigRevision: env.PROMOTE_PREVIOUS_CONFIG_REVISION,
    externalSecretReferences: parseJson<readonly string[]>(env.PROMOTE_SECRET_REFERENCES, []),
    backupAgent: parseJson<PromoteBackupAgentEvidence | null>(env.PROMOTE_BACKUP_AGENT, null),
    mainE2EReference: parseMainE2EReference(env.PROMOTE_MAIN_E2E_REFERENCE),
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
