import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type {
  AcceptanceProbeResult,
  DoctorCheck,
  RemoteRuntimeProfile,
} from '../runtime-env.shared.ts';
import { createRuntimeRemoteVerification } from './remote-verification.ts';
import { createRuntimeSmokeOps } from './smoke.ts';
import { createRuntimeHealthOps } from './runtime-health.ts';
import { createRuntimeDoctorDbCheckOps } from './doctor-db-checks.ts';
import { createRuntimeImageSmokeOps } from './image-smoke.ts';
import { createRuntimeDoctorFacade } from './runtime-doctor-facade.ts';
import { createAcceptanceDeployFacade } from './acceptance-runtime-facade.ts';
import type { SchemaGuardReport } from '../../../packages/auth-runtime/src/iam-account-management/schema-guard.ts';
import type { RuntimeRemoteBundleDeps } from './runtime-remote-bundle.types.ts';

type RuntimeRemoteVerificationOps = ReturnType<typeof createRuntimeRemoteVerification>;
type RuntimeSmokeOps = ReturnType<typeof createRuntimeSmokeOps>;
type RuntimeHealthOps = ReturnType<typeof createRuntimeHealthOps>;
type RuntimeDoctorDbCheckOps = ReturnType<typeof createRuntimeDoctorDbCheckOps>;
type RuntimeImageSmokeOps = ReturnType<typeof createRuntimeImageSmokeOps>;
type RuntimeDoctorFacade = ReturnType<typeof createRuntimeDoctorFacade>;

const createRemoteVerificationOps = (deps: RuntimeRemoteBundleDeps) =>
  createRuntimeRemoteVerification({
    commandExists: deps.commandExists,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    loadRegistryTenantTargets: deps.loadRegistryTenantTargets as never,
    parseInstanceIdList: deps.parseInstanceIdList,
    runCapture: (command, args) => deps.runCapture(command, args ?? []),
    runtimeArtifactsDir: deps.runtimeArtifactsDir,
    wait: deps.wait as never,
  });

const createSmokeOps = (deps: RuntimeRemoteBundleDeps, runtimeRemoteVerificationOps: RuntimeRemoteVerificationOps) =>
  createRuntimeSmokeOps({
    buildSwarmAppTaskProbe: deps.acceptanceRemoteStateOps.buildSwarmAppTaskProbe,
    buildSwarmServicePresenceProbe: deps.acceptanceRuntimeCore.buildSwarmServicePresenceProbe,
    doctorRuntime: deps.doctorRuntime as never,
    isExpectedOidcRedirect: deps.isExpectedOidcRedirect,
    parseRuntimeProfile: (value) => deps.parseRuntimeProfile(value) ?? undefined,
    resolveTenantRuntimeTargets: runtimeRemoteVerificationOps.resolveTenantRuntimeTargets,
    runHttpProbe: deps.runHttpProbe,
    selectSmokeTenantTargets: runtimeRemoteVerificationOps.selectSmokeTenantTargets,
    shouldUseStudioReleaseBlockingTenantScope: runtimeRemoteVerificationOps.shouldUseStudioReleaseBlockingTenantScope,
    wait: deps.wait as never,
  });

const createHealthOps = (
  deps: RuntimeRemoteBundleDeps,
  runtimeRemoteVerificationOps: RuntimeRemoteVerificationOps,
  runtimeSmokeOps: RuntimeSmokeOps,
) =>
  createRuntimeHealthOps({
    assertRuntimeEnv: deps.assertRuntimeEnv,
    checkHttpHealth: deps.checkHttpHealth,
    commandExists: deps.commandExists,
    getConfiguredQuantumEndpoint: deps.getConfiguredQuantumEndpoint,
    getConfiguredStackName: deps.getConfiguredStackName,
    getRemoteAppServiceName: deps.getRemoteAppServiceName,
    getRuntimeProfileDefinition: deps.getRuntimeProfileDefinition,
    inspectRemoteServiceContract: deps.inspectRemoteServiceContract as never,
    isExpectedOidcRedirect: deps.isExpectedOidcRedirect,
    isMainserverCheckRequired: deps.isMainserverCheckRequired,
    isMockAuthRuntimeProfile: deps.isMockAuthRuntimeProfile,
    readRemoteStackEvidence: deps.acceptanceRemoteStateOps.readRemoteStackEvidence,
    resolveTenantRuntimeTargets: runtimeRemoteVerificationOps.resolveTenantRuntimeTargets,
    runCapture: (command, args, env) => deps.runCapture(command, args, env),
    runSchemaGuard: deps.runSchemaGuard,
    summarizeSchemaGuardFailures: (report) => deps.summarizeSchemaGuardFailures(report as SchemaGuardReport),
    toDoctorCheck: deps.toDoctorCheck,
    wait: deps.wait as never,
    waitForRemoteSmokeWarmup: runtimeSmokeOps.waitForRemoteSmokeWarmup,
    withoutDebugEnv: deps.withoutDebugEnv,
  });

const createDoctorDbCheckOps = (deps: RuntimeRemoteBundleDeps, runtimeRemoteVerificationOps: RuntimeRemoteVerificationOps) =>
  createRuntimeDoctorDbCheckOps({
    buildLocalInstanceRegistryReconciliationInput: deps.buildLocalInstanceRegistryReconciliationInput as never,
    collectLocalInstanceIdentityDrift: deps.collectLocalInstanceIdentityDrift,
    createDbSqlRunner: deps.createDbSqlRunner,
    getGooseConfiguredVersion: () => deps.getGooseConfiguredVersion() ?? '',
    getRuntimeProfileDefinition: deps.getRuntimeProfileDefinition,
    isMigrationStatusCheckRequired: deps.isMigrationStatusCheckRequired,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    loadActiveLocalTenantSecretStates: deps.loadActiveLocalTenantSecretStates as never,
    parseJsonFromCommandOutput: deps.parseJsonFromCommandOutput,
    resolveTenantRuntimeTargets: runtimeRemoteVerificationOps.resolveTenantRuntimeTargets,
    runLocalGooseStatus: deps.runLocalGooseStatus,
    sqlIdentifier: deps.sqlIdentifier,
    sqlLiteral: deps.sqlLiteral,
    summarizeSchemaGuardFailures: deps.summarizeSchemaGuardFailures,
    toDoctorCheck: deps.toDoctorCheck,
    verifyLocalDbSchemaSnapshot: deps.verifyLocalDbSchemaSnapshot as never,
  });

const createImageSmokeOps = (deps: RuntimeRemoteBundleDeps, runtimeHealthOps: RuntimeHealthOps) =>
  createRuntimeImageSmokeOps({
    buildAcceptanceIngressConsistencyCheck: deps.acceptanceRuntimeCore.buildAcceptanceIngressConsistencyCheck,
    buildAppPrincipalReadinessCheck: deps.acceptanceRuntimeCore.buildAppPrincipalReadinessCheck,
    buildLiveRuntimeEnvCheck: runtimeHealthOps.buildLiveRuntimeEnvCheck,
    buildProdParityProbePlan: deps.buildProdParityProbePlan,
    buildTenantAuthProofCheck: runtimeHealthOps.buildTenantAuthProofCheck,
    buildTrustedForwardedHeaders: deps.buildTrustedForwardedHeaders,
    commandExists: deps.commandExists,
    createProbeResult: deps.createProbeResult as never,
    ensureDirs: deps.ensureDirs,
    getConfiguredQuantumEndpoint: deps.getConfiguredQuantumEndpoint,
    getConfiguredStackName: deps.getConfiguredStackName,
    getRemoteAppServiceName: deps.getRemoteAppServiceName,
    hasLocalEmergencyRemoteMutationOverride: deps.hasLocalEmergencyRemoteMutationOverride,
    inspectRemoteServiceContract: deps.inspectRemoteServiceContract as never,
    isExpectedOidcRedirect: deps.isExpectedOidcRedirect,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    parseRuntimeProfile: (value) => deps.parseRuntimeProfile(value) ?? undefined,
    runCapture: (command, args, env) => deps.runCapture(command, args, env),
    runCaptureDetailed: (command, args, env) => deps.runCaptureDetailed(command, args, env),
    runHttpProbe: deps.runHttpProbe,
    runtimeArtifactsDir: deps.runtimeArtifactsDir,
    summarizeProcessOutput: deps.summarizeProcessOutput,
    wait: deps.wait as never,
  });

const createDoctorFacadeOps = (
  deps: RuntimeRemoteBundleDeps,
  runtimeHealthOps: RuntimeHealthOps,
  runtimeDoctorDbCheckOps: RuntimeDoctorDbCheckOps,
) =>
  createRuntimeDoctorFacade({
    assertLoginFlow: runtimeHealthOps.assertLoginFlow,
    assertMainserverSmoke: runtimeHealthOps.assertMainserverSmoke,
    assertMeEndpoint: runtimeHealthOps.assertMeEndpoint,
    assertOtelLocal: runtimeHealthOps.assertOtelLocal,
    buildAcceptanceIngressConsistencyCheck: deps.acceptanceRuntimeCore.buildAcceptanceIngressConsistencyCheck,
    buildAcceptanceLiveSpecCheck: deps.acceptanceRuntimeCore.buildAcceptanceLiveSpecCheck,
    buildAcceptancePostgresCheck: deps.acceptanceRuntimeCore.buildAcceptancePostgresCheck,
    buildAcceptanceServiceCheck: deps.acceptanceRuntimeCore.buildAcceptanceServiceCheck,
    buildAppPrincipalReadinessCheck: deps.acceptanceRuntimeCore.buildAppPrincipalReadinessCheck,
    buildFeatureFlagCheck: runtimeDoctorDbCheckOps.buildFeatureFlagCheck,
    buildGuardrailDoctorChecks: deps.buildGuardrailDoctorChecks,
    buildImagePlatformDoctorCheck: deps.buildImagePlatformDoctorCheck,
    buildInstanceAuthConfigCheck: runtimeDoctorDbCheckOps.buildInstanceAuthConfigCheck,
    buildInstanceHostnameMappingCheck: runtimeDoctorDbCheckOps.buildInstanceHostnameMappingCheck,
    buildKeycloakClientSecretCheck: runtimeHealthOps.buildKeycloakClientSecretCheck,
    buildLocalInstanceIdentityDoctorCheck: runtimeDoctorDbCheckOps.buildLocalInstanceIdentityDoctorCheck,
    buildLocalProvisioningWorkerCheckBase: deps.buildLocalProvisioningWorkerCheckBase,
    buildMigrationStatusCheck: runtimeDoctorDbCheckOps.buildMigrationStatusCheck,
    buildObservabilityDoctorCheck: runtimeHealthOps.buildObservabilityDoctorCheck,
    buildSchemaGuardCheck: runtimeDoctorDbCheckOps.buildSchemaGuardCheck,
    buildSchemaSnapshotCheck: runtimeDoctorDbCheckOps.buildSchemaSnapshotCheck,
    buildStudioImageVerifyEvidenceCheck: deps.buildStudioImageVerifyEvidenceCheck,
    buildTenantAdminClientContractCheck: runtimeDoctorDbCheckOps.buildTenantAdminClientContractCheck,
    buildTenantAdminSecretContractCheck: runtimeDoctorDbCheckOps.buildTenantAdminSecretContractCheck,
    buildTenantAuthProofCheck: runtimeHealthOps.buildTenantAuthProofCheck,
    buildTenantAuthSecretContractCheck: runtimeDoctorDbCheckOps.buildTenantAuthSecretContractCheck,
    checkHttpHealth: deps.checkHttpHealth,
    finalizeDoctorReport: deps.finalizeDoctorReport,
    getRuntimeContractSummary: deps.getRuntimeContractSummary,
    getRuntimeProfileDefinition: deps.getRuntimeProfileDefinition,
    getRuntimeProfileDerivedEnvKeys: deps.getRuntimeProfileDerivedEnvKeys,
    getRuntimeProfileRequiredEnvKeys: deps.getRuntimeProfileRequiredEnvKeys,
    isMainserverCheckRequired: deps.isMainserverCheckRequired,
    isProcessAlive: deps.isProcessAlive,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    localWorkerStateFile: deps.localWorkerStateFile,
    readLocalWorkerState: deps.readLocalWorkerState,
    toDoctorCheck: deps.toDoctorCheck,
    validateRuntimeProfileEnv: deps.validateRuntimeProfileEnv,
  });

const createAcceptanceDeployCoreDeps = (deps: RuntimeRemoteBundleDeps) => ({
  acceptanceRemoteStateOps: deps.acceptanceRemoteStateOps,
  assertComposeServiceIngressLabels: deps.assertComposeServiceIngressLabels as never,
  assertComposeServiceNetworks: deps.assertComposeServiceNetworks as never,
  assertDeterministicRemoteMutationContext: deps.assertDeterministicRemoteMutationContext,
  buildAcceptanceReportPaths: deps.buildAcceptanceReportPaths,
  buildProdParityProbePlan: deps.buildProdParityProbePlan,
  buildQuantumDeployComposeDocument: deps.buildQuantumDeployComposeDocument as never,
  buildTrustedForwardedHeaders: deps.buildTrustedForwardedHeaders,
  checkHttpHealth: deps.checkHttpHealth,
  cliOptions: deps.cliOptions,
  commandExists: deps.commandExists,
  createBaseAcceptanceDeployReport: deps.acceptanceRuntimeCore.acceptanceMaintenanceOps.createBaseAcceptanceDeployReport,
  createProbeResult: deps.createProbeResult as never,
  createStepResult: deps.createStepResult,
  deployReportDir: deps.deployReportDir,
  ensureDirs: deps.ensureDirs,
  jsonOutput: deps.jsonOutput,
  rootDir: deps.rootDir,
});

const createAcceptanceDeployRuntimeDeps = (deps: RuntimeRemoteBundleDeps) => ({
  getConfiguredQuantumEndpoint: deps.getConfiguredQuantumEndpoint,
  getConfiguredStackName: deps.getConfiguredStackName,
  getGooseConfiguredVersion: deps.getGooseConfiguredVersion,
  getRemoteAppServiceName: deps.getRemoteAppServiceName,
  getRemoteComposeFile: deps.getRemoteComposeFile,
  getRuntimeContractSummary: deps.getRuntimeContractSummary,
  getRuntimeProfileDerivedEnvKeys: deps.getRuntimeProfileDerivedEnvKeys,
  getRuntimeProfileRequiredEnvKeys: deps.getRuntimeProfileRequiredEnvKeys,
  hasLocalEmergencyRemoteMutationOverride: deps.hasLocalEmergencyRemoteMutationOverride,
  inspectRemoteServiceContract: deps.inspectRemoteServiceContract as never,
  isExpectedOidcRedirect: deps.isExpectedOidcRedirect,
  isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
  listGooseMigrationFiles: deps.listGooseMigrationFiles,
  parseJsonFromCommandOutput: deps.parseJsonFromCommandOutput,
  parseRuntimeProfile: (value: string | undefined) => deps.parseRuntimeProfile(value) ?? undefined,
  resolveAcceptanceDeployOptions: deps.resolveAcceptanceDeployOptions,
  shouldSkipQuantumPrePull: deps.shouldSkipQuantumPrePull,
  summarizeSchemaGuardFailures: deps.summarizeSchemaGuardFailures,
  toDoctorCheck: deps.toDoctorCheck,
  withoutDebugEnv: deps.withoutDebugEnv,
});

const createAcceptanceDeployRunnerDeps = (
  deps: RuntimeRemoteBundleDeps,
  runtimeDoctorDbCheckOps: RuntimeDoctorDbCheckOps,
  runtimeDoctorFacade: RuntimeDoctorFacade,
  runtimeImageSmokeOps: RuntimeImageSmokeOps,
  runtimeRemoteVerificationOps: RuntimeRemoteVerificationOps,
  runtimeSmokeOps: RuntimeSmokeOps,
) => ({
  ...createAcceptanceDeployCoreDeps(deps),
  ...createAcceptanceDeployRuntimeDeps(deps),
  buildInstanceHostnameMappingCheck: runtimeDoctorDbCheckOps.buildInstanceHostnameMappingCheck,
  precheckAcceptance: runtimeDoctorFacade.precheckAcceptance,
  printJsonIfRequested: deps.printJsonIfRequested,
  run: deps.run,
  runCapture: deps.runCapture,
  runCaptureDetailed: deps.runCaptureDetailed,
  runExternalSmokeWithWarmup: runtimeSmokeOps.runExternalSmokeWithWarmup,
  runHttpProbe: deps.runHttpProbe,
  runImageSmoke: runtimeImageSmokeOps.runImageSmoke,
  runInternalVerify: runtimeSmokeOps.runInternalVerify,
  runQuantumExec: deps.runQuantumExec,
  runSchemaGuard: deps.runSchemaGuard as never,
  summarizeProcessOutput: (result: { stderr?: string; stdout?: string }) => deps.summarizeProcessOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`),
  wait: deps.wait as never,
  waitForPostDeployStabilization: runtimeRemoteVerificationOps.waitForPostDeployStabilization,
  writeAcceptanceDeployReport: deps.acceptanceRuntimeCore.writeAcceptanceDeployReport,
});

const createAcceptanceDeployRunnerImpls = (
  deps: RuntimeRemoteBundleDeps,
  runtimeImageSmokeOps: RuntimeImageSmokeOps,
  runtimeSmokeOps: RuntimeSmokeOps,
) => ({
  captureAcceptanceStackStatus: deps.acceptanceRuntimeCore.captureAcceptanceStackStatus,
  createBaseAcceptanceDeployReport: deps.acceptanceRuntimeCore.acceptanceMaintenanceOps.createBaseAcceptanceDeployReport,
  deployAcceptanceStack: deps.acceptanceRuntimeCore.deployAcceptanceStack,
  runAcceptanceDeployExternalSmoke: runtimeSmokeOps.runExternalSmokeWithWarmup,
  runImageSmoke: runtimeImageSmokeOps.runImageSmoke,
  runInternalVerify: runtimeSmokeOps.runInternalVerify,
  writeAcceptanceDeployReport: deps.acceptanceRuntimeCore.writeAcceptanceDeployReport,
});

const createAcceptanceDeployRunner = (
  deps: RuntimeRemoteBundleDeps,
  runtimeDoctorDbCheckOps: RuntimeDoctorDbCheckOps,
  runtimeDoctorFacade: RuntimeDoctorFacade,
  runtimeImageSmokeOps: RuntimeImageSmokeOps,
  runtimeRemoteVerificationOps: RuntimeRemoteVerificationOps,
  runtimeSmokeOps: RuntimeSmokeOps,
) =>
  createAcceptanceDeployFacade(
    createAcceptanceDeployRunnerDeps(deps, runtimeDoctorDbCheckOps, runtimeDoctorFacade, runtimeImageSmokeOps, runtimeRemoteVerificationOps, runtimeSmokeOps),
    createAcceptanceDeployRunnerImpls(deps, runtimeImageSmokeOps, runtimeSmokeOps),
  );

export const createRuntimeRemoteBundle = (deps: RuntimeRemoteBundleDeps) => {
  const runtimeRemoteVerificationOps = createRemoteVerificationOps(deps);
  const runtimeSmokeOps = createSmokeOps(deps, runtimeRemoteVerificationOps);
  const runtimeHealthOps = createHealthOps(deps, runtimeRemoteVerificationOps, runtimeSmokeOps);
  const runtimeDoctorDbCheckOps = createDoctorDbCheckOps(deps, runtimeRemoteVerificationOps);
  const runtimeImageSmokeOps = createImageSmokeOps(deps, runtimeHealthOps);
  const runtimeDoctorFacade = createDoctorFacadeOps(deps, runtimeHealthOps, runtimeDoctorDbCheckOps);
  const runAcceptanceDeploy = createAcceptanceDeployRunner(
    deps,
    runtimeDoctorDbCheckOps,
    runtimeDoctorFacade,
    runtimeImageSmokeOps,
    runtimeRemoteVerificationOps,
    runtimeSmokeOps,
  );

  return {
    runAcceptanceDeploy,
    runtimeDoctorDbCheckOps,
    runtimeDoctorFacade,
    runtimeHealthOps,
    runtimeImageSmokeOps,
    runtimeRemoteVerificationOps,
    runtimeSmokeOps,
  };
};
