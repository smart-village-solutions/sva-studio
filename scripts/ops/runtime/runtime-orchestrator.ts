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

export const createRuntimeOrchestrator = (deps: RuntimeOrchestratorDeps) => {
  let runtimeDoctorFacade: ReturnType<typeof createRuntimeDoctorFacade> | null = null;

  const precheckAcceptance = (
    runtimeProfile: RemoteRuntimeProfile,
    env: NodeJS.ProcessEnv,
    options?: AcceptanceDeployOptions,
  ) => {
    if (!runtimeDoctorFacade) {
      throw new Error('Runtime-Doctor-Fassade ist noch nicht initialisiert.');
    }

    return runtimeDoctorFacade.precheckAcceptance(runtimeProfile, env, options);
  };

  const doctorRuntime = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
    if (!runtimeDoctorFacade) {
      throw new Error('Runtime-Doctor-Fassade ist noch nicht initialisiert.');
    }

    return runtimeDoctorFacade.doctorRuntime(runtimeProfile, env);
  };

  const remoteCommandOrchestrator = createRuntimeRemoteCommandOrchestrator({
    acceptanceRemoteStateOps: deps.acceptanceRemoteStateOps,
    applyCliOptionEnvOverrides: deps.applyCliOptionEnvOverrides,
    assertComposeServiceIngressLabels: deps.assertComposeServiceIngressLabels,
    assertComposeServiceNetworks: deps.assertComposeServiceNetworks,
    assertDangerousOperationApproved: deps.assertDangerousOperationApproved,
    assertDeterministicRemoteMutationContext: deps.assertDeterministicRemoteMutationContext,
    assertRuntimeEnv: deps.assertRuntimeEnv,
    buildAcceptanceReportPaths: deps.buildAcceptanceReportPaths,
    buildGuardrailDoctorChecks: deps.buildGuardrailDoctorChecks,
    buildImagePlatformDoctorCheck: deps.buildImagePlatformDoctorCheck,
    buildLocalProvisioningWorkerCheckBase: deps.buildLocalProvisioningWorkerCheckBase,
    buildProfileEnv: deps.buildProfileEnv,
    buildProdParityProbePlan: deps.buildProdParityProbePlan,
    buildQuantumDeployComposeDocument: deps.buildQuantumDeployComposeDocument,
    buildStudioImageVerifyEvidenceCheck: deps.buildStudioImageVerifyEvidenceCheck,
    buildTrustedForwardedHeaders: deps.buildTrustedForwardedHeaders,
    checkHttpHealth: deps.checkHttpHealth,
    cliOptions: deps.cliOptions,
    collectLocalInstanceIdentityDrift: deps.collectLocalInstanceIdentityDrift,
    commandExists: deps.commandExists,
    createDbSqlRunner: deps.createDbSqlRunner,
    createStepResult: deps.createStepResult,
    decorateDoctorCheck: deps.decorateDoctorCheck,
    deployReportDir: deps.deployReportDir,
    doctorRuntime,
    ensureDirs: deps.ensureDirs,
    finalizeDoctorReport: deps.finalizeDoctorReport,
    getConfiguredQuantumEndpoint: deps.getConfiguredQuantumEndpoint,
    getConfiguredStackName: deps.getConfiguredStackName,
    getGooseConfiguredVersion: deps.getGooseConfiguredVersion,
    getRemoteAppServiceName: deps.getRemoteAppServiceName,
    getRemoteComposeFile: deps.getRemoteComposeFile,
    getRuntimeContractSummary: deps.getRuntimeContractSummary,
    getRuntimeProfileDefinition: deps.getRuntimeProfileDefinition,
    getRuntimeProfileDerivedEnvKeys: deps.getRuntimeProfileDerivedEnvKeys,
    getRuntimeProfileRequiredEnvKeys: deps.getRuntimeProfileRequiredEnvKeys,
    getRuntimeStatusExecutionMode: deps.getRuntimeStatusExecutionMode,
    hasLocalEmergencyRemoteMutationOverride: deps.hasLocalEmergencyRemoteMutationOverride,
    inspectRemoteServiceContract: deps.inspectRemoteServiceContract,
    isExpectedOidcRedirect: deps.isExpectedOidcRedirect,
    isMainserverCheckRequired: deps.isMainserverCheckRequired,
    isMigrationStatusCheckRequired: deps.isMigrationStatusCheckRequired,
    isMockAuthRuntimeProfile: deps.isMockAuthRuntimeProfile,
    isProcessAlive: deps.isProcessAlive,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    jsonOutput: deps.jsonOutput,
    listGooseMigrationFiles: deps.listGooseMigrationFiles,
    loadActiveLocalTenantSecretStates: deps.loadActiveLocalTenantSecretStates,
    localInstanceOps: deps.localInstanceOps,
    localWorkerStateFile: deps.localWorkerStateFile,
    parseInstanceIdList: deps.parseInstanceIdList,
    parseJsonFromCommandOutput: deps.parseJsonFromCommandOutput,
    parseRuntimeProfile: deps.parseRuntimeProfile,
    precheckAcceptance,
    printDoctorReport: deps.printDoctorReport,
    printJsonIfRequested: deps.printJsonIfRequested,
    readLocalWorkerState: deps.readLocalWorkerState,
    resolveAcceptanceDeployOptions: deps.resolveAcceptanceDeployOptions,
    resolveRemoteDangerousApprovalRequirement: deps.resolveRemoteDangerousApprovalRequirement,
    rootDir: deps.rootDir,
    run: deps.run,
    runCapture: deps.runCapture,
    runCaptureDetailed: deps.runCaptureDetailed,
    runHttpProbe: deps.runHttpProbe,
    runLocalGooseStatus: deps.runLocalGooseStatus,
    runQuantumExec: deps.runQuantumExec,
    runtimeArtifactsDir: deps.runtimeArtifactsDir,
    shouldCheckLocalInstanceRegistryDriftBeforeCommand: deps.shouldCheckLocalInstanceRegistryDriftBeforeCommand,
    shouldRunLocalProvisioningWorker: deps.shouldRunLocalProvisioningWorker,
    shouldSkipQuantumPrePull: deps.shouldSkipQuantumPrePull,
    sqlIdentifier: deps.sqlIdentifier,
    sqlLiteral: deps.sqlLiteral,
    summarizeProcessOutput: deps.summarizeProcessOutput,
    summarizeSchemaGuardFailures: deps.summarizeSchemaGuardFailures,
    tenantSecretRegistryOps: deps.tenantSecretRegistryOps,
    toDoctorCheck: deps.toDoctorCheck,
    validateRuntimeProfileEnv: deps.validateRuntimeProfileEnv,
    verifyDbSchemaSnapshot: deps.verifyDbSchemaSnapshot,
    verifyLocalDbSchemaSnapshot: deps.verifyLocalDbSchemaSnapshot,
    wait: deps.wait,
    withoutDebugEnv: deps.withoutDebugEnv,
  });
  runtimeDoctorFacade = remoteCommandOrchestrator.runtimeDoctorFacade;

  const localCommandOrchestrator = createRuntimeLocalCommandOrchestrator({
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
