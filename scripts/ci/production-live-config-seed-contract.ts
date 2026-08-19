import {
  buildPromoteFailure,
  PromoteContractError,
  type PromoteErrorCode,
} from './promote-result.ts';
import { validateProductionSeedPreparation } from './promote-evidence-seed-preparation.ts';
import { matchesProductionSeedBackupAgent } from './production-live-config-seed-agent.ts';

const digestPattern = /sha256:[a-f0-9]{64}$/u;
const revisionPattern = /^[a-f0-9]{64}$/u;

export type ProductionLiveServiceSnapshot = Readonly<{
  image?: string;
  labels?: Readonly<Record<string, string>>;
}>;

export type ProductionLiveConfigSeedAuthorization = Readonly<{
  authorization: 'production-legacy-config-label-v1';
  evidenceRun: Readonly<{ id: string; attempt: number }>;
  sourceSha: string;
  imageDigest: string;
  configRevision: string;
}>;

type Bindings = Readonly<{
  runId: string;
  runAttempt: number;
  sourceSha: string;
  imageDigest: string;
  configRevision: string;
  secretReferences: readonly string[];
}>;

const fail = (code: PromoteErrorCode = 'PROMOTE_LIVE_CONFIG_SEED_REJECTED'): never => {
  throw new PromoteContractError(
    buildPromoteFailure({ code, environment: 'prod', phase: 'static-preflight' })
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

export const assertSeedableProductionLiveSnapshot = (
  snapshot: ProductionLiveServiceSnapshot,
  expectedDigest: string
): void => {
  const digest =
    typeof snapshot.image === 'string' ? snapshot.image.match(digestPattern)?.[0] : null;
  const labels = snapshot.labels;
  if (digest !== expectedDigest || (labels && Object.hasOwn(labels, 'sva.config.revision'))) fail();
};

export const projectProductionSeedAuthorization = (
  value: unknown,
  bindings: Readonly<{
    sourceSha: string | null;
    imageDigest: string | null;
    configRevision: string | null;
  }>
): ProductionLiveConfigSeedAuthorization | null => {
  if (value === null || value === undefined) return null;
  const candidate = expectRecord(value, [
    'authorization',
    'evidenceRun',
    'sourceSha',
    'imageDigest',
    'configRevision',
  ]);
  const run = expectRecord(candidate.evidenceRun, ['id', 'attempt']);
  const valid =
    candidate.authorization === 'production-legacy-config-label-v1' &&
    /^\d+$/u.test(typeof run.id === 'string' ? run.id : '') &&
    Number.isSafeInteger(run.attempt) &&
    Number(run.attempt) > 0 &&
    candidate.sourceSha === bindings.sourceSha &&
    candidate.imageDigest === bindings.imageDigest &&
    candidate.configRevision === bindings.configRevision;
  if (!valid) fail();
  return {
    authorization: 'production-legacy-config-label-v1',
    evidenceRun: { id: run.id as string, attempt: run.attempt as number },
    sourceSha: candidate.sourceSha as string,
    imageDigest: candidate.imageDigest as string,
    configRevision: candidate.configRevision as string,
  };
};

const expectedGateStates = new Map<
  string,
  Readonly<{ phase: string; status: string; blocking: boolean }>
>([
  ...[
    ['workspace-setup', 'source-contract'],
    ['input-validation', 'input-validation'],
    ['permission-snapshot-secret', 'input-validation'],
    ['worker-database-secret', 'input-validation'],
    ['source-preparation', 'source-contract'],
    ['source-contract', 'source-contract'],
    ['registry-login', 'image-contract'],
    ['image-contract', 'image-contract'],
    ['config-build', 'config-build'],
    ['config-revision-contract', 'static-preflight'],
    ['worker-database-secret-injection', 'config-build'],
    ['deployment-tooling', 'deploy'],
    ['target-resolution', 'deploy'],
    ['readiness', 'static-preflight'],
    ['previous-live-capture', 'digest-verification'],
    ['production-config-seed-preparation', 'static-preflight'],
    ['recovery-contract', 'static-preflight'],
    ['deployment-base', 'source-contract'],
    ['change-policy-evaluation', 'static-preflight'],
    ['migration-bootstrap-policy', 'static-preflight'],
    ['staging-parity', 'staging-parity'],
    ['one-shot-evidence-upload', 'evidence'],
    ['config-cleanup', 'evidence'],
  ].map(([gate, phase]) => [gate, { phase, status: 'passed', blocking: true }] as const),
  ['backup-capabilities', { phase: 'backup-capabilities', status: 'passed', blocking: false }],
  ['candidate-preflight', { phase: 'candidate-preflight', status: 'passed', blocking: false }],
  ['main-e2e-evidence', { phase: 'main-e2e-evidence', status: 'skipped', blocking: false }],
  [
    'production-config-seed-prepare-stop',
    { phase: 'static-preflight', status: 'failed', blocking: true },
  ],
  ...[
    ['legacy-config-seed-preparation', 'static-preflight'],
    ['legacy-config-seed', 'static-preflight'],
    ['legacy-config-seed-recheck', 'static-preflight'],
    ['production-config-seed', 'static-preflight'],
    ['production-config-seed-recheck', 'static-preflight'],
    ['studio-backup-request', 'backup'],
    ['waste-backup-request', 'backup'],
    ['temporary-backup', 'backup'],
    ['studio-backup-verification', 'backup'],
    ['waste-backup-verification', 'backup'],
    ['migration', 'migration'],
    ['bootstrap', 'bootstrap'],
    ['postconditions', 'postconditions'],
    ['deploy', 'deploy'],
    ['swarm-convergence', 'swarm-convergence'],
    ['runtime-smoke', 'external-smoke'],
    ['digest-verification', 'digest-verification'],
    ['staging-parity-evidence', 'evidence'],
    ['staging-parity-upload', 'evidence'],
  ].map(([gate, phase]) => [gate, { phase, status: 'skipped', blocking: true }] as const),
]);

const terminalFailure = buildPromoteFailure({
  code: 'PROMOTE_RECOVERY_CONTEXT_INVALID',
  environment: 'prod',
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
  return Object.entries(terminalFailure).every(([key, expected]) => failure[key] === expected);
};

const validateGates = (value: unknown): void => {
  if (!Array.isArray(value)) return fail();
  const gates = value as unknown[];
  if (gates.length !== expectedGateStates.size) return fail();
  const seen = new Set<string>();
  for (const raw of gates) {
    if (!isRecord(raw)) fail();
    const gate = raw as Record<string, unknown>;
    if (typeof gate.gate !== 'string' || seen.has(gate.gate)) fail();
    const gateName = gate.gate as string;
    const expected = expectedGateStates.get(gateName) ?? fail();
    const keys =
      expected.status === 'failed'
        ? ['gate', 'phase', 'status', 'blocking', 'failure']
        : ['gate', 'phase', 'status', 'blocking'];
    if (
      !hasExactKeys(gate, keys) ||
      gate.phase !== expected.phase ||
      gate.status !== expected.status ||
      gate.blocking !== expected.blocking
    )
      fail();
    if (expected.status === 'failed' && !matchesFailure(gate.failure)) fail();
    seen.add(gateName);
  }
};

const sameStrings = (value: unknown, expected: readonly string[]): boolean =>
  Array.isArray(value) &&
  value.every((entry) => typeof entry === 'string') &&
  JSON.stringify([...value].sort()) === JSON.stringify([...expected].sort());

const matchesPreSeedIdentity = (
  evidence: Record<string, unknown>,
  run: Record<string, unknown>,
  git: Record<string, unknown>,
  image: Record<string, unknown>,
  config: Record<string, unknown>,
  bindings: Bindings
): boolean =>
  evidence.schemaVersion === 2 &&
  evidence.environment === 'prod' &&
  evidence.status === 'failed' &&
  evidence.mode === 'standard' &&
  evidence.recoveryReasonProvided === false &&
  run.id === bindings.runId &&
  run.attempt === bindings.runAttempt &&
  Object.values(git).every((entry) => entry === bindings.sourceSha) &&
  image.previousDigest === bindings.imageDigest &&
  image.targetDigest === bindings.imageDigest &&
  image.revision === bindings.imageDigest &&
  config.previousRevision === null &&
  config.revision === bindings.configRevision;

const matchesPreSeedAttachments = (
  evidence: Record<string, unknown>,
  config: Record<string, unknown>,
  bindings: Bindings
): boolean =>
  sameStrings(config.externalSecretReferences, bindings.secretReferences) &&
  matchesProductionSeedBackupAgent(evidence.backupAgent) &&
  evidence.mainE2E === null &&
  evidence.rollback === null &&
  evidence.recovery === null &&
  evidence.seedAuthorization === null &&
  matchesFailure(evidence.terminalFailure);

export const validateProductionPreSeedEvidence = (
  value: unknown,
  bindings: Bindings
): ProductionLiveConfigSeedAuthorization => {
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
    matchesPreSeedIdentity(evidence, run, git, image, config, bindings) &&
    matchesPreSeedAttachments(evidence, config, bindings);
  if (!valid) fail();
  validateProductionSeedPreparation(evidence.seedPreparation, {
    sourceSha: bindings.sourceSha,
    imageDigest: bindings.imageDigest,
    configRevision: bindings.configRevision,
  });
  validateGates(evidence.gates);
  return {
    authorization: 'production-legacy-config-label-v1',
    evidenceRun: { id: bindings.runId, attempt: bindings.runAttempt },
    sourceSha: bindings.sourceSha,
    imageDigest: bindings.imageDigest,
    configRevision: bindings.configRevision,
  };
};
