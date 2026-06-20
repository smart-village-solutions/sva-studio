import type { AcceptanceDeployDeps, AcceptanceDeployState } from './acceptance-deploy.types.ts';
import { failDeploy } from './acceptance-deploy-state.ts';

export const runPrecheckPhase = async (deps: AcceptanceDeployDeps, state: AcceptanceDeployState) => {
  const startedAt = Date.now();
  const precheckReport = await deps.precheckAcceptance(state.runtimeProfile, state.env, state.options);
  if (precheckReport.status === 'error') {
    state.steps.push(deps.createStepResult('environment-precheck', startedAt, 'error', 'Acceptance-Precheck ist fehlgeschlagen.', { report: precheckReport }));
    state.report = { ...state.report, steps: state.steps };
    throw { category: 'config' as const, report: state.report };
  }

  state.steps.push(deps.createStepResult('environment-precheck', startedAt, 'ok', 'Acceptance-Precheck erfolgreich abgeschlossen.', { report: precheckReport }));
};

export const runImageSmokePhase = async (deps: AcceptanceDeployDeps, state: AcceptanceDeployState) => {
  if (state.mutationContext.mode === 'local-operator') {
    state.steps.push(deps.createStepResult('image-smoke', Date.now(), 'skipped', 'Lokaler Operator-Pfad verwendet den bereits in GitHub verifizierten Digest und ueberspringt den lokalen image-smoke.'));
    return;
  }

  const startedAt = Date.now();
  try {
    const imageSmokeProbes = await deps.runImageSmoke(state.env, state.options, state.report.reportId);
    state.report = { ...state.report, internalProbes: [...state.report.internalProbes, ...imageSmokeProbes] };
    state.steps.push(deps.createStepResult('image-smoke', startedAt, 'ok', 'Artefakt-Smoke erfolgreich abgeschlossen.', { probes: imageSmokeProbes }));
  } catch (error) {
    state.steps.push(deps.createStepResult('image-smoke', startedAt, 'error', error instanceof Error ? error.message : String(error)));
    failDeploy(state, 'image');
  }
};

export const runMigrationPhase = async (deps: AcceptanceDeployDeps, state: AcceptanceDeployState) => {
  const startedAt = Date.now();
  if (state.options.releaseMode !== 'schema-and-app') {
    state.report = { ...state.report, migrationReport: { details: { gooseVersion: deps.getGooseConfiguredVersion() }, status: 'skipped' } };
    state.steps.push(deps.createStepResult('migrate', startedAt, 'skipped', 'Migrationen fuer app-only ausgelassen.'));
    return;
  }

  try {
    const migrationResult = await deps.runMigrationJobAgainstAcceptance(state.env, state.runtimeProfile, state.report.reportId);
    try {
      state.report = {
        ...state.report,
        migrationReport: {
          completedAt: new Date().toISOString(),
          details: { gooseVersion: deps.getGooseConfiguredVersion(), jobState: migrationResult.state },
          job: {
            durationMs: migrationResult.durationMs,
            exitCode: migrationResult.exitCode,
            jobServiceName: migrationResult.jobServiceName,
            jobStackName: migrationResult.jobStackName,
            logTail: migrationResult.logTail,
            state: migrationResult.state,
            taskId: migrationResult.taskId,
            taskMessage: migrationResult.taskMessage,
          },
          startedAt: new Date(startedAt).toISOString(),
          status: 'ok',
        },
      };
      state.steps.push(deps.createStepResult('migrate', startedAt, 'ok', 'Acceptance-Migration erfolgreich abgeschlossen.', { jobServiceName: migrationResult.jobServiceName, jobStackName: migrationResult.jobStackName, maintenanceWindow: state.options.maintenanceWindow, migrationFiles: state.migrationFiles }));
    } finally {
      await migrationResult.cleanup();
    }
  } catch (error) {
    state.report = {
      ...state.report,
      migrationReport: {
        completedAt: new Date().toISOString(),
        details: { gooseVersion: deps.getGooseConfiguredVersion() },
        errorMessage: error instanceof Error ? error.message : String(error),
        startedAt: new Date(startedAt).toISOString(),
        status: 'error',
      },
    };
    state.steps.push(deps.createStepResult('migrate', startedAt, 'error', error instanceof Error ? error.message : String(error), { migrationFiles: state.migrationFiles }));
    failDeploy(state, 'migration');
  }
};

export const runBootstrapPhase = async (deps: AcceptanceDeployDeps, state: AcceptanceDeployState) => {
  const startedAt = Date.now();
  if (state.options.releaseMode !== 'schema-and-app') {
    state.report = { ...state.report, bootstrapReport: { status: 'skipped' } };
    state.steps.push(deps.createStepResult('bootstrap', startedAt, 'skipped', 'Bootstrap fuer app-only ausgelassen.'));
    return;
  }

  try {
    const bootstrapResult = await deps.runBootstrapJobAgainstAcceptance(state.env, state.runtimeProfile, state.report.reportId);
    try {
      const hostnameCheck = await deps.buildInstanceHostnameMappingCheck(state.runtimeProfile, state.env);
      if (hostnameCheck.status !== 'ok') {
        throw new Error(hostnameCheck.message);
      }
      const schemaGuard = deps.runSchemaGuard(state.runtimeProfile, state.env);
      if (!schemaGuard.ok) {
        throw new Error(`Kritische IAM-Schema-Drift nach Bootstrap fuer ${state.runtimeProfile}: ${deps.summarizeSchemaGuardFailures(schemaGuard)}`);
      }
      state.report = {
        ...state.report,
        bootstrapReport: {
          completedAt: new Date().toISOString(),
          details: { hostnameMapping: hostnameCheck.message, jobState: bootstrapResult.state },
          job: {
            durationMs: bootstrapResult.durationMs,
            exitCode: bootstrapResult.exitCode,
            jobServiceName: bootstrapResult.jobServiceName,
            jobStackName: bootstrapResult.jobStackName,
            logTail: bootstrapResult.logTail,
            state: bootstrapResult.state,
            taskId: bootstrapResult.taskId,
            taskMessage: bootstrapResult.taskMessage,
          },
          startedAt: new Date(startedAt).toISOString(),
          status: 'ok',
        },
      };
      state.steps.push(deps.createStepResult('bootstrap', startedAt, 'ok', 'Acceptance-Bootstrap erfolgreich abgeschlossen.', { jobServiceName: bootstrapResult.jobServiceName, jobStackName: bootstrapResult.jobStackName }));
    } finally {
      await bootstrapResult.cleanup();
    }
  } catch (error) {
    state.report = {
      ...state.report,
      bootstrapReport: {
        completedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error),
        startedAt: new Date(startedAt).toISOString(),
        status: 'error',
      },
    };
    state.steps.push(deps.createStepResult('bootstrap', startedAt, 'error', error instanceof Error ? error.message : String(error)));
    failDeploy(state, 'bootstrap');
  }
};

export const runDeployPhase = (deps: AcceptanceDeployDeps, state: AcceptanceDeployState) => {
  const startedAt = Date.now();
  try {
    deps.deployAcceptanceStack(state.env);
    state.steps.push(deps.createStepResult('deploy', startedAt, 'ok', 'Acceptance-Stack erfolgreich aktualisiert.', { imageDigest: state.options.imageDigest, imageTag: state.options.imageTag }));
  } catch (error) {
    state.steps.push(deps.createStepResult('deploy', startedAt, 'error', error instanceof Error ? error.message : String(error), { imageDigest: state.options.imageDigest, imageTag: state.options.imageTag }));
    failDeploy(state, 'startup');
  }
};
