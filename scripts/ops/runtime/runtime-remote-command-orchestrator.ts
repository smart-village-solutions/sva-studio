import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import { deriveInternalVerifyMaxAttempts, shouldRetryExternalSmoke, shouldRetryInternalProbeFailure, shouldRetryInternalVerify, shouldRetryInternalVerifyAttempt } from './smoke.ts';
import { createAcceptanceProbeResult } from './acceptance-probe.ts';
import { createAcceptanceRuntimeCore } from './acceptance-runtime-facade.ts';
import { createAcceptanceCommandRunner } from './acceptance-command.ts';
import { mergeExplicitTenantTargetsWithRegistry, parseTenantRealmOverrides } from './remote-verification.ts';
import { createRuntimeRemoteBundle } from './runtime-remote-bundle.ts';
import type { SchemaGuardReport } from '../../../packages/auth-runtime/src/iam-account-management/schema-guard.ts';
import type { LocalTenantSecretState } from './doctor-db-checks.types.ts';
import type { RuntimeRemoteCommandOrchestratorDeps } from './runtime-remote-command-orchestrator.types.ts';

type AcceptanceRuntimeCore = ReturnType<typeof createAcceptanceRuntimeCore>;
type RemoteBundle = ReturnType<typeof createRuntimeRemoteBundle>;
type RuntimeDoctorDbCheckOps = RemoteBundle['runtimeDoctorDbCheckOps'];

const requireRuntimeDoctorDbCheckOps = (getRuntimeDoctorDbCheckOps: () => RuntimeDoctorDbCheckOps | null) => {
  const runtimeDoctorDbCheckOps = getRuntimeDoctorDbCheckOps();
  if (!runtimeDoctorDbCheckOps) throw new Error('Runtime-Doctor-DB-Checks sind noch nicht initialisiert.');
  return runtimeDoctorDbCheckOps;
};

const acceptanceRuntimeCoreBaseDeps = (deps: RuntimeRemoteCommandOrchestratorDeps) => ({
  acceptanceRemoteStateOps: deps.acceptanceRemoteStateOps,
  assertComposeServiceIngressLabels: deps.assertComposeServiceIngressLabels,
  assertComposeServiceNetworks: deps.assertComposeServiceNetworks,
  assertDeterministicRemoteMutationContext: deps.assertDeterministicRemoteMutationContext,
  buildAcceptanceReportPaths: deps.buildAcceptanceReportPaths,
  buildProdParityProbePlan: deps.buildProdParityProbePlan,
  buildQuantumDeployComposeDocument: deps.buildQuantumDeployComposeDocument,
  buildTrustedForwardedHeaders: deps.buildTrustedForwardedHeaders,
  checkHttpHealth: deps.checkHttpHealth,
  cliOptions: deps.cliOptions,
  commandExists: deps.commandExists,
  createProbeResult: createAcceptanceProbeResult,
  createStepResult: deps.createStepResult,
  deployReportDir: deps.deployReportDir,
  ensureDirs: deps.ensureDirs,
  jsonOutput: deps.jsonOutput,
  rootDir: deps.rootDir,
});

const acceptanceRuntimeCoreRuntimeDeps = (deps: RuntimeRemoteCommandOrchestratorDeps) => ({
  getConfiguredQuantumEndpoint: deps.getConfiguredQuantumEndpoint,
  getConfiguredStackName: deps.getConfiguredStackName,
  getGooseConfiguredVersion: deps.getGooseConfiguredVersion,
  getRemoteAppServiceName: deps.getRemoteAppServiceName,
  getRemoteComposeFile: deps.getRemoteComposeFile,
  getRuntimeContractSummary: deps.getRuntimeContractSummary,
  getRuntimeProfileDerivedEnvKeys: deps.getRuntimeProfileDerivedEnvKeys,
  getRuntimeProfileRequiredEnvKeys: deps.getRuntimeProfileRequiredEnvKeys,
  hasLocalEmergencyRemoteMutationOverride: deps.hasLocalEmergencyRemoteMutationOverride,
  inspectRemoteServiceContract: (env: NodeJS.ProcessEnv, input: Parameters<RuntimeRemoteCommandOrchestratorDeps['inspectRemoteServiceContract']>[2]) =>
    deps.inspectRemoteServiceContract({ commandExists: deps.commandExists, runCapture: deps.runCapture }, env, input),
  isExpectedOidcRedirect: deps.isExpectedOidcRedirect,
  isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
  listGooseMigrationFiles: deps.listGooseMigrationFiles,
  parseJsonFromCommandOutput: deps.parseJsonFromCommandOutput,
  parseRuntimeProfile: (value: string | undefined) => deps.parseRuntimeProfile(value) ?? undefined,
  printJsonIfRequested: deps.printJsonIfRequested,
  resolveAcceptanceDeployOptions: (env: NodeJS.ProcessEnv, _cliOptions: unknown, runtimeProfile: Parameters<RuntimeRemoteCommandOrchestratorDeps['resolveAcceptanceDeployOptions']>[2]) =>
    deps.resolveAcceptanceDeployOptions(env, deps.cliOptions, runtimeProfile),
  run: deps.run,
  runCapture: deps.runCapture,
  runCaptureDetailed: deps.runCaptureDetailed,
  runHttpProbe: deps.runHttpProbe,
  runQuantumExec: deps.runQuantumExec,
  shouldSkipQuantumPrePull: deps.shouldSkipQuantumPrePull,
  summarizeProcessOutput: (result: { stderr?: string; stdout?: string }) => deps.summarizeProcessOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`),
  summarizeSchemaGuardFailures: deps.summarizeSchemaGuardFailures,
  toDoctorCheck: deps.toDoctorCheck,
  wait: async (ms: number) => {
    await deps.wait(ms);
  },
  withoutDebugEnv: deps.withoutDebugEnv,
});

const createAcceptanceRuntimeCoreOps = (
  deps: RuntimeRemoteCommandOrchestratorDeps,
  getRuntimeDoctorDbCheckOps: () => RuntimeDoctorDbCheckOps | null,
) =>
  createAcceptanceRuntimeCore({
    ...acceptanceRuntimeCoreBaseDeps(deps),
    ...acceptanceRuntimeCoreRuntimeDeps(deps),
    buildInstanceHostnameMappingCheck: async (runtimeProfile, env) =>
      requireRuntimeDoctorDbCheckOps(getRuntimeDoctorDbCheckOps).buildInstanceHostnameMappingCheck(runtimeProfile, env),
    runSchemaGuard: (runtimeProfile, env) => requireRuntimeDoctorDbCheckOps(getRuntimeDoctorDbCheckOps).runSchemaGuard(runtimeProfile, env),
  });

const remoteBundleBaseDeps = (deps: RuntimeRemoteCommandOrchestratorDeps, acceptanceRuntimeCore: AcceptanceRuntimeCore) => ({
  acceptanceRemoteStateOps: deps.acceptanceRemoteStateOps,
  acceptanceRuntimeCore,
  assertComposeServiceIngressLabels: deps.assertComposeServiceIngressLabels,
  assertComposeServiceNetworks: deps.assertComposeServiceNetworks,
  assertDeterministicRemoteMutationContext: deps.assertDeterministicRemoteMutationContext,
  assertRuntimeEnv: deps.assertRuntimeEnv,
  buildAcceptanceReportPaths: deps.buildAcceptanceReportPaths,
  buildGuardrailDoctorChecks: deps.buildGuardrailDoctorChecks,
  buildImagePlatformDoctorCheck: deps.buildImagePlatformDoctorCheck,
  buildLocalProvisioningWorkerCheckBase: deps.buildLocalProvisioningWorkerCheckBase,
  buildQuantumDeployComposeDocument: deps.buildQuantumDeployComposeDocument,
  buildStudioImageVerifyEvidenceCheck: deps.buildStudioImageVerifyEvidenceCheck,
  buildTrustedForwardedHeaders: deps.buildTrustedForwardedHeaders,
  checkHttpHealth: deps.checkHttpHealth,
  cliOptions: deps.cliOptions,
  commandExists: deps.commandExists,
  createDbSqlRunner: deps.createDbSqlRunner,
  createProbeResult: createAcceptanceProbeResult,
  createStepResult: deps.createStepResult,
  deployReportDir: deps.deployReportDir,
  ensureDirs: deps.ensureDirs,
  jsonOutput: deps.jsonOutput,
});

const remoteBundleRuntimeDeps = (deps: RuntimeRemoteCommandOrchestratorDeps) => ({
  buildLocalInstanceRegistryReconciliationInput: deps.localInstanceOps.buildLocalInstanceRegistryReconciliationInput,
  buildProdParityProbePlan: deps.buildProdParityProbePlan,
  collectLocalInstanceIdentityDrift: deps.collectLocalInstanceIdentityDrift,
  finalizeDoctorReport: deps.finalizeDoctorReport,
  getGitCommitSha: deps.getGitCommitSha,
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
  inspectRemoteServiceContract: (env: NodeJS.ProcessEnv, input: Parameters<RuntimeRemoteCommandOrchestratorDeps['inspectRemoteServiceContract']>[2]) =>
    deps.inspectRemoteServiceContract({ commandExists: deps.commandExists, runCapture: deps.runCapture }, env, input),
  isExpectedOidcRedirect: deps.isExpectedOidcRedirect,
  isMainserverCheckRequired: deps.isMainserverCheckRequired,
  isMigrationStatusCheckRequired: deps.isMigrationStatusCheckRequired,
  isMockAuthRuntimeProfile: deps.isMockAuthRuntimeProfile,
  isProcessAlive: deps.isProcessAlive,
  isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
  listGooseMigrationFiles: deps.listGooseMigrationFiles,
  loadActiveLocalTenantSecretStates: async (env: NodeJS.ProcessEnv): Promise<readonly LocalTenantSecretState[]> =>
    (await deps.loadActiveLocalTenantSecretStates(env)) as unknown as readonly LocalTenantSecretState[],
  loadRegistryTenantTargets: deps.tenantSecretRegistryOps.loadRegistryTenantTargets,
  localWorkerStateFile: deps.localWorkerStateFile,
});

const remoteBundleCommandDeps = (
  deps: RuntimeRemoteCommandOrchestratorDeps,
  getRuntimeDoctorDbCheckOps: () => RuntimeDoctorDbCheckOps | null,
) => ({
  parseInstanceIdList: deps.parseInstanceIdList,
  parseJsonFromCommandOutput: deps.parseJsonFromCommandOutput,
  parseRuntimeProfile: (value: string | undefined) => deps.parseRuntimeProfile(value) ?? undefined,
  precheckAcceptance: deps.precheckAcceptance,
  printJsonIfRequested: deps.printJsonIfRequested,
  readLocalWorkerState: deps.readLocalWorkerState,
  resolveAcceptanceDeployOptions: (env: NodeJS.ProcessEnv, _cliOptions: unknown, runtimeProfile: Parameters<RuntimeRemoteCommandOrchestratorDeps['resolveAcceptanceDeployOptions']>[2]) =>
    deps.resolveAcceptanceDeployOptions(env, deps.cliOptions, runtimeProfile),
  rootDir: deps.rootDir,
  run: deps.run,
  runCapture: deps.runCapture,
  runCaptureDetailed: deps.runCaptureDetailed,
  runHttpProbe: deps.runHttpProbe,
  runLocalGooseStatus: deps.runLocalGooseStatus,
  runQuantumExec: deps.runQuantumExec,
  runSchemaGuard: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => requireRuntimeDoctorDbCheckOps(getRuntimeDoctorDbCheckOps).runSchemaGuard(runtimeProfile, env),
  runtimeArtifactsDir: deps.runtimeArtifactsDir,
  shouldSkipQuantumPrePull: deps.shouldSkipQuantumPrePull,
  sqlIdentifier: deps.sqlIdentifier,
  sqlLiteral: deps.sqlLiteral,
  summarizeProcessOutput: deps.summarizeProcessOutput,
  summarizeSchemaGuardFailures: deps.summarizeSchemaGuardFailures,
  toDoctorCheck: deps.toDoctorCheck,
  validateRuntimeProfileEnv: deps.validateRuntimeProfileEnv,
  verifyLocalDbSchemaSnapshot: deps.verifyLocalDbSchemaSnapshot,
  wait: deps.wait,
  withoutDebugEnv: deps.withoutDebugEnv,
});

const createRemoteBundle = (
  deps: RuntimeRemoteCommandOrchestratorDeps,
  acceptanceRuntimeCore: AcceptanceRuntimeCore,
  getRuntimeDoctorDbCheckOps: () => RuntimeDoctorDbCheckOps | null,
) =>
  createRuntimeRemoteBundle({
    ...remoteBundleBaseDeps(deps, acceptanceRuntimeCore),
    ...remoteBundleRuntimeDeps(deps),
    ...remoteBundleCommandDeps(deps, getRuntimeDoctorDbCheckOps),
    doctorRuntime: deps.doctorRuntime,
  });

const createRuntimeEnvRemoteVerification = (deps: RuntimeRemoteCommandOrchestratorDeps, remoteBundle: RemoteBundle) => ({
  assertLoginFlow: remoteBundle.runtimeHealthOps.assertLoginFlow,
  buildKeycloakClientSecretCheck: remoteBundle.runtimeHealthOps.buildKeycloakClientSecretCheck,
  buildLocalProvisioningWorkerCheck: deps.buildLocalProvisioningWorkerCheckBase,
  buildStudioImageVerifyEvidenceCheck: deps.buildStudioImageVerifyEvidenceCheck,
  decorateDoctorCheck: deps.decorateDoctorCheck,
  mergeExplicitTenantTargetsWithRegistry,
  parseTenantRealmOverrides,
  readStudioImageVerifyEvidence: remoteBundle.runtimeRemoteVerificationOps.readStudioImageVerifyEvidence,
  requireLocalInstanceRegistryReconciliationInput: deps.localInstanceOps.requireLocalInstanceRegistryReconciliationInput,
  resolveTenantRuntimeTargets: remoteBundle.runtimeRemoteVerificationOps.resolveTenantRuntimeTargets,
  selectReleaseBlockingTenantTargets: remoteBundle.runtimeRemoteVerificationOps.selectReleaseBlockingTenantTargets,
  selectSmokeTenantTargets: remoteBundle.runtimeRemoteVerificationOps.selectSmokeTenantTargets,
  shouldCheckLocalInstanceRegistryDriftBeforeCommand: deps.shouldCheckLocalInstanceRegistryDriftBeforeCommand,
  shouldRunLocalProvisioningWorker: deps.shouldRunLocalProvisioningWorker,
  tryReadGithubStudioImageVerifyEvidence: remoteBundle.runtimeRemoteVerificationOps.tryReadGithubStudioImageVerifyEvidence,
  verifyDbSchemaSnapshot: deps.verifyDbSchemaSnapshot,
  waitForPostDeployStabilization: remoteBundle.runtimeRemoteVerificationOps.waitForPostDeployStabilization,
}) as const;

const createRuntimeEnvSmokeWarmup = (runtimeSmokeOps: RemoteBundle['runtimeSmokeOps']) => ({
  deriveInternalVerifyMaxAttempts,
  runExternalSmokeWithWarmup: runtimeSmokeOps.runExternalSmokeWithWarmup,
  shouldRetryExternalSmoke,
  shouldRetryInternalProbeFailure,
  shouldRetryInternalVerify,
  shouldRetryInternalVerifyAttempt,
  waitForRemoteSmokeWarmup: runtimeSmokeOps.waitForRemoteSmokeWarmup,
}) as const;

const createRunAcceptanceCommand = (
  deps: RuntimeRemoteCommandOrchestratorDeps,
  acceptanceRuntimeCore: AcceptanceRuntimeCore,
  remoteBundle: RemoteBundle,
  runSchemaGuard: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => SchemaGuardReport,
  smokeRuntime: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => ReturnType<RemoteBundle['runtimeHealthOps']['smokeRuntime']>,
) =>
  createAcceptanceCommandRunner({
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
    runAcceptanceDeploy: remoteBundle.runAcceptanceDeploy,
    runSchemaGuard,
    runtimeDoctorDbCheckOps: remoteBundle.runtimeDoctorDbCheckOps,
    smokeRuntime,
    summarizeSchemaGuardFailures: (report) => deps.summarizeSchemaGuardFailures(report as SchemaGuardReport),
  });

export const createRuntimeRemoteCommandOrchestrator = (deps: RuntimeRemoteCommandOrchestratorDeps) => {
  let runtimeDoctorDbCheckOps: RuntimeDoctorDbCheckOps | null = null;
  const getRuntimeDoctorDbCheckOps = () => runtimeDoctorDbCheckOps;
  const acceptanceRuntimeCore = createAcceptanceRuntimeCoreOps(deps, getRuntimeDoctorDbCheckOps);
  const remoteBundle = createRemoteBundle(deps, acceptanceRuntimeCore, getRuntimeDoctorDbCheckOps);
  runtimeDoctorDbCheckOps = remoteBundle.runtimeDoctorDbCheckOps;
  const runSchemaGuard = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    remoteBundle.runtimeDoctorDbCheckOps.runSchemaGuard(runtimeProfile, env);
  const smokeRuntime = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) =>
    remoteBundle.runtimeHealthOps.smokeRuntime(runtimeProfile, env);

  return {
    runtimeDoctorFacade: remoteBundle.runtimeDoctorFacade,
    runSchemaGuard,
    runAcceptanceCommand: createRunAcceptanceCommand(deps, acceptanceRuntimeCore, remoteBundle, runSchemaGuard, smokeRuntime),
    smokeRuntime,
    runtimeEnvRemoteVerification: createRuntimeEnvRemoteVerification(deps, remoteBundle),
    runtimeEnvSmokeWarmup: createRuntimeEnvSmokeWarmup(remoteBundle.runtimeSmokeOps),
  };
};
