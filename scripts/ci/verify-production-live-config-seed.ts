#!/usr/bin/env node

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  assertSeedableProductionLiveSnapshot,
  validateProductionPreSeedEvidence,
  type ProductionLiveConfigSeedAuthorization,
  type ProductionLiveServiceSnapshot,
} from './production-live-config-seed-contract.ts';
import {
  validateProductionSeedRequest,
  type ProductionLiveConfigSeedRequest,
} from './production-live-config-seed-context.ts';
import {
  createProductionLiveConfigSeedDependencies,
  parseProductionSeedReferences,
  requireProductionSeedValue,
} from './production-live-config-seed-io.ts';
import {
  isExactFailedProductionPrepareAttempt,
  validateImmediatePreviousProductionPrepareRun,
  type ProductionLiveConfigSeedWorkflowRun,
} from './production-live-config-seed-runs.ts';
import {
  buildPromoteFailure,
  PromoteContractError,
  redactPromoteFailure,
  writePromoteFailureRecord,
  type PromoteErrorCode,
} from './promote-result.ts';

export type ProductionLiveConfigSeedArtifact = Readonly<{
  id?: number;
  name?: string;
  expired?: boolean;
  workflow_run?: Readonly<{ id?: number; head_sha?: string }>;
}>;

type Archive = Readonly<{ entries: readonly string[]; readText: (entry: string) => string }>;

export type ProductionLiveConfigSeedDependencies = Readonly<{
  readWorkflowRunAttempt: (runId: number, attempt: number) => ProductionLiveConfigSeedWorkflowRun;
  readCurrentWorkflowRun: (runId: number) => ProductionLiveConfigSeedWorkflowRun;
  readExecutingWorkflowRun: (runId: number) => ProductionLiveConfigSeedWorkflowRun;
  readRunArtifacts: (
    runId: number,
    page: number
  ) => Readonly<{ artifacts?: ProductionLiveConfigSeedArtifact[]; total_count?: number }>;
  readArtifactArchive: (artifactId: number) => Archive;
  readLiveSnapshot: () => ProductionLiveServiceSnapshot | Promise<ProductionLiveServiceSnapshot>;
}>;

export type ProductionLiveConfigSeedInput = ProductionLiveConfigSeedRequest &
  Readonly<{ secretReferences: readonly string[] }>;

const contractError = (code: PromoteErrorCode): PromoteContractError =>
  new PromoteContractError(
    buildPromoteFailure({ code, environment: 'prod', phase: 'static-preflight' })
  );

const readLookup = <T>(operation: () => T): T => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof PromoteContractError) throw error;
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED');
  }
};

const readLive = async (
  operation: () => ProductionLiveServiceSnapshot | Promise<ProductionLiveServiceSnapshot>
): Promise<ProductionLiveServiceSnapshot> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PromoteContractError) throw error;
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED');
  }
};

const listArtifacts = (
  readPage: (page: number) => Readonly<{
    artifacts?: ProductionLiveConfigSeedArtifact[];
    total_count?: number;
  }>
): ProductionLiveConfigSeedArtifact[] => {
  const artifacts: ProductionLiveConfigSeedArtifact[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const payload = readLookup(() => readPage(page));
    const entries = payload.artifacts ?? [];
    artifacts.push(...entries);
    if (
      entries.length < 100 ||
      (payload.total_count !== undefined && artifacts.length >= payload.total_count)
    )
      return artifacts;
  }
  throw contractError('PROMOTE_LIVE_CONFIG_SEED_LOOKUP_FAILED');
};

const assertFailedAttempt = (
  run: ProductionLiveConfigSeedWorkflowRun,
  runId: number,
  attempt: number
): ProductionLiveConfigSeedWorkflowRun => {
  if (!isExactFailedProductionPrepareAttempt(run, runId, attempt))
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  return run;
};

const assertAdjacency = (
  input: ProductionLiveConfigSeedInput,
  dependencies: ProductionLiveConfigSeedDependencies,
  runId: number,
  attempt: number
): void => {
  const current = readLookup(() =>
    dependencies.readExecutingWorkflowRun(Number(input.currentRunId))
  );
  const previous = readLookup(() => dependencies.readWorkflowRunAttempt(runId, attempt));
  validateImmediatePreviousProductionPrepareRun(current, previous, {
    currentRunId: input.currentRunId,
    currentRunNumber: input.currentRunNumber,
    currentRunAttempt: input.currentRunAttempt,
    currentWorkflowSha: input.currentWorkflowSha,
    referencedRunId: runId,
    referencedAttempt: attempt,
  });
};

export const selectProductionSeedArtifact = (
  artifacts: readonly ProductionLiveConfigSeedArtifact[],
  run: ProductionLiveConfigSeedWorkflowRun
): ProductionLiveConfigSeedArtifact & Required<Pick<ProductionLiveConfigSeedArtifact, 'id'>> => {
  const expectedName = `promote-evidence-${run.id}-${run.run_attempt}`;
  const matches = artifacts.filter(
    (artifact) =>
      artifact.name === expectedName &&
      artifact.expired === false &&
      artifact.workflow_run?.id === run.id &&
      artifact.workflow_run?.head_sha === run.head_sha
  );
  const match = matches[0];
  if (matches.length !== 1 || !Number.isSafeInteger(match?.id) || Number(match?.id) < 1)
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  return match as ProductionLiveConfigSeedArtifact &
    Required<Pick<ProductionLiveConfigSeedArtifact, 'id'>>;
};

export const selectProductionSeedEvidenceJson = (
  entries: readonly string[],
  runId: string,
  attempt: number
): string => {
  const expected = `promote-evidence-${runId}-${attempt}.json`;
  if (entries.length !== 1 || entries[0] !== expected)
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  return expected;
};

const parseEvidence = (archive: Archive, entry: string): unknown => {
  try {
    return JSON.parse(readLookup(() => archive.readText(entry))) as unknown;
  } catch (error) {
    if (error instanceof PromoteContractError) throw error;
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  }
};

const boundArtifact = (
  dependencies: ProductionLiveConfigSeedDependencies,
  run: ProductionLiveConfigSeedWorkflowRun,
  runId: number
) =>
  selectProductionSeedArtifact(
    listArtifacts((page) => dependencies.readRunArtifacts(runId, page)),
    run
  );

export const verifyProductionLiveConfigSeed = async (
  input: ProductionLiveConfigSeedInput,
  dependencies: ProductionLiveConfigSeedDependencies
): Promise<ProductionLiveConfigSeedAuthorization> => {
  validateProductionSeedRequest(input);
  const runId = Number(input.runId);
  const attempt = Number(input.runAttempt);
  assertAdjacency(input, dependencies, runId, attempt);
  assertSeedableProductionLiveSnapshot(
    await readLive(dependencies.readLiveSnapshot),
    input.targetDigest
  );
  const run = assertFailedAttempt(
    readLookup(() => dependencies.readWorkflowRunAttempt(runId, attempt)),
    runId,
    attempt
  );
  assertFailedAttempt(
    readLookup(() => dependencies.readCurrentWorkflowRun(runId)),
    runId,
    attempt
  );
  const artifact = boundArtifact(dependencies, run, runId);
  const archive = readLookup(() => dependencies.readArtifactArchive(artifact.id));
  const entry = selectProductionSeedEvidenceJson(archive.entries, input.runId, attempt);
  const authorization = validateProductionPreSeedEvidence(parseEvidence(archive, entry), {
    runId: input.runId,
    runAttempt: attempt,
    sourceSha: input.headSha,
    imageDigest: input.targetDigest,
    configRevision: input.configRevision,
    secretReferences: input.secretReferences,
  });
  const currentRun = assertFailedAttempt(
    readLookup(() => dependencies.readWorkflowRunAttempt(runId, attempt)),
    runId,
    attempt
  );
  assertFailedAttempt(
    readLookup(() => dependencies.readCurrentWorkflowRun(runId)),
    runId,
    attempt
  );
  if (boundArtifact(dependencies, currentRun, runId).id !== artifact.id)
    throw contractError('PROMOTE_LIVE_CONFIG_SEED_REJECTED');
  assertAdjacency(input, dependencies, runId, attempt);
  assertSeedableProductionLiveSnapshot(
    await readLive(dependencies.readLiveSnapshot),
    input.targetDigest
  );
  return authorization;
};

const inputFromEnvironment = (env: NodeJS.ProcessEnv): ProductionLiveConfigSeedInput => ({
  eventName: requireProductionSeedValue(env.GITHUB_EVENT_NAME),
  environment: requireProductionSeedValue(env.PROMOTE_ENVIRONMENT),
  promoteMode: requireProductionSeedValue(env.PROMOTE_MODE),
  migrationMode: requireProductionSeedValue(env.MIGRATION_MODE),
  bootstrapMode: requireProductionSeedValue(env.BOOTSTRAP_MODE),
  baseSha: requireProductionSeedValue(env.BASE_SHA),
  headSha: requireProductionSeedValue(env.HEAD_SHA),
  targetDigest: requireProductionSeedValue(env.TARGET_DIGEST),
  configRevision: requireProductionSeedValue(env.CONFIG_REVISION),
  runId: requireProductionSeedValue(env.SEED_EVIDENCE_RUN_ID),
  runAttempt: requireProductionSeedValue(env.SEED_EVIDENCE_RUN_ATTEMPT),
  configBuilderMode: requireProductionSeedValue(env.CONFIG_BUILDER_MODE),
  mainE2EGateMode: requireProductionSeedValue(env.MAIN_E2E_GATE_MODE),
  candidateGateMode: requireProductionSeedValue(env.CANDIDATE_GATE_MODE),
  backupCapabilityGateMode: requireProductionSeedValue(env.BACKUP_CAPABILITY_GATE_MODE),
  backupExecutorMode: requireProductionSeedValue(env.BACKUP_EXECUTOR_MODE),
  currentRunId: requireProductionSeedValue(env.GITHUB_RUN_ID),
  currentRunNumber: requireProductionSeedValue(env.GITHUB_RUN_NUMBER),
  currentRunAttempt: requireProductionSeedValue(env.GITHUB_RUN_ATTEMPT),
  currentWorkflowSha: requireProductionSeedValue(env.GITHUB_SHA),
  secretReferences: parseProductionSeedReferences(env.SECRET_REFERENCES),
});

export const runProductionLiveConfigSeed = async (
  env: NodeJS.ProcessEnv = process.env,
  stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr,
  dependenciesFactory = createProductionLiveConfigSeedDependencies
): Promise<ProductionLiveConfigSeedAuthorization | null> => {
  try {
    const authorization = await verifyProductionLiveConfigSeed(
      inputFromEnvironment(env),
      dependenciesFactory(
        requireProductionSeedValue(env.GITHUB_REPOSITORY),
        requireProductionSeedValue(env.GITHUB_TOKEN),
        requireProductionSeedValue(env.QUANTUM_ENDPOINT)
      )
    );
    if (env.GITHUB_OUTPUT)
      appendFileSync(env.GITHUB_OUTPUT, `seed_authorization=${JSON.stringify(authorization)}\n`);
    return authorization;
  } catch (error) {
    const failure = redactPromoteFailure(error, { environment: 'prod', phase: 'static-preflight' });
    writePromoteFailureRecord(failure, env.PROMOTE_FAILURE_PATH);
    stderr.write(`${failure.code}\n`);
    return null;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductionLiveConfigSeed().then((result) => {
    if (!result) process.exitCode = 1;
  });
}
