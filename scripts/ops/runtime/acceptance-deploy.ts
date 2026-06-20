import { createAcceptanceDeployState, createFailedReport } from './acceptance-deploy-state.ts';
import {
  runBootstrapPhase,
  runDeployPhase,
  runImageSmokePhase,
  runMigrationPhase,
  runPrecheckPhase,
} from './acceptance-deploy-phases.ts';
import { finalizeSuccessfulDeploy, runExternalSmokePhase, runInternalVerifyPhase } from './acceptance-deploy-finalize.ts';
import type { AcceptanceDeployDeps } from './acceptance-deploy.types.ts';

export const createAcceptanceDeployRunner = (deps: AcceptanceDeployDeps, cliOptions: unknown = {}) => {
  return async (runtimeProfile: import('../runtime-env.shared.ts').RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => {
    const state = createAcceptanceDeployState(deps, cliOptions, runtimeProfile, env);

    try {
      await runPrecheckPhase(deps, state);
      await runImageSmokePhase(deps, state);
      await runMigrationPhase(deps, state);
      await runBootstrapPhase(deps, state);
      runDeployPhase(deps, state);
      await deps.waitForPostDeployStabilization(state.env);
      await runInternalVerifyPhase(deps, state);
      await runExternalSmokePhase(deps, state);
      await finalizeSuccessfulDeploy(deps, state);
    } catch (error) {
      const failedReport = await createFailedReport(deps, state, error);
      deps.writeAcceptanceDeployReport(failedReport);
      deps.printJsonIfRequested(failedReport);
      throw new Error(`Acceptance-Deploy fehlgeschlagen (${failedReport.failureCategory}). Bericht: ${failedReport.artifacts.markdownPath}`, {
        cause: error,
      });
    }
  };
};
