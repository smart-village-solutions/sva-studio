import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type {
  AcceptanceDeployOptions,
  RemoteRuntimeProfile,
} from '../runtime-env.shared.ts';
import type { createRuntimeDoctorFacade } from './runtime-doctor-facade.ts';
import { createRuntimeLocalCommandOrchestrator } from './runtime-local-command-orchestrator.ts';
import { createRuntimeRemoteCommandOrchestrator } from './runtime-remote-command-orchestrator.ts';
import type { RuntimeRemoteCommandOrchestratorDeps } from './runtime-remote-command-orchestrator.types.ts';

type RuntimeOrchestratorDeps = Omit<
  RuntimeRemoteCommandOrchestratorDeps,
  'doctorRuntime' | 'precheckAcceptance'
> & {
  appLogDir: string;
  bootstrapLocalAppUser: typeof import('./local-runtime.ts').bootstrapLocalAppUser;
  buildLocalHealthUrl: typeof import('./local-runtime.ts').buildLocalHealthUrl;
  composeWithMonitoringArgs: readonly string[];
  createLocalRuntimeAuditLogger: typeof import('./rebuild-audit.ts').createLocalRuntimeAuditLogger;
  downLocalInfra: typeof import('./local-runtime.ts').downLocalInfra;
  getComposeArgs: (env: NodeJS.ProcessEnv) => readonly string[];
  getGitCommitSha: ReturnType<typeof import('./runtime-config.ts').createRuntimeConfigOps>['getGitCommitSha'];
  localStateFile: string;
  migrateLocalDatabase: typeof import('./local-runtime.ts').migrateLocalDatabase;
  pullLocalInfra: typeof import('./local-runtime.ts').pullLocalInfra;
  readLocalState: typeof import('./local-runtime.ts').readLocalState;
  rebuildAuditLogFile: string;
  resolveLocalDangerousApprovalRequirement: typeof import('./runtime-approvals.ts').resolveLocalDangerousApprovalRequirement;
  shouldAuditLocalRuntimeCommand: typeof import('./rebuild-audit.ts').shouldAuditLocalRuntimeCommand;
  startLocalApp: typeof import('./local-runtime.ts').startLocalApp;
  startLocalProvisioningWorker: typeof import('./local-runtime.ts').startLocalProvisioningWorker;
  stopLocalApp: typeof import('./local-runtime.ts').stopLocalApp;
  stopLocalProvisioningWorker: typeof import('./local-runtime.ts').stopLocalProvisioningWorker;
  syncLocalTenantSecretsToRegistry: ReturnType<typeof import('./tenant-secret-registry.ts').createTenantSecretRegistryOps>['syncLocalTenantSecretsToRegistry'];
  upLocalInfra: typeof import('./local-runtime.ts').upLocalInfra;
};

type RuntimeDoctorFacadeRef = {
  current: ReturnType<typeof createRuntimeDoctorFacade> | null;
};

const requireRuntimeDoctorFacade = (runtimeDoctorFacade: RuntimeDoctorFacadeRef) => {
  if (!runtimeDoctorFacade.current) {
    throw new Error('Runtime-Doctor-Fassade ist noch nicht initialisiert.');
  }
  return runtimeDoctorFacade.current;
};

const remoteCommandCoreDeps = (deps: RuntimeOrchestratorDeps) => ({
  acceptanceRemoteStateOps: deps.acceptanceRemoteStateOps,
  applyCliOptionEnvOverrides: deps.applyCliOptionEnvOverrides,
  assertComposeServiceIngressLabels: deps.assertComposeServiceIngressLabels,
  assertComposeServiceNetworks: deps.assertComposeServiceNetworks,
  assertDangerousOperationApproved: deps.assertDangerousOperationApproved,
  assertDeterministicRemoteMutationContext: deps.assertDeterministicRemoteMutationContext,
  assertRuntimeEnv: deps.assertRuntimeEnv,
  buildAcceptanceReportPaths: deps.buildAcceptanceReportPaths,
  buildProfileEnv: deps.buildProfileEnv,
  buildQuantumDeployComposeDocument: deps.buildQuantumDeployComposeDocument,
  buildTrustedForwardedHeaders: deps.buildTrustedForwardedHeaders,
  checkHttpHealth: deps.checkHttpHealth,
  cliOptions: deps.cliOptions,
  commandExists: deps.commandExists,
  createStepResult: deps.createStepResult,
  deployReportDir: deps.deployReportDir,
  ensureDirs: deps.ensureDirs,
  jsonOutput: deps.jsonOutput,
  rootDir: deps.rootDir,
});

const remoteCommandDoctorDeps = (deps: RuntimeOrchestratorDeps) => ({
  buildGuardrailDoctorChecks: deps.buildGuardrailDoctorChecks,
  buildImagePlatformDoctorCheck: deps.buildImagePlatformDoctorCheck,
  buildLocalProvisioningWorkerCheckBase: deps.buildLocalProvisioningWorkerCheckBase,
  buildStudioImageVerifyEvidenceCheck: deps.buildStudioImageVerifyEvidenceCheck,
  collectLocalInstanceIdentityDrift: deps.collectLocalInstanceIdentityDrift,
  createDbSqlRunner: deps.createDbSqlRunner,
  decorateDoctorCheck: deps.decorateDoctorCheck,
  finalizeDoctorReport: deps.finalizeDoctorReport,
  getGitCommitSha: deps.getGitCommitSha,
  getRuntimeContractSummary: deps.getRuntimeContractSummary,
  getRuntimeProfileDefinition: deps.getRuntimeProfileDefinition,
  getRuntimeProfileDerivedEnvKeys: deps.getRuntimeProfileDerivedEnvKeys,
  getRuntimeProfileRequiredEnvKeys: deps.getRuntimeProfileRequiredEnvKeys,
  isMainserverCheckRequired: deps.isMainserverCheckRequired,
  isMigrationStatusCheckRequired: deps.isMigrationStatusCheckRequired,
  isMockAuthRuntimeProfile: deps.isMockAuthRuntimeProfile,
  isProcessAlive: deps.isProcessAlive,
  listGooseMigrationFiles: deps.listGooseMigrationFiles,
  loadActiveLocalTenantSecretStates: deps.loadActiveLocalTenantSecretStates,
  localWorkerStateFile: deps.localWorkerStateFile,
  readLocalWorkerState: deps.readLocalWorkerState,
  runLocalGooseStatus: deps.runLocalGooseStatus,
  summarizeSchemaGuardFailures: deps.summarizeSchemaGuardFailures,
  toDoctorCheck: deps.toDoctorCheck,
  validateRuntimeProfileEnv: deps.validateRuntimeProfileEnv,
  verifyDbSchemaSnapshot: deps.verifyDbSchemaSnapshot,
  verifyLocalDbSchemaSnapshot: deps.verifyLocalDbSchemaSnapshot,
});

const remoteCommandRuntimeDeps = (deps: RuntimeOrchestratorDeps) => ({
  buildProdParityProbePlan: deps.buildProdParityProbePlan,
  getConfiguredQuantumEndpoint: deps.getConfiguredQuantumEndpoint,
  getConfiguredStackName: deps.getConfiguredStackName,
  getGooseConfiguredVersion: deps.getGooseConfiguredVersion,
  getRemoteAppServiceName: deps.getRemoteAppServiceName,
  getRemoteComposeFile: deps.getRemoteComposeFile,
  getRuntimeStatusExecutionMode: deps.getRuntimeStatusExecutionMode,
  hasLocalEmergencyRemoteMutationOverride: deps.hasLocalEmergencyRemoteMutationOverride,
  inspectRemoteServiceContract: deps.inspectRemoteServiceContract,
  isExpectedOidcRedirect: deps.isExpectedOidcRedirect,
  isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
  localInstanceOps: deps.localInstanceOps,
  parseInstanceIdList: deps.parseInstanceIdList,
  parseJsonFromCommandOutput: deps.parseJsonFromCommandOutput,
  parseRuntimeProfile: deps.parseRuntimeProfile,
  printDoctorReport: deps.printDoctorReport,
  printJsonIfRequested: deps.printJsonIfRequested,
  resolveAcceptanceDeployOptions: deps.resolveAcceptanceDeployOptions,
  resolveRemoteDangerousApprovalRequirement: deps.resolveRemoteDangerousApprovalRequirement,
  run: deps.run,
  runCapture: deps.runCapture,
  runCaptureDetailed: deps.runCaptureDetailed,
  runHttpProbe: deps.runHttpProbe,
  runQuantumExec: deps.runQuantumExec,
  runtimeArtifactsDir: deps.runtimeArtifactsDir,
  shouldCheckLocalInstanceRegistryDriftBeforeCommand: deps.shouldCheckLocalInstanceRegistryDriftBeforeCommand,
  shouldRunLocalProvisioningWorker: deps.shouldRunLocalProvisioningWorker,
  shouldSkipQuantumPrePull: deps.shouldSkipQuantumPrePull,
  sqlIdentifier: deps.sqlIdentifier,
  sqlLiteral: deps.sqlLiteral,
  summarizeProcessOutput: deps.summarizeProcessOutput,
  tenantSecretRegistryOps: deps.tenantSecretRegistryOps,
  wait: deps.wait,
  withoutDebugEnv: deps.withoutDebugEnv,
});

const createRemoteCommandRuntime = (
  deps: RuntimeOrchestratorDeps,
  doctorRuntime: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Promise<Awaited<ReturnType<ReturnType<typeof createRuntimeDoctorFacade>['doctorRuntime']>>>,
  precheckAcceptance: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv, options?: AcceptanceDeployOptions) => ReturnType<ReturnType<typeof createRuntimeDoctorFacade>['precheckAcceptance']>,
) =>
  createRuntimeRemoteCommandOrchestrator({
    ...remoteCommandCoreDeps(deps),
    ...remoteCommandDoctorDeps(deps),
    ...remoteCommandRuntimeDeps(deps),
    doctorRuntime,
    precheckAcceptance,
  });

const createLocalCommandRuntime = (
  deps: RuntimeOrchestratorDeps,
  remoteCommandOrchestrator: ReturnType<typeof createRuntimeRemoteCommandOrchestrator>,
  doctorRuntime: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Promise<Awaited<ReturnType<ReturnType<typeof createRuntimeDoctorFacade>['doctorRuntime']>>>,
) =>
  createRuntimeLocalCommandOrchestrator({
    appLogDir: deps.appLogDir,
    assertDangerousOperationApproved: deps.assertDangerousOperationApproved,
    assertRuntimeEnv: deps.assertRuntimeEnv,
    bootstrapLocalAppUser: deps.bootstrapLocalAppUser,
    buildLocalHealthUrl: deps.buildLocalHealthUrl,
    buildProfileEnv: deps.buildProfileEnv,
    cliOptions: deps.cliOptions,
    composeWithMonitoringArgs: deps.composeWithMonitoringArgs,
    createLocalRuntimeAuditLogger: (input) => deps.createLocalRuntimeAuditLogger(input as never),
    doctorRuntime,
    downLocalInfra: deps.downLocalInfra,
    getComposeArgs: deps.getComposeArgs,
    getGitCommitSha: deps.getGitCommitSha,
    jsonOutput: deps.jsonOutput,
    localInstanceOps: deps.localInstanceOps,
    localStateFile: deps.localStateFile,
    localWorkerStateFile: deps.localWorkerStateFile,
    migrateLocalDatabase: deps.migrateLocalDatabase,
    printDoctorReport: deps.printDoctorReport,
    pullLocalInfra: deps.pullLocalInfra,
    readLocalState: deps.readLocalState,
    readLocalWorkerState: deps.readLocalWorkerState,
    rebuildAuditLogFile: deps.rebuildAuditLogFile,
    resolveLocalDangerousApprovalRequirement: deps.resolveLocalDangerousApprovalRequirement,
    rootDir: deps.rootDir,
    run: deps.run,
    runSchemaGuard: remoteCommandOrchestrator.runSchemaGuard,
    shouldAuditLocalRuntimeCommand: deps.shouldAuditLocalRuntimeCommand,
    shouldRunLocalProvisioningWorker: deps.shouldRunLocalProvisioningWorker,
    smokeRuntime: remoteCommandOrchestrator.smokeRuntime,
    startLocalApp: deps.startLocalApp,
    startLocalProvisioningWorker: deps.startLocalProvisioningWorker,
    stopLocalApp: deps.stopLocalApp,
    stopLocalProvisioningWorker: deps.stopLocalProvisioningWorker,
    summarizeSchemaGuardFailures: deps.summarizeSchemaGuardFailures,
    syncLocalTenantSecretsToRegistry: deps.syncLocalTenantSecretsToRegistry,
    upLocalInfra: deps.upLocalInfra,
    verifyLocalDbSchemaSnapshot: deps.verifyLocalDbSchemaSnapshot,
  });

export const createRuntimeOrchestrator = (deps: RuntimeOrchestratorDeps) => {
  const runtimeDoctorFacade: RuntimeDoctorFacadeRef = { current: null };
  const precheckAcceptance = (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv, options?: AcceptanceDeployOptions) =>
    requireRuntimeDoctorFacade(runtimeDoctorFacade).precheckAcceptance(runtimeProfile, env, options);
  const doctorRuntime = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    requireRuntimeDoctorFacade(runtimeDoctorFacade).doctorRuntime(runtimeProfile, env);
  const remoteCommandOrchestrator = createRemoteCommandRuntime(deps, doctorRuntime, precheckAcceptance);
  runtimeDoctorFacade.current = remoteCommandOrchestrator.runtimeDoctorFacade;
  const localCommandOrchestrator = createLocalCommandRuntime(deps, remoteCommandOrchestrator, doctorRuntime);
  return {
    doctorRuntime,
    runAcceptanceCommand: remoteCommandOrchestrator.runAcceptanceCommand,
    runLocalCommand: localCommandOrchestrator.runLocalCommand,
    runtimeEnvRemoteVerification: {
      ...remoteCommandOrchestrator.runtimeEnvRemoteVerification,
      repairLocalRuntimeWithDeps: localCommandOrchestrator.repairLocalRuntimeWithDeps,
    },
    runtimeEnvSmokeWarmup: remoteCommandOrchestrator.runtimeEnvSmokeWarmup,
  };
};
