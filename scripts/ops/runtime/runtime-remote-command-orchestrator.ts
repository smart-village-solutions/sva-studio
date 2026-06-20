import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type {
  AcceptanceDeployOptions,
  AcceptanceProbeResult,
  DoctorCheck,
  DoctorReport,
  RemoteRuntimeProfile,
} from '../runtime-env.shared.ts';
import { deriveInternalVerifyMaxAttempts, shouldRetryExternalSmoke, shouldRetryInternalProbeFailure, shouldRetryInternalVerify, shouldRetryInternalVerifyAttempt } from './smoke.ts';
import { createAcceptanceProbeResult } from './acceptance-probe.ts';
import { createAcceptanceRuntimeCore } from './acceptance-runtime-facade.ts';
import { createAcceptanceCommandRunner } from './acceptance-command.ts';
import { mergeExplicitTenantTargetsWithRegistry, parseTenantRealmOverrides } from './remote-verification.ts';
import { createRuntimeRemoteBundle } from './runtime-remote-bundle.ts';
import type { SchemaGuardReport } from '../../../packages/auth-runtime/src/iam-account-management/schema-guard.ts';
import type { RuntimeRemoteCommandOrchestratorDeps } from './runtime-remote-command-orchestrator.types.ts';

export const createRuntimeRemoteCommandOrchestrator = (deps: RuntimeRemoteCommandOrchestratorDeps) => {
  const acceptanceRuntimeCore = createAcceptanceRuntimeCore({
    acceptanceRemoteStateOps: deps.acceptanceRemoteStateOps,
    assertComposeServiceIngressLabels: deps.assertComposeServiceIngressLabels,
    assertComposeServiceNetworks: deps.assertComposeServiceNetworks,
    assertDeterministicRemoteMutationContext: deps.assertDeterministicRemoteMutationContext,
    buildAcceptanceReportPaths: deps.buildAcceptanceReportPaths,
    buildInstanceHostnameMappingCheck: async (runtimeProfile, env) =>
      runtimeDoctorDbCheckOps.buildInstanceHostnameMappingCheck(runtimeProfile, env),
    buildProdParityProbePlan: deps.buildProdParityProbePlan,
    buildQuantumDeployComposeDocument: deps.buildQuantumDeployComposeDocument,
    buildTrustedForwardedHeaders: deps.buildTrustedForwardedHeaders,
    checkHttpHealth: deps.checkHttpHealth,
    cliOptions: deps.cliOptions,
    commandExists: deps.commandExists,
    createBaseAcceptanceDeployReport: (_runtimeProfile, _env, _options, _migrationFiles) => {
      throw new Error('createBaseAcceptanceDeployReport ist erst nach Maintenance-Wiring verfuegbar.');
    },
    createProbeResult: createAcceptanceProbeResult as never,
    createStepResult: deps.createStepResult,
    deployReportDir: deps.deployReportDir,
    ensureDirs: deps.ensureDirs,
    getConfiguredQuantumEndpoint: deps.getConfiguredQuantumEndpoint,
    getConfiguredStackName: deps.getConfiguredStackName,
    getGooseConfiguredVersion: deps.getGooseConfiguredVersion,
    getRemoteAppServiceName: deps.getRemoteAppServiceName,
    getRemoteComposeFile: deps.getRemoteComposeFile,
    getRuntimeContractSummary: deps.getRuntimeContractSummary,
    getRuntimeProfileDerivedEnvKeys: deps.getRuntimeProfileDerivedEnvKeys,
    getRuntimeProfileRequiredEnvKeys: deps.getRuntimeProfileRequiredEnvKeys,
    hasLocalEmergencyRemoteMutationOverride: deps.hasLocalEmergencyRemoteMutationOverride,
    inspectRemoteServiceContract: (env, input) =>
      deps.inspectRemoteServiceContract(
        {
          commandExists: deps.commandExists,
          runCapture: deps.runCapture,
        },
        env,
        input,
      ),
    isExpectedOidcRedirect: deps.isExpectedOidcRedirect,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    jsonOutput: deps.jsonOutput,
    listGooseMigrationFiles: deps.listGooseMigrationFiles,
    parseJsonFromCommandOutput: deps.parseJsonFromCommandOutput,
    parseRuntimeProfile: (value) => deps.parseRuntimeProfile(value) ?? undefined,
    precheckAcceptance: async () => {
      throw new Error('precheckAcceptance ist noch nicht initialisiert.');
    },
    printJsonIfRequested: deps.printJsonIfRequested,
    resolveAcceptanceDeployOptions: (env, _cliOptions, runtimeProfile) =>
      deps.resolveAcceptanceDeployOptions(env, deps.cliOptions, runtimeProfile),
    rootDir: deps.rootDir,
    run: deps.run,
    runCapture: deps.runCapture,
    runCaptureDetailed: deps.runCaptureDetailed,
    runExternalSmokeWithWarmup: async () => [] as const,
    runHttpProbe: deps.runHttpProbe,
    runImageSmoke: async () => [] as const,
    runInternalVerify: async () => {
      throw new Error('runInternalVerify ist noch nicht initialisiert.');
    },
    runQuantumExec: deps.runQuantumExec,
    runSchemaGuard: (runtimeProfile, env) => runtimeDoctorDbCheckOps.runSchemaGuard(runtimeProfile, env),
    shouldSkipQuantumPrePull: deps.shouldSkipQuantumPrePull,
    summarizeProcessOutput: (result) => deps.summarizeProcessOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`),
    summarizeSchemaGuardFailures: deps.summarizeSchemaGuardFailures,
    toDoctorCheck: deps.toDoctorCheck,
    wait: async (ms) => {
      await deps.wait(ms);
    },
    waitForPostDeployStabilization: async () => 0,
    withoutDebugEnv: deps.withoutDebugEnv,
    writeAcceptanceDeployReport: () => {
      throw new Error('writeAcceptanceDeployReport ist erst nach Maintenance-Wiring verfuegbar.');
    },
  });

  const remoteBundle = createRuntimeRemoteBundle({
    acceptanceRemoteStateOps: deps.acceptanceRemoteStateOps,
    acceptanceRuntimeCore,
    assertComposeServiceIngressLabels: deps.assertComposeServiceIngressLabels as never,
    assertComposeServiceNetworks: deps.assertComposeServiceNetworks as never,
    assertDeterministicRemoteMutationContext: deps.assertDeterministicRemoteMutationContext,
    assertRuntimeEnv: deps.assertRuntimeEnv,
    buildAcceptanceReportPaths: deps.buildAcceptanceReportPaths,
    buildGuardrailDoctorChecks: deps.buildGuardrailDoctorChecks,
    buildImagePlatformDoctorCheck: deps.buildImagePlatformDoctorCheck,
    buildLocalProvisioningWorkerCheckBase: deps.buildLocalProvisioningWorkerCheckBase as never,
    buildProdParityProbePlan: deps.buildProdParityProbePlan,
    buildQuantumDeployComposeDocument: deps.buildQuantumDeployComposeDocument as never,
    buildStudioImageVerifyEvidenceCheck: deps.buildStudioImageVerifyEvidenceCheck,
    buildTrustedForwardedHeaders: deps.buildTrustedForwardedHeaders,
    buildLocalInstanceRegistryReconciliationInput: deps.localInstanceOps.buildLocalInstanceRegistryReconciliationInput,
    checkHttpHealth: deps.checkHttpHealth,
    cliOptions: deps.cliOptions,
    collectLocalInstanceIdentityDrift: deps.collectLocalInstanceIdentityDrift,
    commandExists: deps.commandExists,
    createDbSqlRunner: deps.createDbSqlRunner,
    createProbeResult: createAcceptanceProbeResult as never,
    createStepResult: deps.createStepResult,
    deployReportDir: deps.deployReportDir,
    doctorRuntime: deps.doctorRuntime,
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
    hasLocalEmergencyRemoteMutationOverride: deps.hasLocalEmergencyRemoteMutationOverride,
    inspectRemoteServiceContract: (env, input) =>
      deps.inspectRemoteServiceContract(
        {
          commandExists: deps.commandExists,
          runCapture: deps.runCapture,
        },
        env,
        input,
      ),
    isExpectedOidcRedirect: deps.isExpectedOidcRedirect,
    isMainserverCheckRequired: deps.isMainserverCheckRequired,
    isMigrationStatusCheckRequired: deps.isMigrationStatusCheckRequired,
    isMockAuthRuntimeProfile: deps.isMockAuthRuntimeProfile,
    isProcessAlive: deps.isProcessAlive,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    jsonOutput: deps.jsonOutput,
    listGooseMigrationFiles: deps.listGooseMigrationFiles,
    loadActiveLocalTenantSecretStates: deps.loadActiveLocalTenantSecretStates as never,
    loadRegistryTenantTargets: deps.tenantSecretRegistryOps.loadRegistryTenantTargets,
    localWorkerStateFile: deps.localWorkerStateFile,
    parseInstanceIdList: deps.parseInstanceIdList,
    parseJsonFromCommandOutput: deps.parseJsonFromCommandOutput,
    parseRuntimeProfile: (value) => deps.parseRuntimeProfile(value) ?? undefined,
    precheckAcceptance: deps.precheckAcceptance,
    printJsonIfRequested: deps.printJsonIfRequested,
    readLocalWorkerState: deps.readLocalWorkerState,
    resolveAcceptanceDeployOptions: (env, _cliOptions, runtimeProfile) =>
      deps.resolveAcceptanceDeployOptions(env, deps.cliOptions, runtimeProfile),
    rootDir: deps.rootDir,
    run: deps.run,
    runCapture: deps.runCapture,
    runCaptureDetailed: deps.runCaptureDetailed,
    runHttpProbe: deps.runHttpProbe,
    runLocalGooseStatus: deps.runLocalGooseStatus,
    runQuantumExec: deps.runQuantumExec,
    runSchemaGuard: (runtimeProfile, env) => runtimeDoctorDbCheckOps.runSchemaGuard(runtimeProfile, env),
    runtimeArtifactsDir: deps.runtimeArtifactsDir,
    shouldSkipQuantumPrePull: deps.shouldSkipQuantumPrePull,
    sqlIdentifier: deps.sqlIdentifier,
    sqlLiteral: deps.sqlLiteral,
    summarizeProcessOutput: deps.summarizeProcessOutput,
    summarizeSchemaGuardFailures: deps.summarizeSchemaGuardFailures,
    toDoctorCheck: deps.toDoctorCheck,
    validateRuntimeProfileEnv: deps.validateRuntimeProfileEnv,
    verifyLocalDbSchemaSnapshot: deps.verifyLocalDbSchemaSnapshot as never,
    wait: deps.wait,
    withoutDebugEnv: deps.withoutDebugEnv,
  });

  const {
    runAcceptanceDeploy,
    runtimeDoctorDbCheckOps,
    runtimeDoctorFacade,
    runtimeHealthOps,
    runtimeRemoteVerificationOps,
    runtimeSmokeOps,
  } = remoteBundle;
  const runSchemaGuard = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    runtimeDoctorDbCheckOps.runSchemaGuard(runtimeProfile, env);

  const smokeRuntime = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    runtimeHealthOps.smokeRuntime(runtimeProfile, env);

  const runtimeEnvRemoteVerification = {
    assertLoginFlow: runtimeHealthOps.assertLoginFlow,
    buildKeycloakClientSecretCheck: runtimeHealthOps.buildKeycloakClientSecretCheck,
    buildLocalProvisioningWorkerCheck: deps.buildLocalProvisioningWorkerCheckBase,
    buildStudioImageVerifyEvidenceCheck: deps.buildStudioImageVerifyEvidenceCheck,
    decorateDoctorCheck: deps.decorateDoctorCheck,
    mergeExplicitTenantTargetsWithRegistry,
    parseTenantRealmOverrides,
    readStudioImageVerifyEvidence: runtimeRemoteVerificationOps.readStudioImageVerifyEvidence,
    requireLocalInstanceRegistryReconciliationInput: deps.localInstanceOps.requireLocalInstanceRegistryReconciliationInput,
    resolveTenantRuntimeTargets: runtimeRemoteVerificationOps.resolveTenantRuntimeTargets,
    selectReleaseBlockingTenantTargets: runtimeRemoteVerificationOps.selectReleaseBlockingTenantTargets,
    selectSmokeTenantTargets: runtimeRemoteVerificationOps.selectSmokeTenantTargets,
    shouldCheckLocalInstanceRegistryDriftBeforeCommand: deps.shouldCheckLocalInstanceRegistryDriftBeforeCommand,
    shouldRunLocalProvisioningWorker: deps.shouldRunLocalProvisioningWorker,
    tryReadGithubStudioImageVerifyEvidence: runtimeRemoteVerificationOps.tryReadGithubStudioImageVerifyEvidence,
    verifyDbSchemaSnapshot: deps.verifyDbSchemaSnapshot,
    waitForPostDeployStabilization: runtimeRemoteVerificationOps.waitForPostDeployStabilization,
  } as const;

  const runtimeEnvSmokeWarmup = {
    deriveInternalVerifyMaxAttempts,
    runExternalSmokeWithWarmup: runtimeSmokeOps.runExternalSmokeWithWarmup,
    shouldRetryExternalSmoke,
    shouldRetryInternalProbeFailure,
    shouldRetryInternalVerify,
    shouldRetryInternalVerifyAttempt,
    waitForRemoteSmokeWarmup: runtimeSmokeOps.waitForRemoteSmokeWarmup,
  } as const;

  const runAcceptanceCommand = createAcceptanceCommandRunner({
    applyCliOptionEnvOverrides: deps.applyCliOptionEnvOverrides,
    assertDangerousOperationApproved: deps.assertDangerousOperationApproved,
    assertDeterministicRemoteMutationContext: deps.assertDeterministicRemoteMutationContext,
    assertRuntimeEnv: deps.assertRuntimeEnv,
    buildProfileEnv: deps.buildProfileEnv,
    cliOptions: deps.cliOptions,
    doctorRuntime: deps.doctorRuntime,
    getConfiguredStackName: deps.getConfiguredStackName,
    getRuntimeStatusExecutionMode: deps.getRuntimeStatusExecutionMode,
    migrateAcceptance: acceptanceRuntimeCore.migrateAcceptance,
    precheckAcceptance: deps.precheckAcceptance,
    printDoctorReport: deps.printDoctorReport,
    readRemoteStackEvidence: deps.acceptanceRemoteStateOps.readRemoteStackEvidence,
    resetAcceptance: acceptanceRuntimeCore.resetAcceptance,
    resolveRemoteDangerousApprovalRequirement: deps.resolveRemoteDangerousApprovalRequirement,
    rootDir: deps.rootDir,
    run: deps.run,
    runAcceptanceDeploy,
    runSchemaGuard,
    runtimeDoctorDbCheckOps,
    smokeRuntime,
    summarizeSchemaGuardFailures: (report) => deps.summarizeSchemaGuardFailures(report as SchemaGuardReport),
  });

  return {
    runtimeDoctorFacade,
    runSchemaGuard,
    runAcceptanceCommand,
    smokeRuntime,
    runtimeEnvRemoteVerification,
    runtimeEnvSmokeWarmup,
  };
};
