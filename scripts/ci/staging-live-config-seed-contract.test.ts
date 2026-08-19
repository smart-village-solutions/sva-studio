import { describe, expect, it, vi } from 'vitest';

import { buildPromoteFailure, PromoteContractError } from './promote-result.ts';
import {
  assertSeedableLiveSnapshot,
  classifyLiveConfigRevision,
  validatePreSeedEvidence,
  validatePrepareRequest,
  validateSeedRequest,
  type LiveServiceSnapshot,
} from './staging-live-config-seed-contract.ts';
import {
  stagingLiveConfigSeedArtifactsPath,
  stagingLiveConfigSeedRunPath,
} from './staging-live-config-seed-io.ts';
import {
  runStagingLiveConfigPrepare,
  verifyStagingLiveConfigPrepare,
} from './verify-staging-live-config-prepare.ts';
import {
  selectSeedArtifact,
  selectSeedEvidenceJson,
  verifyStagingLiveConfigSeed,
  type StagingLiveConfigSeedDependencies,
  type StagingLiveConfigSeedWorkflowRun,
} from './verify-staging-live-config-seed.ts';

const sourceSha = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;
const configRevision = 'c'.repeat(64);
const secretReferences = ['studio_staging_waste_database_provisioner_password_v1'];
const runId = '123456';
const runAttempt = 1;

const passedGates = [
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
] as const;
const skippedGates = [
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
  ['deploy', 'deploy'],
  ['swarm-convergence', 'swarm-convergence'],
  ['runtime-smoke', 'external-smoke'],
  ['digest-verification', 'digest-verification'],
  ['staging-parity-evidence', 'evidence'],
  ['staging-parity-upload', 'evidence'],
] as const;

const recoveryFailure = buildPromoteFailure({
  code: 'PROMOTE_RECOVERY_CONTEXT_INVALID',
  environment: 'staging',
  phase: 'static-preflight',
});

const preSeedEvidence = () => ({
  schemaVersion: 2,
  run: { id: runId, attempt: runAttempt },
  environment: 'staging',
  status: 'failed',
  mode: 'standard',
  recoveryReasonProvided: false,
  git: { baseRef: sourceSha, headRef: sourceSha, baseSha: sourceSha, headSha: sourceSha },
  image: { previousDigest: digest, targetDigest: digest, revision: sourceSha },
  config: {
    previousRevision: null,
    revision: configRevision,
    externalSecretReferences: secretReferences,
  },
  backupAgent: null,
  mainE2E: {
    run: { id: '654321', attempt: 1 },
    headSha: sourceSha,
    result: 'success',
    testOutcome: 'success',
    evidenceClass: 'canonical-main',
  },
  rollback: null,
  recovery: null,
  seedPreparation: {
    contract: 'staging-live-config-label-prepare-v1',
    sourceSha,
    imageDigest: digest,
    configRevision,
    liveConfigRevisionState: 'missing',
    backupExecutor: 'agent',
  },
  seedAuthorization: null,
  gates: [
    ...passedGates.map(([gate, phase]) => ({ gate, phase, status: 'passed', blocking: true })),
    {
      gate: 'recovery-contract',
      phase: 'static-preflight',
      status: 'failed',
      blocking: true,
      failure: recoveryFailure,
    },
    ...skippedGates.map(([gate, phase]) => ({ gate, phase, status: 'skipped', blocking: true })),
  ],
  terminalFailure: recoveryFailure,
});

const bindings = {
  runId,
  runAttempt,
  sourceSha,
  imageDigest: digest,
  configRevision,
  secretReferences,
};

const failureCode = (operation: () => unknown): string => {
  try {
    operation();
    return 'none';
  } catch (error) {
    expect(error).toBeInstanceOf(PromoteContractError);
    return (error as PromoteContractError).failure.code;
  }
};

const asyncFailureCode = async (operation: () => Promise<unknown>): Promise<string> => {
  try {
    await operation();
    return 'none';
  } catch (error) {
    expect(error).toBeInstanceOf(PromoteContractError);
    return (error as PromoteContractError).failure.code;
  }
};

describe('staging live config seed contract', () => {
  it('classifies only an absent label as missing without exposing invalid content', () => {
    expect(classifyLiveConfigRevision(undefined)).toEqual({ status: 'missing' });
    expect(classifyLiveConfigRevision({})).toEqual({ status: 'missing' });
    expect(classifyLiveConfigRevision({ 'sva.config.revision': configRevision })).toEqual({
      status: 'valid',
      revision: configRevision,
    });
    expect(
      classifyLiveConfigRevision({
        'sva.config.revision': 'person@example.test https://internal.example.test',
      })
    ).toEqual({ status: 'invalid' });
  });

  it('accepts only a missing label on the exact current digest', () => {
    expect(
      assertSeedableLiveSnapshot({ image: `registry.example/studio@${digest}`, labels: {} }, digest)
    ).toEqual({ imageDigest: digest, configRevisionState: { status: 'missing' } });
    expect(
      failureCode(() =>
        assertSeedableLiveSnapshot(
          {
            image: `registry.example/studio@${digest}`,
            labels: { 'sva.config.revision': configRevision },
          },
          digest
        )
      )
    ).toBe('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
    expect(
      failureCode(() =>
        assertSeedableLiveSnapshot(
          { image: `registry.example/studio@${digest}`, labels: { 'sva.config.revision': 'bad' } },
          digest
        )
      )
    ).toBe('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
    expect(
      failureCode(() =>
        assertSeedableLiveSnapshot(
          { image: `registry.example/studio@sha256:${'d'.repeat(64)}`, labels: {} },
          digest
        )
      )
    ).toBe('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it('accepts only the explicitly protected dispatch seed context', () => {
    expect(() =>
      validateSeedRequest({
        eventName: 'workflow_dispatch',
        environment: 'staging',
        promoteMode: 'standard',
        migrationMode: 'assert-none',
        bootstrapMode: 'assert-none',
        baseSha: sourceSha,
        headSha: sourceSha,
        targetDigest: digest,
        configRevision,
        runId,
        runAttempt: String(runAttempt),
        configBuilderMode: 'authoritative',
        mainE2EGateMode: 'enforce',
        candidateGateMode: 'enforce',
        backupCapabilityGateMode: 'enforce',
        backupExecutorMode: 'agent',
        currentRunId: '999',
        currentRunNumber: '44',
        currentRunAttempt: '1',
        currentWorkflowSha: workflowHeadSha,
      })
    ).not.toThrow();
  });

  it.each([
    ['workflow_call', { eventName: 'workflow_call' }],
    ['dev', { environment: 'dev' }],
    ['production', { environment: 'prod' }],
    ['recovery', { promoteMode: 'recovery' }],
    ['migration', { migrationMode: 'run' }],
    ['bootstrap', { bootstrapMode: 'run' }],
    ['different base', { baseSha: 'd'.repeat(40) }],
    ['missing run', { runId: '' }],
    ['malformed run', { runId: '12x' }],
    ['missing attempt', { runAttempt: '' }],
    ['malformed attempt', { runAttempt: '0' }],
    ['shadow builder', { configBuilderMode: 'shadow' }],
    ['shadow Main E2E', { mainE2EGateMode: 'shadow' }],
    ['shadow candidate', { candidateGateMode: 'shadow' }],
    ['shadow capability', { backupCapabilityGateMode: 'shadow' }],
    ['temporary backup executor', { backupExecutorMode: 'temporary' }],
    ['missing current run', { currentRunId: '' }],
    ['invalid current run number', { currentRunNumber: '0' }],
    ['invalid current attempt', { currentRunAttempt: '0' }],
  ])('rejects %s seed context', (_, override) => {
    expect(
      failureCode(() =>
        validateSeedRequest({
          eventName: 'workflow_dispatch',
          environment: 'staging',
          promoteMode: 'standard',
          migrationMode: 'assert-none',
          bootstrapMode: 'assert-none',
          baseSha: sourceSha,
          headSha: sourceSha,
          targetDigest: digest,
          configRevision,
          runId,
          runAttempt: String(runAttempt),
          configBuilderMode: 'authoritative',
          mainE2EGateMode: 'enforce',
          candidateGateMode: 'enforce',
          backupCapabilityGateMode: 'enforce',
          backupExecutorMode: 'agent',
          currentRunId: '999',
          currentRunNumber: '44',
          currentRunAttempt: '1',
          currentWorkflowSha: workflowHeadSha,
          ...override,
        })
      )
    ).toBe('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it('accepts Prepare only for the canonical missing-label context', () => {
    expect(() =>
      validatePrepareRequest({
        eventName: 'workflow_dispatch',
        environment: 'staging',
        promoteMode: 'standard',
        migrationMode: 'assert-none',
        bootstrapMode: 'assert-none',
        baseSha: sourceSha,
        headSha: sourceSha,
        targetDigest: digest,
        configBuilderMode: 'authoritative',
        mainE2EGateMode: 'enforce',
        candidateGateMode: 'enforce',
        backupCapabilityGateMode: 'enforce',
        backupExecutorMode: 'agent',
      })
    ).not.toThrow();
    expect(
      failureCode(() =>
        validatePrepareRequest({
          eventName: 'workflow_dispatch',
          environment: 'staging',
          promoteMode: 'standard',
          migrationMode: 'assert-none',
          bootstrapMode: 'assert-none',
          baseSha: sourceSha,
          headSha: sourceSha,
          targetDigest: digest,
          configBuilderMode: 'authoritative',
          mainE2EGateMode: 'enforce',
          candidateGateMode: 'enforce',
          backupCapabilityGateMode: 'enforce',
          backupExecutorMode: 'temporary',
        })
      )
    ).toBe('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it('attests Prepare only for exact same-digest missing live state', () => {
    const input = {
      eventName: 'workflow_dispatch',
      environment: 'staging',
      promoteMode: 'standard',
      migrationMode: 'assert-none',
      bootstrapMode: 'assert-none',
      baseSha: sourceSha,
      headSha: sourceSha,
      targetDigest: digest,
      configRevision,
      configBuilderMode: 'authoritative',
      mainE2EGateMode: 'enforce',
      candidateGateMode: 'enforce',
      backupCapabilityGateMode: 'enforce',
      backupExecutorMode: 'agent',
    };
    expect(
      verifyStagingLiveConfigPrepare(input, {
        image: `registry.example/studio@${digest}`,
        labels: {},
      })
    ).toEqual({
      contract: 'staging-live-config-label-prepare-v1',
      sourceSha,
      imageDigest: digest,
      configRevision,
      liveConfigRevisionState: 'missing',
      backupExecutor: 'agent',
    });
    const rejectedSnapshots: LiveServiceSnapshot[] = [
      { image: `registry.example/studio@${digest}`, labels: { 'sva.config.revision': 'invalid' } },
      {
        image: `registry.example/studio@${digest}`,
        labels: { 'sva.config.revision': configRevision },
      },
      { image: `registry.example/studio@sha256:${'d'.repeat(64)}`, labels: {} },
    ];
    for (const snapshot of rejectedSnapshots) {
      expect(failureCode(() => verifyStagingLiveConfigPrepare(input, snapshot))).toBe(
        'PROMOTE_LIVE_CONFIG_SEED_REJECTED'
      );
    }
  });

  it('redacts unexpected Prepare lookup failures from stderr', async () => {
    const stderr = { write: vi.fn(() => true) };
    const result = await runStagingLiveConfigPrepare(
      {
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        PROMOTE_ENVIRONMENT: 'staging',
        PROMOTE_MODE: 'standard',
        MIGRATION_MODE: 'assert-none',
        BOOTSTRAP_MODE: 'assert-none',
        BASE_SHA: sourceSha,
        HEAD_SHA: sourceSha,
        TARGET_DIGEST: digest,
        CONFIG_REVISION: configRevision,
        CONFIG_BUILDER_MODE: 'authoritative',
        MAIN_E2E_GATE_MODE: 'enforce',
        CANDIDATE_GATE_MODE: 'enforce',
        BACKUP_CAPABILITY_GATE_MODE: 'enforce',
        BACKUP_EXECUTOR_MODE: 'agent',
      },
      stderr,
      async () => {
        throw new Error('person@example.test https://internal.example.test\nremote log');
      }
    );
    expect(result).toBeNull();
    expect(stderr.write).toHaveBeenCalledWith('PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED\n');
    expect(stderr.write.mock.calls.flat().join('')).not.toContain('person@example.test');
  });

  it('projects only the allowlisted authorization from exact failed pre-seed evidence', () => {
    expect(validatePreSeedEvidence(preSeedEvidence(), bindings)).toEqual({
      authorization: 'staging-legacy-config-label-v1',
      evidenceRun: { id: runId, attempt: runAttempt },
      sourceSha,
      imageDigest: digest,
      configRevision,
    });
  });

  it.each([
    ['extra top-level key', { unexpected: 'sentinel' }],
    ['successful status', { status: 'passed', terminalFailure: null }],
    ['foreign environment', { environment: 'prod' }],
    ['recovery mode', { mode: 'recovery', recoveryReasonProvided: true }],
    ['foreign run', { run: { id: '999', attempt: runAttempt } }],
    ['foreign source', { git: { ...preSeedEvidence().git, headSha: 'd'.repeat(40) } }],
    [
      'digest change',
      { image: { ...preSeedEvidence().image, targetDigest: `sha256:${'d'.repeat(64)}` } },
    ],
    ['foreign config', { config: { ...preSeedEvidence().config, revision: 'd'.repeat(64) } }],
    ['invented rollback', { rollback: { imageDigest: digest, configRevision } }],
    ['invented recovery', { recovery: { mode: 'recovery' } }],
    ['prior seed authorization', { seedAuthorization: { authorization: 'sentinel' } }],
    ['missing prepare marker', { seedPreparation: null }],
    [
      'foreign prepare marker',
      { seedPreparation: { ...preSeedEvidence().seedPreparation, backupExecutor: 'temporary' } },
    ],
    ['missing Main E2E', { mainE2E: null }],
  ])('rejects pre-seed evidence with %s', (_, override) => {
    expect(
      failureCode(() => validatePreSeedEvidence({ ...preSeedEvidence(), ...override }, bindings))
    ).toBe('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it.each([
    ['recovery gate passed', 'recovery-contract', 'passed'],
    ['deploy ran', 'deploy', 'passed'],
    ['backup ran', 'studio-backup-request', 'passed'],
    ['cleanup skipped', 'config-cleanup', 'skipped'],
    ['main E2E skipped', 'main-e2e-evidence', 'skipped'],
    ['prepare marker skipped', 'legacy-config-seed-preparation', 'skipped'],
  ])('rejects an untruthful %s gate', (_, gateName, status) => {
    const evidence = preSeedEvidence();
    evidence.gates = evidence.gates.map((gate) =>
      gate.gate === gateName ? { ...gate, status } : gate
    ) as typeof evidence.gates;
    expect(failureCode(() => validatePreSeedEvidence(evidence, bindings))).toBe(
      'PROMOTE_LIVE_CONFIG_SEED_REJECTED'
    );
  });

  it('rejects duplicate, missing, nonblocking, and extra gates', () => {
    const evidence = preSeedEvidence();
    const cases = [
      { ...evidence, gates: evidence.gates.slice(1) },
      { ...evidence, gates: [...evidence.gates, evidence.gates[0]] },
      {
        ...evidence,
        gates: evidence.gates.map((gate) =>
          gate.gate === 'config-build' ? { ...gate, blocking: false } : gate
        ),
      },
      {
        ...evidence,
        gates: [...evidence.gates, { gate: 'unexpected', phase: 'evidence', status: 'passed' }],
      },
    ];
    for (const candidate of cases) {
      expect(failureCode(() => validatePreSeedEvidence(candidate, bindings))).toBe(
        'PROMOTE_LIVE_CONFIG_SEED_REJECTED'
      );
    }
  });
});

const workflowHeadSha = 'e'.repeat(40);
const workflowRun = {
  id: Number(runId),
  workflow_id: 42,
  run_attempt: runAttempt,
  run_number: 43,
  path: '.github/workflows/promote.yml',
  event: 'workflow_dispatch',
  head_branch: 'main',
  head_sha: workflowHeadSha,
  status: 'completed',
  conclusion: 'failure',
} satisfies StagingLiveConfigSeedWorkflowRun;
const currentSeedRun = {
  id: 999,
  workflow_id: 42,
  run_attempt: 1,
  run_number: 44,
  path: '.github/workflows/promote.yml',
  event: 'workflow_dispatch',
  head_branch: 'main',
  head_sha: workflowHeadSha,
  status: 'in_progress',
  conclusion: null,
} satisfies StagingLiveConfigSeedWorkflowRun;

const seedInput = {
  eventName: 'workflow_dispatch',
  environment: 'staging',
  promoteMode: 'standard',
  migrationMode: 'assert-none',
  bootstrapMode: 'assert-none',
  baseSha: sourceSha,
  headSha: sourceSha,
  targetDigest: digest,
  configRevision,
  runId,
  runAttempt: String(runAttempt),
  configBuilderMode: 'authoritative',
  mainE2EGateMode: 'enforce',
  candidateGateMode: 'enforce',
  backupCapabilityGateMode: 'enforce',
  backupExecutorMode: 'agent',
  currentRunId: String(currentSeedRun.id),
  currentRunNumber: String(currentSeedRun.run_number),
  currentRunAttempt: String(currentSeedRun.run_attempt),
  currentWorkflowSha: workflowHeadSha,
  secretReferences,
};

const seedDependencies = (
  overrides: Partial<StagingLiveConfigSeedDependencies> = {}
): StagingLiveConfigSeedDependencies => ({
  readWorkflowRunAttempt: () => workflowRun,
  readCurrentWorkflowRun: () => workflowRun,
  readExecutingWorkflowRun: () => currentSeedRun,
  readRunArtifacts: () => ({
    artifacts: [
      {
        id: 987,
        name: `promote-evidence-${runId}-${runAttempt}`,
        expired: false,
        workflow_run: { id: Number(runId), head_sha: workflowHeadSha },
      },
    ],
  }),
  readArtifactArchive: () => ({
    entries: [`promote-evidence-${runId}-${runAttempt}.json`],
    readText: () => JSON.stringify(preSeedEvidence()),
  }),
  readLiveSnapshot: () => ({ image: `registry.example/studio@${digest}`, labels: {} }),
  ...overrides,
});

describe('staging live config seed verifier', () => {
  it('uses the real run-scoped artifact endpoint while binding attempts in evidence', () => {
    expect(stagingLiveConfigSeedArtifactsPath('owner/repo', 32212677551, 2)).toBe(
      'repos/owner/repo/actions/runs/32212677551/artifacts?per_page=100&page=2'
    );
    expect(stagingLiveConfigSeedRunPath('owner/repo', 999)).toBe(
      'repos/owner/repo/actions/runs/999'
    );
  });
  it('binds the exact failed attempt, artifact, evidence, and repeated live snapshots', async () => {
    const readWorkflowRunAttempt = vi.fn(() => workflowRun);
    const readCurrentWorkflowRun = vi.fn(() => workflowRun);
    const readRunArtifacts = vi.fn(seedDependencies().readRunArtifacts);
    const readExecutingWorkflowRun = vi.fn(seedDependencies().readExecutingWorkflowRun);
    const readLiveSnapshot = vi.fn(seedDependencies().readLiveSnapshot);
    await expect(
      verifyStagingLiveConfigSeed(
        seedInput,
        seedDependencies({
          readWorkflowRunAttempt,
          readCurrentWorkflowRun,
          readRunArtifacts,
          readExecutingWorkflowRun,
          readLiveSnapshot,
        })
      )
    ).resolves.toEqual({
      authorization: 'staging-legacy-config-label-v1',
      evidenceRun: { id: runId, attempt: runAttempt },
      sourceSha,
      imageDigest: digest,
      configRevision,
    });
    expect(readWorkflowRunAttempt).toHaveBeenCalledTimes(4);
    expect(readCurrentWorkflowRun).toHaveBeenCalledTimes(2);
    expect(readRunArtifacts).toHaveBeenCalledTimes(2);
    expect(readExecutingWorkflowRun).toHaveBeenCalledTimes(2);
    expect(readLiveSnapshot).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['in progress', { status: 'in_progress', conclusion: null }],
    ['cancelled', { conclusion: 'cancelled' }],
    ['successful', { conclusion: 'success' }],
    ['foreign workflow', { path: '.github/workflows/build.yml' }],
    ['foreign event', { event: 'workflow_call' }],
    ['foreign branch', { head_branch: 'feature/example' }],
    ['wrong attempt', { run_attempt: 2 }],
  ])('rejects a %s pre-seed workflow run', async (_, override) => {
    expect(
      await asyncFailureCode(() =>
        verifyStagingLiveConfigSeed(
          seedInput,
          seedDependencies({ readWorkflowRunAttempt: () => ({ ...workflowRun, ...override }) })
        )
      )
    ).toBe('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it.each([
    ['run-number gap', { run_number: 45 }],
    ['foreign workflow identity', { workflow_id: 99 }],
    ['wrong current attempt', { run_attempt: 2 }],
    ['foreign current workflow', { path: '.github/workflows/build.yml' }],
    ['foreign current event', { event: 'workflow_call' }],
    ['foreign current branch', { head_branch: 'feature/example' }],
    ['foreign current workflow SHA', { head_sha: 'f'.repeat(40) }],
    ['terminal current run', { status: 'completed', conclusion: 'failure' }],
  ])('rejects %s for the executing Seed run', async (_, override) => {
    expect(
      await asyncFailureCode(() =>
        verifyStagingLiveConfigSeed(
          seedInput,
          seedDependencies({
            readExecutingWorkflowRun: () => ({ ...currentSeedRun, ...override }),
          })
        )
      )
    ).toBe('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it.each([
    ['missing', []],
    [
      'expired',
      [
        {
          id: 987,
          name: `promote-evidence-${runId}-${runAttempt}`,
          expired: true,
          workflow_run: { id: Number(runId), head_sha: workflowHeadSha },
        },
      ],
    ],
    [
      'wrong name',
      [
        {
          id: 987,
          name: 'promote-evidence-other',
          expired: false,
          workflow_run: { id: Number(runId), head_sha: workflowHeadSha },
        },
      ],
    ],
    [
      'ambiguous',
      [
        {
          id: 987,
          name: `promote-evidence-${runId}-${runAttempt}`,
          expired: false,
          workflow_run: { id: Number(runId), head_sha: workflowHeadSha },
        },
        {
          id: 988,
          name: `promote-evidence-${runId}-${runAttempt}`,
          expired: false,
          workflow_run: { id: Number(runId), head_sha: workflowHeadSha },
        },
      ],
    ],
  ])('rejects a %s evidence artifact', (_, artifacts) => {
    expect(failureCode(() => selectSeedArtifact(artifacts, workflowRun))).toBe(
      'PROMOTE_LIVE_CONFIG_SEED_REJECTED'
    );
  });

  it.each([
    ['nested JSON', [`nested/promote-evidence-${runId}-${runAttempt}.json`]],
    ['wrong JSON', ['evidence.json']],
    ['multiple entries', [`promote-evidence-${runId}-${runAttempt}.json`, 'extra.json']],
    ['non-JSON extra entry', [`promote-evidence-${runId}-${runAttempt}.json`, 'README.md']],
  ])('rejects an archive with %s', (_, entries) => {
    expect(failureCode(() => selectSeedEvidenceJson(entries, runId, runAttempt))).toBe(
      'PROMOTE_LIVE_CONFIG_SEED_REJECTED'
    );
  });

  it('maps API, archive, and JSON failures to stable redacted codes', async () => {
    expect(
      await asyncFailureCode(() =>
        verifyStagingLiveConfigSeed(
          seedInput,
          seedDependencies({
            readWorkflowRunAttempt: () => {
              throw new Error('person@example.test https://internal.example.test\nsecret=value');
            },
          })
        )
      )
    ).toBe('PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED');
    expect(
      await asyncFailureCode(() =>
        verifyStagingLiveConfigSeed(
          seedInput,
          seedDependencies({
            readArtifactArchive: () => {
              throw new Error('person@example.test https://internal.example.test');
            },
          })
        )
      )
    ).toBe('PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED');
    expect(
      await asyncFailureCode(() =>
        verifyStagingLiveConfigSeed(
          seedInput,
          seedDependencies({
            readArtifactArchive: () => ({
              entries: [`promote-evidence-${runId}-${runAttempt}.json`],
              readText: () => '{',
            }),
          })
        )
      )
    ).toBe('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  });

  it('rejects run, artifact, and live-state races after evidence validation', async () => {
    let runReads = 0;
    let artifactReads = 0;
    let liveReads = 0;
    let executingRunReads = 0;
    const cases = [
      seedDependencies({
        readCurrentWorkflowRun: () =>
          ++runReads === 1
            ? workflowRun
            : { ...workflowRun, run_attempt: 2, status: 'in_progress' },
      }),
      seedDependencies({
        readExecutingWorkflowRun: () =>
          ++executingRunReads === 1
            ? currentSeedRun
            : { ...currentSeedRun, run_number: currentSeedRun.run_number + 1 },
      }),
      seedDependencies({
        readRunArtifacts: () => ({
          artifacts: [
            {
              id: ++artifactReads === 1 ? 987 : 988,
              name: `promote-evidence-${runId}-${runAttempt}`,
              expired: false,
              workflow_run: { id: Number(runId), head_sha: workflowHeadSha },
            },
          ],
        }),
      }),
      seedDependencies({
        readLiveSnapshot: () =>
          ++liveReads === 1
            ? { image: `registry.example/studio@${digest}`, labels: {} as Record<string, string> }
            : {
                image: `registry.example/studio@${digest}`,
                labels: { 'sva.config.revision': configRevision },
              },
      }),
    ];
    for (const dependencies of cases) {
      expect(
        await asyncFailureCode(() => verifyStagingLiveConfigSeed(seedInput, dependencies))
      ).toBe('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
    }
  });
});
