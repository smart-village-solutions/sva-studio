import { describe, expect, it } from 'vitest';

import { buildPromoteEvidence } from './promote-evidence-contract.ts';
import type { PromoteGateName, PromoteGateStatus } from './promote-evidence-types.ts';
import {
  validateProductionPreSeedEvidence,
  type ProductionLiveServiceSnapshot,
} from './production-live-config-seed-contract.ts';
import {
  validateProductionPrepareRequest,
  validateProductionSeedRequest,
} from './production-live-config-seed-context.ts';
import { verifyProductionLiveConfigSeedOverlay } from './production-live-config-seed-overlay.ts';
import {
  runProductionLiveConfigPrepare,
  verifyProductionLiveConfigPrepare,
} from './verify-production-live-config-prepare.ts';
import {
  runProductionLiveConfigSeed,
  selectProductionSeedArtifact,
  selectProductionSeedEvidenceJson,
  verifyProductionLiveConfigSeed,
  type ProductionLiveConfigSeedDependencies,
  type ProductionLiveConfigSeedInput,
} from './verify-production-live-config-seed.ts';

const sha = '8'.repeat(40);
const digest = `sha256:${'a'.repeat(64)}`;
const revision = 'b'.repeat(64);
const secretReferences = ['studio-app-config-v1'];

const prepareInput = {
  eventName: 'workflow_dispatch',
  environment: 'prod',
  promoteMode: 'standard',
  migrationMode: 'assert-none',
  bootstrapMode: 'assert-none',
  baseSha: sha,
  headSha: sha,
  targetDigest: digest,
  configRevision: revision,
  configBuilderMode: 'shadow',
  shadowEquivalent: 'true',
  mainE2EGateMode: 'shadow',
  candidateGateMode: 'shadow',
  backupCapabilityGateMode: 'shadow',
  backupExecutorMode: 'agent',
} as const;

const seedInput: ProductionLiveConfigSeedInput = {
  ...prepareInput,
  configBuilderMode: 'authoritative',
  mainE2EGateMode: 'enforce',
  candidateGateMode: 'enforce',
  backupCapabilityGateMode: 'enforce',
  runId: '41',
  runAttempt: '1',
  currentRunId: '42',
  currentRunNumber: '101',
  currentRunAttempt: '1',
  currentWorkflowSha: sha,
  secretReferences,
};

const passed = [
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
] as const;

const skipped = [
  ['main-e2e-evidence', 'main-e2e-evidence'],
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
] as const;

const gate = (
  [name, phase]: readonly [string, string],
  status: PromoteGateStatus,
  blocking = true
) => ({ gate: name as PromoteGateName, phase: phase as never, status, blocking });

const preparation = {
  contract: 'production-live-config-label-prepare-v1',
  sourceSha: sha,
  imageDigest: digest,
  configRevision: revision,
  liveConfigRevisionState: 'missing',
  backupExecutor: 'agent',
  shadowEquivalent: true,
} as const;

const evidence = () =>
  buildPromoteEvidence({
    runId: '41',
    runAttempt: 1,
    environment: 'prod',
    status: 'failed',
    promoteMode: 'standard',
    recoveryReasonProvided: false,
    baseRef: sha,
    headRef: sha,
    baseSha: sha,
    headSha: sha,
    previousImage: digest,
    targetImage: digest,
    imageRevision: sha,
    previousConfigRevision: null,
    configRevision: revision,
    externalSecretReferences: secretReferences,
    backupAgent: {
      agentRevision: 'c'.repeat(40),
      protocolVersions: [2],
      databaseTargets: ['studio'],
      resultFields: [
        'bytes',
        'database',
        'deployImageDigest',
        'environment',
        'objectKey',
        'requestId',
        'sha256',
        'status',
        'steps',
      ],
      wasteInventory: true,
    },
    seedPreparation: preparation,
    gates: [
      ...passed.map((entry) => gate(entry, 'passed')),
      gate(['backup-capabilities', 'backup-capabilities'], 'passed', false),
      gate(['candidate-preflight', 'candidate-preflight'], 'passed', false),
      gate(['production-config-seed-prepare-stop', 'static-preflight'], 'failed'),
      ...skipped.map((entry) => gate(entry, 'skipped')),
    ],
    recordedFailure: {
      code: 'PROMOTE_RECOVERY_CONTEXT_INVALID',
      environment: 'prod',
      phase: 'static-preflight',
      summary: 'Recovery-Kontext ist unvollständig oder nicht reproduzierbar.',
      retryable: false,
      nextAction: 'Recovery-Grund, vorherigen Digest und Config-Revision vollständig binden.',
    },
  });

const prepareRun = {
  id: 41,
  workflow_id: 9,
  run_attempt: 1,
  run_number: 100,
  path: '.github/workflows/promote.yml',
  event: 'workflow_dispatch',
  head_branch: 'main',
  head_sha: sha,
  status: 'completed',
  conclusion: 'failure',
} as const;

const currentRun = {
  id: 42,
  workflow_id: 9,
  run_attempt: 1,
  run_number: 101,
  path: '.github/workflows/promote.yml',
  event: 'workflow_dispatch',
  head_branch: 'main',
  head_sha: sha,
  status: 'in_progress',
  conclusion: null,
} as const;

const dependencies = (): ProductionLiveConfigSeedDependencies => ({
  readWorkflowRunAttempt: () => prepareRun,
  readCurrentWorkflowRun: () => prepareRun,
  readExecutingWorkflowRun: () => currentRun,
  readRunArtifacts: () => ({
    artifacts: [
      {
        id: 71,
        name: 'promote-evidence-41-1',
        expired: false,
        workflow_run: { id: 41, head_sha: sha },
      },
    ],
    total_count: 1,
  }),
  readArtifactArchive: () => ({
    entries: ['promote-evidence-41-1.json'],
    readText: () => JSON.stringify(evidence()),
  }),
  readLiveSnapshot: () => ({ image: digest, labels: {} }),
});

describe('Production live config label seed', () => {
  it('accepts only the explicit shadow preparation contract', () => {
    expect(() => validateProductionPrepareRequest(prepareInput)).not.toThrow();
    expect(() =>
      validateProductionPrepareRequest({ ...prepareInput, shadowEquivalent: 'false' })
    ).toThrow('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
    expect(() =>
      validateProductionPrepareRequest({ ...prepareInput, environment: 'staging' })
    ).toThrow('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it('requires authoritative enforce settings for the seed', () => {
    expect(() => validateProductionSeedRequest(seedInput)).not.toThrow();
    expect(() =>
      validateProductionSeedRequest({ ...seedInput, candidateGateMode: 'shadow' })
    ).toThrow('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it('attests only a missing same-digest Production label', () => {
    expect(verifyProductionLiveConfigPrepare(prepareInput, { image: digest, labels: {} })).toEqual(
      preparation
    );
    const valid: ProductionLiveServiceSnapshot = {
      image: digest,
      labels: { 'sva.config.revision': revision },
    };
    expect(() => verifyProductionLiveConfigPrepare(prepareInput, valid)).toThrow(
      'PROMOTE_LIVE_CONFIG_SEED_REJECTED'
    );
  });

  it('accepts only the exact failed shadow evidence contract', () => {
    expect(
      validateProductionPreSeedEvidence(evidence(), {
        runId: '41',
        runAttempt: 1,
        sourceSha: sha,
        imageDigest: digest,
        configRevision: revision,
        secretReferences,
      })
    ).toMatchObject({ authorization: 'production-legacy-config-label-v1' });
    expect(() =>
      validateProductionPreSeedEvidence(
        { ...evidence(), environment: 'staging' },
        {
          runId: '41',
          runAttempt: 1,
          sourceSha: sha,
          imageDigest: digest,
          configRevision: revision,
          secretReferences,
        }
      )
    ).toThrow('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
    expect(() =>
      validateProductionPreSeedEvidence(
        {
          ...evidence(),
          backupAgent: { ...evidence().backupAgent, resultFields: ['requestId'] },
        },
        {
          runId: '41',
          runAttempt: 1,
          sourceSha: sha,
          imageDigest: digest,
          configRevision: revision,
          secretReferences,
        }
      )
    ).toThrow('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it('binds the seed to the immediately preceding run, artifact and live snapshot', async () => {
    await expect(verifyProductionLiveConfigSeed(seedInput, dependencies())).resolves.toMatchObject({
      authorization: 'production-legacy-config-label-v1',
      evidenceRun: { id: '41', attempt: 1 },
    });
    const drift = dependencies();
    await expect(
      verifyProductionLiveConfigSeed(seedInput, {
        ...drift,
        readExecutingWorkflowRun: () => ({ ...currentRun, run_number: 102 }),
      })
    ).rejects.toThrow('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
    await expect(
      verifyProductionLiveConfigSeed(seedInput, {
        ...dependencies(),
        readWorkflowRunAttempt: () => ({ ...prepareRun, head_sha: 'f'.repeat(40) }),
      })
    ).rejects.toThrow('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it('rejects expired, ambiguous and malformed artifacts', async () => {
    expect(() =>
      selectProductionSeedArtifact(
        [
          {
            id: 71,
            name: 'promote-evidence-41-1',
            expired: true,
            workflow_run: { id: 41, head_sha: sha },
          },
        ],
        prepareRun
      )
    ).toThrow('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
    const artifact = dependencies().readRunArtifacts(41, 1).artifacts?.[0];
    if (!artifact) throw new Error('Testfixture enthält kein Artifact.');
    expect(() => selectProductionSeedArtifact([artifact, artifact], prepareRun)).toThrow(
      'PROMOTE_LIVE_CONFIG_SEED_REJECTED'
    );
    expect(() => selectProductionSeedEvidenceJson(['one.json', 'two.json'], '41', 1)).toThrow(
      'PROMOTE_LIVE_CONFIG_SEED_REJECTED'
    );
    const malformed = dependencies();
    await expect(
      verifyProductionLiveConfigSeed(seedInput, {
        ...malformed,
        readArtifactArchive: () => ({
          entries: ['promote-evidence-41-1.json'],
          readText: () => '{not-json',
        }),
      })
    ).rejects.toThrow('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it('keeps unexpected Prepare and Seed diagnostics static and redacted', async () => {
    const sentinel = 'person@example.test https://internal.example.test\nsecret=value';
    const prepareErrors: string[] = [];
    await expect(
      runProductionLiveConfigPrepare(
        {
          GITHUB_EVENT_NAME: prepareInput.eventName,
          PROMOTE_ENVIRONMENT: prepareInput.environment,
          PROMOTE_MODE: prepareInput.promoteMode,
          MIGRATION_MODE: prepareInput.migrationMode,
          BOOTSTRAP_MODE: prepareInput.bootstrapMode,
          BASE_SHA: prepareInput.baseSha,
          HEAD_SHA: prepareInput.headSha,
          TARGET_DIGEST: prepareInput.targetDigest,
          CONFIG_REVISION: prepareInput.configRevision,
          CONFIG_BUILDER_MODE: prepareInput.configBuilderMode,
          CONFIG_SHADOW_EQUIVALENT: prepareInput.shadowEquivalent,
          MAIN_E2E_GATE_MODE: prepareInput.mainE2EGateMode,
          CANDIDATE_GATE_MODE: prepareInput.candidateGateMode,
          BACKUP_CAPABILITY_GATE_MODE: prepareInput.backupCapabilityGateMode,
          BACKUP_EXECUTOR_MODE: prepareInput.backupExecutorMode,
        },
        { write: (value: string) => prepareErrors.push(String(value)) } as never,
        async () => {
          throw new Error(sentinel);
        }
      )
    ).resolves.toBeNull();
    expect(prepareErrors.join('')).toBe('PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED\n');

    const seedErrors: string[] = [];
    await expect(
      runProductionLiveConfigSeed(
        {
          GITHUB_EVENT_NAME: seedInput.eventName,
          PROMOTE_ENVIRONMENT: seedInput.environment,
          PROMOTE_MODE: seedInput.promoteMode,
          MIGRATION_MODE: seedInput.migrationMode,
          BOOTSTRAP_MODE: seedInput.bootstrapMode,
          BASE_SHA: seedInput.baseSha,
          HEAD_SHA: seedInput.headSha,
          TARGET_DIGEST: seedInput.targetDigest,
          CONFIG_REVISION: seedInput.configRevision,
          SEED_EVIDENCE_RUN_ID: seedInput.runId,
          SEED_EVIDENCE_RUN_ATTEMPT: seedInput.runAttempt,
          CONFIG_BUILDER_MODE: seedInput.configBuilderMode,
          MAIN_E2E_GATE_MODE: seedInput.mainE2EGateMode,
          CANDIDATE_GATE_MODE: seedInput.candidateGateMode,
          BACKUP_CAPABILITY_GATE_MODE: seedInput.backupCapabilityGateMode,
          BACKUP_EXECUTOR_MODE: seedInput.backupExecutorMode,
          GITHUB_RUN_ID: seedInput.currentRunId,
          GITHUB_RUN_NUMBER: seedInput.currentRunNumber,
          GITHUB_RUN_ATTEMPT: seedInput.currentRunAttempt,
          GITHUB_SHA: seedInput.currentWorkflowSha,
          GITHUB_REPOSITORY: 'smart-village-solutions/sva-studio',
          GITHUB_TOKEN: 'token',
          QUANTUM_ENDPOINT: 'production',
          SECRET_REFERENCES: JSON.stringify(seedInput.secretReferences),
        },
        { write: (value: string) => seedErrors.push(String(value)) } as never,
        () => {
          throw new Error(sentinel);
        }
      )
    ).resolves.toBeNull();
    expect(seedErrors.join('')).toBe('PROMOTE_INTERNAL_ERROR\n');
    expect(`${prepareErrors.join('')} ${seedErrors.join('')}`).not.toMatch(
      /person@example\.test|internal\.example\.test|secret=value/u
    );
  });

  it('allows the controller overlay to add only the config revision label', () => {
    const base = { services: { app: { deploy: { labels: { traefik: 'true' } } } } };
    const seeded = {
      services: {
        app: { deploy: { labels: { traefik: 'true', 'sva.config.revision': revision } } },
      },
    };
    expect(verifyProductionLiveConfigSeedOverlay(base, seeded, revision)).toEqual({
      label: 'sva.config.revision',
      revision,
    });
    expect(() =>
      verifyProductionLiveConfigSeedOverlay(
        base,
        { services: { app: { deploy: { labels: { 'sva.config.revision': revision } } } } },
        revision
      )
    ).toThrow('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });
});
