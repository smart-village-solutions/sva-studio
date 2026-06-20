import { createAcceptanceProbeResult } from './acceptance-probe.ts';
import {
  buildSwarmServicePresenceProbe as buildSwarmServicePresenceProbeInput,
  captureAcceptanceStackStatus as captureAcceptanceStackStatusWithDeps,
  migrateAcceptance as migrateAcceptanceWithDeps,
  resetAcceptance as resetAcceptanceWithDeps,
  resolveRemoteInternalNetworkName as resolveRemoteInternalNetworkNameWithDeps,
  runAcceptanceServiceScript as runAcceptanceServiceScriptWithDeps,
  runAcceptanceSqlAgainstDatabase as runAcceptanceSqlAgainstDatabaseWithDeps,
} from './acceptance-maintenance-remote.ts';
import {
  createBaseAcceptanceDeployReport as createBaseAcceptanceDeployReportWithDeps,
  deployAcceptanceStack as deployAcceptanceStackWithDeps,
  renderRemoteComposeDocument as renderRemoteComposeDocumentWithDeps,
  writeAcceptanceDeployReport as writeAcceptanceDeployReportImpl,
} from './acceptance-maintenance-report.ts';
import type { AcceptanceMaintenanceDeps } from './acceptance-maintenance.types.ts';

export const createAcceptanceMaintenanceOps = (deps: AcceptanceMaintenanceDeps) => {
  const createProbeResult = createAcceptanceProbeResult;

  return {
    buildSwarmServicePresenceProbe: (env: NodeJS.ProcessEnv) => createProbeResult(buildSwarmServicePresenceProbeInput(deps, env)),
    captureAcceptanceStackStatus: (env: NodeJS.ProcessEnv) => captureAcceptanceStackStatusWithDeps(deps, env),
    createBaseAcceptanceDeployReport: (
      runtimeProfile: import('../runtime-env.shared.ts').RemoteRuntimeProfile,
      env: NodeJS.ProcessEnv,
      options: import('../runtime-env.shared.ts').AcceptanceDeployOptions,
      migrationFiles: readonly string[],
      gitCommitSha?: string,
    ) => createBaseAcceptanceDeployReportWithDeps(deps, { env, gitCommitSha, migrationFiles, options, runtimeProfile }),
    deployAcceptanceStack: (env: NodeJS.ProcessEnv) => deployAcceptanceStackWithDeps(deps, env),
    migrateAcceptance: (
      runtimeProfile: import('../runtime-env.shared.ts').RemoteRuntimeProfile,
      env: NodeJS.ProcessEnv,
    ) => migrateAcceptanceWithDeps(deps, runtimeProfile, env),
    renderRemoteComposeDocument: (env: NodeJS.ProcessEnv) => renderRemoteComposeDocumentWithDeps(deps, env),
    resetAcceptance: (
      runtimeProfile: import('../runtime-env.shared.ts').RemoteRuntimeProfile,
      env: NodeJS.ProcessEnv,
      verifyPostReset: () => Promise<void>,
    ) => resetAcceptanceWithDeps(deps, runtimeProfile, env, verifyPostReset),
    resolveRemoteInternalNetworkName: (env: NodeJS.ProcessEnv) => resolveRemoteInternalNetworkNameWithDeps(deps, env),
    runAcceptanceServiceScript: (
      env: NodeJS.ProcessEnv,
      service: string,
      script: string,
      options: { failureMessage: string; marker?: string; slot?: string },
    ) => runAcceptanceServiceScriptWithDeps(deps, env, service, script, options),
    runAcceptanceSqlAgainstDatabase: (env: NodeJS.ProcessEnv, sql: string, database: string, failureMessage: string) =>
      runAcceptanceSqlAgainstDatabaseWithDeps(deps, env, sql, database, failureMessage),
    writeAcceptanceDeployReport: writeAcceptanceDeployReportImpl,
  } as const;
};
