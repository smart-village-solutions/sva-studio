#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { parseAppE2EEvidence, type AppE2EEvidence } from './app-e2e-evidence.ts';
import { redactPromoteFailure, writePromoteFailureRecord } from './promote-result.ts';
import {
  contractError,
  createCliDependencies,
  hasValidRunIdentity,
  isCurrentSuccessfulSelection,
  isTerminalSuccessfulRun,
  listPages,
  readLookup,
  required,
  selectEvidenceArtifact,
  selectEvidenceJsonFile,
  type MainE2EVerifierDependencies,
  type MainE2EWorkflowRun,
} from './verify-main-e2e-evidence.ts';

const shaPattern = /^[0-9a-f]{40}$/u;
const hotfixRefPattern = /^refs\/heads\/hotfix\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const stableTagPattern = /^studio-v\d+\.\d+\.\d+$/u;
const expectedWorkflowPath = '.github/workflows/app-e2e.yml';

export type HotfixE2EExpectation = Readonly<{
  sourceSha: string;
  controllerSha: string;
  baseTag: string;
  branchRef: string;
  runId: number;
}>;

const validateHotfixRun = (
  run: MainE2EWorkflowRun,
  expected: HotfixE2EExpectation
): Required<MainE2EWorkflowRun> => {
  if (
    !hasValidRunIdentity(run) ||
    run.path !== expectedWorkflowPath ||
    run.event !== 'workflow_dispatch' ||
    run.head_branch !== 'main' ||
    run.head_sha !== expected.controllerSha ||
    !isTerminalSuccessfulRun(run)
  ) {
    throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  }
  return run as Required<MainE2EWorkflowRun>;
};

const matchesControlledHotfixEvidence = (
  evidence: AppE2EEvidence,
  run: Required<MainE2EWorkflowRun>,
  expected: HotfixE2EExpectation
): boolean =>
  evidence.workflow === 'App E2E' &&
  evidence.event === 'workflow_dispatch' &&
  evidence.ref === 'refs/heads/main' &&
  evidence.branch === 'main' &&
  evidence.headSha === expected.sourceSha &&
  evidence.run.id === String(run.id) &&
  evidence.run.attempt === run.run_attempt &&
  evidence.result === 'success' &&
  evidence.testOutcome === 'success' &&
  evidence.evidenceClass === 'controlled-hotfix' &&
  evidence.hotfix?.controllerSha === expected.controllerSha &&
  evidence.hotfix.baseTag === expected.baseTag &&
  evidence.hotfix.ref === expected.branchRef &&
  evidence.hotfix.sourceSha === expected.sourceSha &&
  evidence.subject.kind === 'local-app-service-stack' &&
  evidence.subject.containerArtifactVerified === false;

export const verifyHotfixE2EEvidence = (
  expected: HotfixE2EExpectation,
  dependencies: MainE2EVerifierDependencies
): AppE2EEvidence => {
  if (
    !shaPattern.test(expected.sourceSha) ||
    !shaPattern.test(expected.controllerSha) ||
    !stableTagPattern.test(expected.baseTag) ||
    !hotfixRefPattern.test(expected.branchRef) ||
    !Number.isSafeInteger(expected.runId) ||
    expected.runId < 1
  ) {
    throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  }
  const selected = validateHotfixRun(
    readLookup(() => dependencies.readWorkflowRun(expected.runId)),
    expected
  );
  const artifacts = listPages((page) => {
    const response = readLookup(() => dependencies.readRunArtifacts(expected.runId, page));
    return { items: response.artifacts ?? [], total: response.total_count };
  });
  const artifact = selectEvidenceArtifact(artifacts, selected);
  const archive = readLookup(() => dependencies.readArtifactArchive(artifact.id));
  const evidenceFile = selectEvidenceJsonFile(archive.entries, selected);
  let evidence: AppE2EEvidence | null;
  try {
    evidence = parseAppE2EEvidence(JSON.parse(readLookup(() => archive.readText(evidenceFile))));
  } catch {
    throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  }
  if (!evidence || !matchesControlledHotfixEvidence(evidence, selected, expected))
    throw contractError('PROMOTE_MAIN_E2E_REJECTED');
  const current = readLookup(() => dependencies.readWorkflowRun(expected.runId));
  if (
    !isCurrentSuccessfulSelection(current, selected, expected.controllerSha) ||
    current.path !== expectedWorkflowPath ||
    current.event !== 'workflow_dispatch' ||
    current.head_branch !== 'main'
  )
    throw contractError('PROMOTE_MAIN_E2E_NOT_READY');
  return evidence;
};

export const runHotfixE2EPreflight = (
  env: NodeJS.ProcessEnv = process.env,
  stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr,
  dependenciesFactory: typeof createCliDependencies = createCliDependencies
): AppE2EEvidence | null => {
  try {
    const expectedHeadSha = required(env.EXPECTED_CHANGE_HEAD);
    const dependencies = dependenciesFactory(
      required(env.GITHUB_REPOSITORY),
      required(env.GITHUB_TOKEN),
      expectedHeadSha
    );
    const evidence = verifyHotfixE2EEvidence(
      {
        sourceSha: expectedHeadSha,
        controllerSha: required(env.EXPECTED_CONTROLLER_SHA),
        baseTag: required(env.HOTFIX_BASE_TAG),
        branchRef: required(env.HOTFIX_REF),
        runId: Number(required(env.HOTFIX_E2E_RUN_ID)),
      },
      dependencies
    );
    if (env.GITHUB_OUTPUT)
      appendFileSync(env.GITHUB_OUTPUT, `e2e_attestation=${JSON.stringify(evidence)}\n`, 'utf8');
    return evidence;
  } catch (error) {
    const failure = redactPromoteFailure(error, {
      environment: 'staging',
      phase: 'main-e2e-evidence',
    });
    writePromoteFailureRecord(failure, env.PROMOTE_FAILURE_PATH);
    stderr.write(`${JSON.stringify(failure)}\n`);
    return null;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!runHotfixE2EPreflight()) process.exitCode = 1;
}
