import { buildPromoteFailure, PromoteContractError } from './promote-result.ts';

export type StagingLiveConfigSeedWorkflowRun = Readonly<{
  id?: number;
  workflow_id?: number;
  run_attempt?: number;
  run_number?: number;
  path?: string;
  event?: string;
  head_branch?: string;
  head_sha?: string;
  status?: string;
  conclusion?: string | null;
}>;

const workflowPath = '.github/workflows/promote.yml';

const reject = (): never => {
  throw new PromoteContractError(
    buildPromoteFailure({
      code: 'PROMOTE_LIVE_CONFIG_SEED_REJECTED',
      environment: 'staging',
      phase: 'static-preflight',
    })
  );
};

export const isExactFailedPrepareAttempt = (
  run: StagingLiveConfigSeedWorkflowRun,
  runId: number,
  attempt: number
): boolean =>
  run.id === runId &&
  run.run_attempt === attempt &&
  run.path === workflowPath &&
  run.event === 'workflow_dispatch' &&
  run.head_branch === 'main' &&
  /^[a-f0-9]{40}$/u.test(run.head_sha ?? '') &&
  run.status === 'completed' &&
  run.conclusion === 'failure';

export const validateImmediatePreviousPrepareRun = (
  current: StagingLiveConfigSeedWorkflowRun,
  previous: StagingLiveConfigSeedWorkflowRun,
  input: Readonly<{
    currentRunId: string;
    currentRunNumber: string;
    currentRunAttempt: string;
    currentWorkflowSha: string;
    referencedRunId: number;
    referencedAttempt: number;
  }>
): void => {
  const currentRunNumber = Number(input.currentRunNumber);
  const valid =
    current.id === Number(input.currentRunId) &&
    current.run_number === currentRunNumber &&
    current.run_attempt === Number(input.currentRunAttempt) &&
    current.workflow_id === previous.workflow_id &&
    current.path === workflowPath &&
    current.event === 'workflow_dispatch' &&
    current.head_branch === 'main' &&
    current.head_sha === input.currentWorkflowSha &&
    current.status === 'in_progress' &&
    current.conclusion === null &&
    previous.run_number === currentRunNumber - 1 &&
    isExactFailedPrepareAttempt(previous, input.referencedRunId, input.referencedAttempt);
  if (!valid) reject();
};
