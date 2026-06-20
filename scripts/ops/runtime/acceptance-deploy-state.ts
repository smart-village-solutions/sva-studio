import type { AcceptanceDeployReport } from '../runtime-env.shared.ts';
import type { AcceptanceDeployDeps, AcceptanceDeployState, DeployFailure } from './acceptance-deploy.types.ts';

export const isDeployFailure = (value: unknown): value is DeployFailure =>
  typeof value === 'object' && value !== null && 'category' in value && 'report' in value;

export const createAcceptanceDeployState = (
  deps: AcceptanceDeployDeps,
  cliOptions: unknown,
  runtimeProfile: import('../runtime-env.shared.ts').RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
): AcceptanceDeployState => {
  const options = deps.resolveAcceptanceDeployOptions(env, cliOptions, runtimeProfile);
  const mutationContext = deps.assertDeterministicRemoteMutationContext(env, runtimeProfile, 'deploy');
  const migrationFiles = options.releaseMode === 'schema-and-app' ? deps.listGooseMigrationFiles() : [];

  return {
    env,
    migrationFiles,
    mutationContext,
    options,
    report: deps.createBaseAcceptanceDeployReport(runtimeProfile, env, options, migrationFiles),
    runtimeProfile,
    steps: [],
  };
};

export const failDeploy = (
  state: AcceptanceDeployState,
  category: import('../runtime-env.shared.ts').AcceptanceFailureCategory,
): never => {
  state.report = {
    ...state.report,
    steps: state.steps,
  };
  throw { category, report: state.report } satisfies DeployFailure;
};

export const createFailedReport = async (
  deps: AcceptanceDeployDeps,
  state: AcceptanceDeployState,
  error: unknown,
): Promise<AcceptanceDeployReport> => {
  const category = isDeployFailure(error) ? error.category : 'dependency';
  const partialReport = isDeployFailure(error)
    ? error.report
    : {
        ...state.report,
        steps: state.steps,
      };

  return {
    ...partialReport,
    failureCategory: category,
    releaseDecision: {
      summary: `Technische Freigabe verweigert (${category}).`,
      technicalGatePassed: false,
    },
    stackStatus: await deps.captureAcceptanceStackStatus(state.env),
    status: 'error',
  };
};
