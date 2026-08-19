import {
  buildPromoteFailure,
  PromoteContractError,
  type PromoteErrorCode,
} from './promote-result.ts';
import { validatePreSeedPreparation } from './promote-evidence-seed-preparation.ts';

const digestPattern = /sha256:[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{64}$/u;
const shaPattern = /^[a-f0-9]{40}$/u;

export type LiveConfigRevisionState =
  | Readonly<{ status: 'missing' }>
  | Readonly<{ status: 'invalid' }>
  | Readonly<{ status: 'valid'; revision: string }>;

export type LiveServiceSnapshot = Readonly<{
  image?: string;
  labels?: Readonly<Record<string, string>>;
}>;

export type StagingLiveConfigSeedAuthorization = Readonly<{
  authorization: 'staging-legacy-config-label-v1';
  evidenceRun: Readonly<{ id: string; attempt: number }>;
  sourceSha: string;
  imageDigest: string;
  configRevision: string;
}>;

export const projectSeedAuthorization = (
  value: unknown,
  bindings: Readonly<{
    sourceSha: string | null;
    imageDigest: string | null;
    configRevision: string | null;
  }>
): StagingLiveConfigSeedAuthorization | null => {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) fail();
  const authorization = value as Record<string, unknown>;
  const evidenceRun = expectRecord(authorization.evidenceRun, ['id', 'attempt']);
  const valid =
    authorization.authorization === 'staging-legacy-config-label-v1' &&
    /^\d+$/u.test(typeof evidenceRun.id === 'string' ? evidenceRun.id : '') &&
    Number.isSafeInteger(evidenceRun.attempt) &&
    Number(evidenceRun.attempt) > 0 &&
    authorization.sourceSha === bindings.sourceSha &&
    authorization.imageDigest === bindings.imageDigest &&
    authorization.configRevision === bindings.configRevision;
  if (!valid) fail();
  return {
    authorization: 'staging-legacy-config-label-v1',
    evidenceRun: { id: evidenceRun.id as string, attempt: evidenceRun.attempt as number },
    sourceSha: authorization.sourceSha as string,
    imageDigest: authorization.imageDigest as string,
    configRevision: authorization.configRevision as string,
  };
};

type SeedBindings = Readonly<{
  runId: string;
  runAttempt: number;
  sourceSha: string;
  imageDigest: string;
  configRevision: string;
  secretReferences: readonly string[];
}>;

export { validatePrepareRequest, validateSeedRequest } from './staging-live-config-seed-context.ts';
export type {
  StagingLiveConfigPrepareRequest,
  StagingLiveConfigSeedRequest,
} from './staging-live-config-seed-context.ts';

const fail = (code: PromoteErrorCode = 'PROMOTE_LIVE_CONFIG_SEED_REJECTED'): never => {
  throw new PromoteContractError(
    buildPromoteFailure({ code, environment: 'staging', phase: 'static-preflight' })
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const expectRecord = (value: unknown, keys: readonly string[]): Record<string, unknown> => {
  if (!isRecord(value) || !hasExactKeys(value, keys)) fail();
  return value as Record<string, unknown>;
};

const normalizeDigest = (value: unknown): string => {
  const digest = typeof value === 'string' ? value.match(digestPattern)?.[0] : undefined;
  return digest ?? fail();
};

export const classifyLiveConfigRevision = (
  labels: Readonly<Record<string, string>> | undefined
): LiveConfigRevisionState => {
  if (!labels || !Object.hasOwn(labels, 'sva.config.revision')) return { status: 'missing' };
  const revision = labels['sva.config.revision'];
  return revisionPattern.test(revision ?? '')
    ? { status: 'valid', revision: revision as string }
    : { status: 'invalid' };
};

export const assertSeedableLiveSnapshot = (
  snapshot: LiveServiceSnapshot,
  expectedDigest: string
): Readonly<{ imageDigest: string; configRevisionState: Readonly<{ status: 'missing' }> }> => {
  const imageDigest = normalizeDigest(snapshot.image);
  const configRevisionState = classifyLiveConfigRevision(snapshot.labels);
  if (imageDigest !== expectedDigest || configRevisionState.status !== 'missing') fail();
  return { imageDigest, configRevisionState: { status: 'missing' } };
};

const expectedGateStates = new Map<string, Readonly<{ phase: string; status: string }>>([
  ...[
    ['workspace-setup', 'source-contract'],
    ['input-validation', 'input-validation'],
    ['permission-snapshot-secret', 'input-validation'],
    ['worker-database-secret', 'input-validation'],
    ['source-preparation', 'source-contract'],
    ['source-contract', 'source-contract'],
    ['registry-login', 'image-contract'],
    ['image-contract', 'image-contract'],
    ['main-e2e-evidence', 'main-e2e-evidence'],
    ['config-build', 'config-build'],
    ['config-revision-contract', 'static-preflight'],
    ['worker-database-secret-injection', 'config-build'],
    ['deployment-tooling', 'deploy'],
    ['target-resolution', 'deploy'],
    ['readiness', 'static-preflight'],
    ['previous-live-capture', 'digest-verification'],
    ['legacy-config-seed-preparation', 'static-preflight'],
    ['one-shot-evidence-upload', 'evidence'],
    ['config-cleanup', 'evidence'],
  ].map(([gate, phase]) => [gate, { phase, status: 'passed' }] as const),
  ['recovery-contract', { phase: 'static-preflight', status: 'failed' }],
  ...[
    ['legacy-config-seed', 'static-preflight'],
    ['deployment-base', 'source-contract'],
    ['change-policy-evaluation', 'static-preflight'],
    ['migration-bootstrap-policy', 'static-preflight'],
    ['candidate-preflight', 'candidate-preflight'],
    ['staging-parity', 'staging-parity'],
    ['backup-capabilities', 'backup-capabilities'],
    ['studio-backup-request', 'backup'],
    ['waste-backup-request', 'backup'],
    ['temporary-backup', 'backup'],
    ['studio-backup-verification', 'backup'],
    ['waste-backup-verification', 'backup'],
    ['migration', 'migration'],
    ['bootstrap', 'bootstrap'],
    ['postconditions', 'postconditions'],
    ['legacy-config-seed-recheck', 'static-preflight'],
    ['production-config-seed-preparation', 'static-preflight'],
    ['production-config-seed', 'static-preflight'],
    ['production-config-seed-prepare-stop', 'static-preflight'],
    ['production-config-seed-recheck', 'static-preflight'],
    ['deploy', 'deploy'],
    ['swarm-convergence', 'swarm-convergence'],
    ['runtime-smoke', 'external-smoke'],
    ['digest-verification', 'digest-verification'],
    ['staging-parity-evidence', 'evidence'],
    ['staging-parity-upload', 'evidence'],
  ].map(([gate, phase]) => [gate, { phase, status: 'skipped' }] as const),
]);

const canonicalRecoveryFailure = buildPromoteFailure({
  code: 'PROMOTE_RECOVERY_CONTEXT_INVALID',
  environment: 'staging',
  phase: 'static-preflight',
});

const matchesFailure = (value: unknown): boolean => {
  const failure = expectRecord(value, [
    'code',
    'environment',
    'phase',
    'summary',
    'retryable',
    'nextAction',
  ]);
  return Object.entries(canonicalRecoveryFailure).every(
    ([key, expected]) => failure[key] === expected
  );
};

const validateGates = (value: unknown): void => {
  if (!Array.isArray(value)) fail();
  const gates = value as unknown[];
  if (gates.length !== expectedGateStates.size) fail();
  const seen = new Set<string>();
  for (const rawGate of gates) {
    if (!isRecord(rawGate)) fail();
    const gate = rawGate as Record<string, unknown>;
    if (typeof gate.gate !== 'string') fail();
    const gateName = gate.gate as string;
    if (seen.has(gateName)) fail();
    const expected = expectedGateStates.get(gateName);
    if (!expected) fail();
    const gateState = expected as Readonly<{ phase: string; status: string }>;
    const keys =
      gateState.status === 'failed'
        ? ['gate', 'phase', 'status', 'blocking', 'failure']
        : ['gate', 'phase', 'status', 'blocking'];
    if (!hasExactKeys(gate, keys)) fail();
    if (
      gate.phase !== gateState.phase ||
      gate.status !== gateState.status ||
      gate.blocking !== true
    )
      fail();
    if (gateState.status === 'failed' && !matchesFailure(gate.failure)) fail();
    seen.add(gateName);
  }
};

const validateMainE2E = (value: unknown, sourceSha: string): void => {
  const evidence = expectRecord(value, [
    'run',
    'headSha',
    'result',
    'testOutcome',
    'evidenceClass',
  ]);
  const run = expectRecord(evidence.run, ['id', 'attempt']);
  const valid =
    /^\d+$/u.test(typeof run.id === 'string' ? run.id : '') &&
    Number.isSafeInteger(run.attempt) &&
    Number(run.attempt) > 0 &&
    evidence.headSha === sourceSha &&
    evidence.result === 'success' &&
    evidence.testOutcome === 'success' &&
    evidence.evidenceClass === 'canonical-main';
  if (!valid) fail();
};

const matchesStringArray = (value: unknown, expected: readonly string[]): boolean =>
  Array.isArray(value) &&
  value.every((entry) => typeof entry === 'string') &&
  JSON.stringify([...value].sort()) === JSON.stringify([...expected].sort());

export const validatePreSeedEvidence = (
  value: unknown,
  bindings: SeedBindings
): StagingLiveConfigSeedAuthorization => {
  const evidence = expectRecord(value, [
    'schemaVersion',
    'run',
    'environment',
    'status',
    'mode',
    'recoveryReasonProvided',
    'git',
    'image',
    'config',
    'backupAgent',
    'mainE2E',
    'rollback',
    'recovery',
    'seedPreparation',
    'seedAuthorization',
    'gates',
    'terminalFailure',
  ]);
  const run = expectRecord(evidence.run, ['id', 'attempt']);
  const git = expectRecord(evidence.git, ['baseRef', 'headRef', 'baseSha', 'headSha']);
  const image = expectRecord(evidence.image, ['previousDigest', 'targetDigest', 'revision']);
  const config = expectRecord(evidence.config, [
    'previousRevision',
    'revision',
    'externalSecretReferences',
  ]);
  const valid =
    evidence.schemaVersion === 2 &&
    evidence.environment === 'staging' &&
    evidence.status === 'failed' &&
    evidence.mode === 'standard' &&
    evidence.recoveryReasonProvided === false &&
    run.id === bindings.runId &&
    run.attempt === bindings.runAttempt &&
    Object.values(git).every((entry) => entry === bindings.sourceSha) &&
    image.previousDigest === bindings.imageDigest &&
    image.targetDigest === bindings.imageDigest &&
    image.revision === bindings.sourceSha &&
    config.previousRevision === null &&
    config.revision === bindings.configRevision &&
    matchesStringArray(config.externalSecretReferences, bindings.secretReferences) &&
    evidence.backupAgent === null &&
    evidence.rollback === null &&
    evidence.recovery === null &&
    evidence.seedAuthorization === null &&
    matchesFailure(evidence.terminalFailure);
  if (!valid) fail();
  validatePreSeedPreparation(evidence.seedPreparation, {
    sourceSha: bindings.sourceSha,
    imageDigest: bindings.imageDigest,
    configRevision: bindings.configRevision,
  });
  validateMainE2E(evidence.mainE2E, bindings.sourceSha);
  validateGates(evidence.gates);
  return {
    authorization: 'staging-legacy-config-label-v1',
    evidenceRun: { id: bindings.runId, attempt: bindings.runAttempt },
    sourceSha: bindings.sourceSha,
    imageDigest: bindings.imageDigest,
    configRevision: bindings.configRevision,
  };
};
