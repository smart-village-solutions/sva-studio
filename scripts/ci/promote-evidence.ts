import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import {
  buildPromoteFailure,
  parsePromoteFailure,
  type PromoteEnvironment,
  type PromoteFailure,
  type PromotePhase,
} from './promote-result.ts';

export type PromoteGateStatus = 'passed' | 'failed' | 'cancelled' | 'skipped';
export type PromoteEvidenceStatus = 'passed' | 'failed' | 'cancelled';

export type PromoteGateEvidence = Readonly<{
  phase: PromotePhase;
  status: PromoteGateStatus;
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
  git: Readonly<{ baseSha: string; headSha: string }>;
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
  baseSha: string;
  headSha: string;
  previousImage?: string | null;
  targetImage?: string | null;
  imageRevision?: string | null;
  configRevision?: string | null;
  externalSecretReferences?: readonly string[];
  backupAgent?: PromoteBackupAgentEvidence | null;
  gates: readonly Readonly<{ phase: PromotePhase; status: PromoteGateStatus }>[];
  recordedFailure?: PromoteFailure | null;
}>;

const shaPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const digestPattern = /sha256:[0-9a-f]{64}/u;
const revisionPattern = /^[0-9a-f]{64}$/u;
const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const safeReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/u;
const gateStatuses: readonly PromoteGateStatus[] = ['passed', 'failed', 'cancelled', 'skipped'];

const assertSafeIdentifier = (value: string, label: string): string => {
  if (!safeIdentifierPattern.test(value))
    throw new Error(`${label} verletzt den redigierten Evidenzvertrag.`);
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
    agentRevision: assertSafeIdentifier(value.agentRevision, 'Agent-Revision'),
    protocolVersions: [...value.protocolVersions].sort((left, right) => left - right),
    databaseTargets: [
      ...new Set(
        value.databaseTargets.map((target) => assertSafeIdentifier(target, 'Datenbankziel'))
      ),
    ].sort(),
    resultFields: [
      ...new Set(value.resultFields.map((field) => assertSafeIdentifier(field, 'Ergebnisfeld'))),
    ].sort(),
    wasteInventory: value.wasteInventory === true,
  };
};

export const buildPromoteEvidence = (input: BuildPromoteEvidenceInput): PromoteEvidence => {
  if (!Number.isSafeInteger(input.runAttempt) || input.runAttempt < 1)
    throw new Error('Run-Attempt ist ungültig.');
  const gates = input.gates.map((gate): PromoteGateEvidence => {
    if (!gateStatuses.includes(gate.status)) throw new Error('Gate-Status ist ungültig.');
    return { phase: gate.phase, status: gate.status };
  });
  const firstFailedPhase = gates.find(
    (gate) => gate.status === 'failed' || gate.status === 'cancelled'
  )?.phase;
  const recordedFailure =
    input.recordedFailure &&
    input.recordedFailure.environment === input.environment &&
    (!firstFailedPhase || input.recordedFailure.phase === firstFailedPhase)
      ? input.recordedFailure
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
    (gate.status === 'failed' || gate.status === 'cancelled')
      ? { ...gate, failure: terminalFailure }
      : gate
  );

  return {
    schemaVersion: 1,
    run: { id: assertSafeIdentifier(input.runId, 'Run-ID'), attempt: input.runAttempt },
    environment: input.environment,
    status: input.status,
    git: {
      baseSha: assertSha(input.baseSha, 'Base-SHA'),
      headSha: assertSha(input.headSha, 'Head-SHA'),
    },
    image: {
      previousDigest: normalizeDigest(input.previousImage),
      targetDigest: normalizeDigest(input.targetImage),
      revision: input.imageRevision?.trim()
        ? assertSafeIdentifier(input.imageRevision, 'Image-Revision')
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
    ['base_sha', evidence.git.baseSha],
    ['head_sha', evidence.git.headSha],
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
    '| Phase | Status | Fehlercode |',
    '| --- | --- | --- |',
    ...evidence.gates.map(
      (gate) => `| ${gate.phase} | ${gate.status} | ${gate.failure?.code ?? 'none'} |`
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

const gateEnvironmentKeys: readonly Readonly<{ phase: PromotePhase; key: string }>[] = [
  { phase: 'config-build', key: 'PROMOTE_GATE_CONFIG_BUILD' },
  { phase: 'static-preflight', key: 'PROMOTE_GATE_STATIC_PREFLIGHT' },
  { phase: 'static-preflight', key: 'PROMOTE_GATE_READINESS' },
  { phase: 'candidate-preflight', key: 'PROMOTE_GATE_CANDIDATE_PREFLIGHT' },
  { phase: 'staging-parity', key: 'PROMOTE_GATE_STAGING_PARITY' },
  { phase: 'backup-capabilities', key: 'PROMOTE_GATE_BACKUP_CAPABILITIES' },
  { phase: 'backup', key: 'PROMOTE_GATE_BACKUP_REQUEST' },
  { phase: 'backup', key: 'PROMOTE_GATE_BACKUP_FALLBACK' },
  { phase: 'backup', key: 'PROMOTE_GATE_BACKUP' },
  { phase: 'migration', key: 'PROMOTE_GATE_MIGRATION' },
  { phase: 'bootstrap', key: 'PROMOTE_GATE_BOOTSTRAP' },
  { phase: 'deploy', key: 'PROMOTE_GATE_DEPLOY' },
  { phase: 'external-smoke', key: 'PROMOTE_GATE_EXTERNAL_SMOKE' },
  { phase: 'digest-verification', key: 'PROMOTE_GATE_DIGEST_VERIFICATION' },
];

export const writePromoteEvidenceFromEnvironment = (
  env: NodeJS.ProcessEnv = process.env
): string => {
  const runnerTemp = required(env.RUNNER_TEMP, 'RUNNER_TEMP');
  const runId = required(env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const attempt = Number(required(env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT'));
  const environment = required(
    env.PROMOTE_ENVIRONMENT,
    'PROMOTE_ENVIRONMENT'
  ) as PromoteEnvironment;
  if (!['dev', 'staging', 'prod'].includes(environment))
    throw new Error('PROMOTE_ENVIRONMENT ist ungültig.');
  const evidence = buildPromoteEvidence({
    runId,
    runAttempt: attempt,
    environment,
    status: normalizeWorkflowStatus(env.PROMOTE_JOB_STATUS),
    baseSha: required(env.PROMOTE_BASE_SHA, 'PROMOTE_BASE_SHA'),
    headSha: required(env.PROMOTE_HEAD_SHA, 'PROMOTE_HEAD_SHA'),
    previousImage: env.PROMOTE_PREVIOUS_IMAGE,
    targetImage: env.PROMOTE_TARGET_IMAGE,
    imageRevision: env.PROMOTE_IMAGE_REVISION,
    configRevision: env.PROMOTE_CONFIG_REVISION,
    externalSecretReferences: parseJson<readonly string[]>(env.PROMOTE_SECRET_REFERENCES, []),
    backupAgent: parseJson<PromoteBackupAgentEvidence | null>(env.PROMOTE_BACKUP_AGENT, null),
    gates: gateEnvironmentKeys.map(({ phase, key }) => ({
      phase,
      status: normalizeGateStatus(env[key]),
    })),
    recordedFailure: readRecordedFailure(env.PROMOTE_FAILURE_PATH),
  });
  const outputPath = resolve(runnerTemp, `promote-evidence-${runId}-${attempt}.json`);
  writePromoteEvidence(evidence, { outputPath, summaryPath: env.GITHUB_STEP_SUMMARY });
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `evidence_path=${outputPath}\n`, 'utf8');
  process.stdout.write(`Promote-Evidenz: ${relative(process.cwd(), outputPath)}\n`);
  return outputPath;
};
