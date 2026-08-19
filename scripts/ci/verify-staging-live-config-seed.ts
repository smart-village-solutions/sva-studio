#!/usr/bin/env node

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  assertSeedableLiveSnapshot,
  validatePreSeedEvidence,
  validateSeedRequest,
  type LiveServiceSnapshot,
  type StagingLiveConfigSeedAuthorization,
} from './staging-live-config-seed-contract.ts';
import {
  buildPromoteFailure,
  PromoteContractError,
  redactPromoteFailure,
  writePromoteFailureRecord,
  type PromoteErrorCode,
} from './promote-result.ts';
import {
  createStagingLiveConfigSeedCliDependencies,
  parseSeedSecretReferences,
  requireSeedCliValue,
} from './staging-live-config-seed-io.ts';
import {
  isExactFailedPrepareAttempt,
  validateImmediatePreviousPrepareRun,
  type StagingLiveConfigSeedWorkflowRun,
} from './staging-live-config-seed-runs.ts';

export type { StagingLiveConfigSeedWorkflowRun } from './staging-live-config-seed-runs.ts';

export type StagingLiveConfigSeedArtifact = Readonly<{
  id?: number;
  name?: string;
  expired?: boolean;
  workflow_run?: Readonly<{ id?: number; head_sha?: string }>;
}>;

type Archive = Readonly<{ entries: readonly string[]; readText: (entry: string) => string }>;

export type StagingLiveConfigSeedDependencies = Readonly<{
  readWorkflowRunAttempt: (runId: number, attempt: number) => StagingLiveConfigSeedWorkflowRun;
  readCurrentWorkflowRun: (runId: number) => StagingLiveConfigSeedWorkflowRun;
  readExecutingWorkflowRun: (runId: number) => StagingLiveConfigSeedWorkflowRun;
  readRunArtifacts: (
    runId: number,
    attempt: number,
    page: number
  ) => Readonly<{ artifacts?: StagingLiveConfigSeedArtifact[]; total_count?: number }>;
  readArtifactArchive: (artifactId: number) => Archive;
  readLiveSnapshot: () => LiveServiceSnapshot | Promise<LiveServiceSnapshot>;
}>;

export type StagingLiveConfigSeedInput = Readonly<{
  eventName: string;
  environment: string;
  promoteMode: string;
  migrationMode: string;
  bootstrapMode: string;
  baseSha: string;
  headSha: string;
  targetDigest: string;
  configRevision: string;
  runId: string;
  runAttempt: string;
  configBuilderMode: string;
  mainE2EGateMode: string;
  candidateGateMode: string;
  backupCapabilityGateMode: string;
  backupExecutorMode: string;
  currentRunId: string;
  currentRunNumber: string;
  currentRunAttempt: string;
  currentWorkflowSha: string;
  secretReferences: readonly string[];
}>;

const contractError = (code: PromoteErrorCode): PromoteContractError =>
  new PromoteContractError(
    buildPromoteFailure({ code, environment: 'staging', phase: 'static-preflight' })
  );

const readLookup = <T>(operation: () => T): T => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof PromoteContractError) throw error;
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED');
  }
};

const readLiveLookup = async (
  operation: () => LiveServiceSnapshot | Promise<LiveServiceSnapshot>
): Promise<LiveServiceSnapshot> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PromoteContractError) throw error;
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED');
  }
};

const listArtifacts = (
  readPage: (page: number) => Readonly<{
    artifacts?: StagingLiveConfigSeedArtifact[];
    total_count?: number;
  }>
): StagingLiveConfigSeedArtifact[] => {
  const artifacts: StagingLiveConfigSeedArtifact[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const payload = readLookup(() => readPage(page));
    const pageArtifacts = payload.artifacts ?? [];
    artifacts.push(...pageArtifacts);
    if (
      pageArtifacts.length < 100 ||
      (payload.total_count !== undefined && artifacts.length >= payload.total_count)
    )
      return artifacts;
  }
  throw contractError('PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED');
};

const assertExactFailedAttempt = (
  run: StagingLiveConfigSeedWorkflowRun,
  runId: number,
  attempt: number
): StagingLiveConfigSeedWorkflowRun => {
  if (!isExactFailedPrepareAttempt(run, runId, attempt))
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  return run;
};

const assertImmediatePreviousPrepareRun = (
  input: StagingLiveConfigSeedInput,
  dependencies: StagingLiveConfigSeedDependencies,
  referencedRunId: number,
  referencedAttempt: number
): void => {
  const current = readLookup(() =>
    dependencies.readExecutingWorkflowRun(Number(input.currentRunId))
  );
  const previous = readLookup(() =>
    dependencies.readWorkflowRunAttempt(referencedRunId, referencedAttempt)
  );
  validateImmediatePreviousPrepareRun(current, previous, {
    currentRunId: input.currentRunId,
    currentRunNumber: input.currentRunNumber,
    currentRunAttempt: input.currentRunAttempt,
    currentWorkflowSha: input.currentWorkflowSha,
    referencedRunId,
    referencedAttempt,
  });
};

export const selectSeedArtifact = (
  artifacts: readonly StagingLiveConfigSeedArtifact[],
  run: StagingLiveConfigSeedWorkflowRun
): Required<Pick<StagingLiveConfigSeedArtifact, 'id' | 'name'>> & StagingLiveConfigSeedArtifact => {
  const expectedName = `promote-evidence-${run.id}-${run.run_attempt}`;
  const matches = artifacts.filter(
    (artifact) =>
      artifact.name === expectedName &&
      artifact.expired === false &&
      artifact.workflow_run?.id === run.id &&
      artifact.workflow_run?.head_sha === run.head_sha
  );
  const match = matches[0];
  if (matches.length !== 1 || !Number.isSafeInteger(match?.id) || (match?.id ?? 0) < 1)
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  return match as Required<Pick<StagingLiveConfigSeedArtifact, 'id' | 'name'>> &
    StagingLiveConfigSeedArtifact;
};

export const selectSeedEvidenceJson = (
  entries: readonly string[],
  runId: string,
  attempt: number
): string => {
  const expected = `promote-evidence-${runId}-${attempt}.json`;
  if (entries.length !== 1 || entries[0] !== expected)
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  return expected;
};

const parseEvidenceJson = (archive: Archive, entry: string): unknown => {
  try {
    return JSON.parse(readLookup(() => archive.readText(entry))) as unknown;
  } catch (error) {
    if (error instanceof PromoteContractError) throw error;
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  }
};

const readBoundArtifact = (
  input: StagingLiveConfigSeedInput,
  dependencies: StagingLiveConfigSeedDependencies,
  run: StagingLiveConfigSeedWorkflowRun,
  runId: number,
  attempt: number
) =>
  selectSeedArtifact(
    listArtifacts((page) => dependencies.readRunArtifacts(runId, attempt, page)),
    run
  );

export const verifyStagingLiveConfigSeed = async (
  input: StagingLiveConfigSeedInput,
  dependencies: StagingLiveConfigSeedDependencies
): Promise<StagingLiveConfigSeedAuthorization> => {
  validateSeedRequest(input);
  const runId = Number(input.runId);
  const attempt = Number(input.runAttempt);
  assertImmediatePreviousPrepareRun(input, dependencies, runId, attempt);
  assertSeedableLiveSnapshot(
    await readLiveLookup(dependencies.readLiveSnapshot),
    input.targetDigest
  );
  const run = assertExactFailedAttempt(
    readLookup(() => dependencies.readWorkflowRunAttempt(runId, attempt)),
    runId,
    attempt
  );
  assertExactFailedAttempt(
    readLookup(() => dependencies.readCurrentWorkflowRun(runId)),
    runId,
    attempt
  );
  const artifact = readBoundArtifact(input, dependencies, run, runId, attempt);
  const archive = readLookup(() => dependencies.readArtifactArchive(artifact.id));
  const entry = selectSeedEvidenceJson(archive.entries, input.runId, attempt);
  const authorization = validatePreSeedEvidence(parseEvidenceJson(archive, entry), {
    runId: input.runId,
    runAttempt: attempt,
    sourceSha: input.headSha,
    imageDigest: input.targetDigest,
    configRevision: input.configRevision,
    secretReferences: input.secretReferences,
  });
  const currentRun = assertExactFailedAttempt(
    readLookup(() => dependencies.readWorkflowRunAttempt(runId, attempt)),
    runId,
    attempt
  );
  assertExactFailedAttempt(
    readLookup(() => dependencies.readCurrentWorkflowRun(runId)),
    runId,
    attempt
  );
  const currentArtifact = readBoundArtifact(input, dependencies, currentRun, runId, attempt);
  if (currentArtifact.id !== artifact.id) throw contractError('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  assertImmediatePreviousPrepareRun(input, dependencies, runId, attempt);
  assertSeedableLiveSnapshot(
    await readLiveLookup(dependencies.readLiveSnapshot),
    input.targetDigest
  );
  return authorization;
};

export const runStagingLiveConfigSeed = async (
  env: NodeJS.ProcessEnv = process.env,
  stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr,
  dependenciesFactory = createStagingLiveConfigSeedCliDependencies
): Promise<StagingLiveConfigSeedAuthorization | null> => {
  try {
    const authorization = await verifyStagingLiveConfigSeed(
      {
        eventName: requireSeedCliValue(env.GITHUB_EVENT_NAME),
        environment: requireSeedCliValue(env.PROMOTE_ENVIRONMENT),
        promoteMode: requireSeedCliValue(env.PROMOTE_MODE),
        migrationMode: requireSeedCliValue(env.MIGRATION_MODE),
        bootstrapMode: requireSeedCliValue(env.BOOTSTRAP_MODE),
        baseSha: requireSeedCliValue(env.BASE_SHA),
        headSha: requireSeedCliValue(env.HEAD_SHA),
        targetDigest: requireSeedCliValue(env.TARGET_DIGEST),
        configRevision: requireSeedCliValue(env.CONFIG_REVISION),
        runId: requireSeedCliValue(env.SEED_EVIDENCE_RUN_ID),
        runAttempt: requireSeedCliValue(env.SEED_EVIDENCE_RUN_ATTEMPT),
        configBuilderMode: requireSeedCliValue(env.CONFIG_BUILDER_MODE),
        mainE2EGateMode: requireSeedCliValue(env.MAIN_E2E_GATE_MODE),
        candidateGateMode: requireSeedCliValue(env.CANDIDATE_GATE_MODE),
        backupCapabilityGateMode: requireSeedCliValue(env.BACKUP_CAPABILITY_GATE_MODE),
        backupExecutorMode: requireSeedCliValue(env.BACKUP_EXECUTOR_MODE),
        currentRunId: requireSeedCliValue(env.GITHUB_RUN_ID),
        currentRunNumber: requireSeedCliValue(env.GITHUB_RUN_NUMBER),
        currentRunAttempt: requireSeedCliValue(env.GITHUB_RUN_ATTEMPT),
        currentWorkflowSha: requireSeedCliValue(env.GITHUB_SHA),
        secretReferences: parseSeedSecretReferences(env.SECRET_REFERENCES),
      },
      dependenciesFactory(
        requireSeedCliValue(env.GITHUB_REPOSITORY),
        requireSeedCliValue(env.GITHUB_TOKEN),
        requireSeedCliValue(env.QUANTUM_ENDPOINT)
      )
    );
    if (env.GITHUB_OUTPUT)
      appendFileSync(env.GITHUB_OUTPUT, `seed_authorization=${JSON.stringify(authorization)}\n`);
    return authorization;
  } catch (error) {
    const failure = redactPromoteFailure(error, {
      environment: 'staging',
      phase: 'static-preflight',
    });
    writePromoteFailureRecord(failure, env.PROMOTE_FAILURE_PATH);
    stderr.write(`${failure.code}\n`);
    return null;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runStagingLiveConfigSeed().then((result) => {
    if (!result) process.exitCode = 1;
  });
}
