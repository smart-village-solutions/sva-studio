import {
  getRuntimeProfileDerivedEnvKeys,
  getRuntimeProfileDefinition,
  isMockAuthRuntimeProfile,
  parseRuntimeProfile,
  getRuntimeProfileRequiredEnvKeys,
  type RuntimeProfile,
  validateRuntimeProfileEnv,
} from '../../../packages/core/src/runtime-profile.ts';
import {
  summarizeSchemaGuardFailures,
} from '../../../packages/auth-runtime/src/iam-account-management/schema-guard.ts';
import {
  assertDeterministicRemoteMutationContext,
  buildAcceptanceReportPaths,
  buildProdParityProbePlan,
  buildTrustedForwardedHeaders,
  getRuntimeStatusExecutionMode,
  hasLocalEmergencyRemoteMutationOverride,
  parseRuntimeCliOptions,
  parseJsonFromCommandOutput,
  resolveAcceptanceDeployOptions,
  type AcceptanceProbeResult,
  type RuntimeCommand,
} from '../runtime-env.shared.ts';
import { summarizeProcessOutput, wait, withoutDebugEnv } from './process.ts';
import {
  bootstrapLocalAppUser,
  buildLocalHealthUrl,
  downLocalInfra,
  isProcessAlive,
  migrateLocalDatabase,
  pullLocalInfra,
  readLocalState,
  readLocalWorkerState,
  shouldCheckLocalInstanceRegistryDriftBeforeCommand,
  shouldRunLocalProvisioningWorker,
  startLocalApp,
  startLocalProvisioningWorker,
  stopLocalApp,
  stopLocalProvisioningWorker,
  upLocalInfra,
} from './local-runtime.ts';
import { assertRuntimeEnv, buildProfileEnv } from './profile-env.ts';
import { createRemoteRuntimeProfileGuards, ensureKnownCommand, ensureKnownProfile } from './runtime-cli.ts';
import { applyCliOptionEnvOverrides, parseInstanceIdList } from './runtime-config.ts';
import { assertComposeServiceIngressLabels, assertComposeServiceNetworks, buildQuantumDeployComposeDocument } from './deploy-project.ts';
import { guardrailCheckOrder, runGuardrailReport } from '../../ci/guardrail-report.ts';
import {
  getGooseConfiguredVersion as getGooseConfiguredVersionFromConfig,
  listGooseMigrationFiles as listGooseMigrationFilesFromDir,
  runLocalGooseStatus as runLocalGooseStatusWithDeps,
} from './goose.ts';
import { createLocalRuntimeAuditLogger, shouldAuditLocalRuntimeCommand } from './rebuild-audit.ts';
import { inspectRemoteServiceContract } from './remote-service-spec.ts';
import { isExpectedOidcRedirect, runHttpProbe as runHttpProbeWithDeps } from './acceptance-runtime-checks.ts';
import { assertDangerousOperationApproved, resolveLocalDangerousApprovalRequirement, resolveRemoteDangerousApprovalRequirement } from './runtime-approvals.ts';
import { createRuntimeFacadeSupport } from './runtime-facade-support.ts';
import { createRuntimeOrchestrator } from './runtime-orchestrator.ts';
import { checkHttpHealth, sqlIdentifier, sqlLiteral, verifyDbSchemaSnapshot } from './runtime-db.ts';

const [, , rawCommand, rawProfile, ...rawOptions] = process.argv;

const command = rawCommand as RuntimeCommand | undefined;
const profile = rawProfile as RuntimeProfile | undefined;
const cliOptions = parseRuntimeCliOptions(rawOptions);
const jsonOutput = cliOptions.jsonOutput;

const composeBaseArgs = ['compose', '-f', 'docker-compose.yml'];
const composeWithMonitoringArgs = ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.monitoring.yml'];
const { isRemoteRuntimeProfile, requireRemoteRuntimeProfile } = createRemoteRuntimeProfileGuards(
  (runtimeProfile) => getRuntimeProfileDefinition(runtimeProfile).isLocal,
);
const runtimeSupport = createRuntimeFacadeSupport({
  getRuntimeProfileDefinition,
  isRemoteRuntimeProfile,
  jsonOutput,
  shouldRunLocalProvisioningWorker,
});

const {
  acceptanceRemoteStateOps,
  appLogDir,
  buildGuardrailDoctorChecks,
  buildImagePlatformDoctorCheck,
  buildLocalProvisioningWorkerCheckBase,
  buildStudioImageVerifyEvidenceCheck,
  commandExists,
  createDbSqlRunner,
  createLocalSchemaDumpRunner,
  createStepResult,
  decorateDoctorCheck,
  deployReportDir,
  ensureDirs,
  finalizeDoctorReport,
  gooseConfig,
  gooseMigrationsDir,
  localInstanceOps,
  localStateFile,
  localWorkerStateFile,
  printDoctorReport,
  printJsonIfRequested,
  rebuildAuditLogFile,
  rootCommands,
  rootDir,
  run,
  runCapture,
  runCaptureDetailed,
  runQuantumExec,
  runtimeArtifactsDir,
  tenantSecretRegistryOps,
  toDoctorCheck,
  verifyLocalDbSchemaSnapshot,
} = runtimeSupport;
const {
  getConfiguredQuantumEndpoint,
  getConfiguredStackName,
  getGitCommitSha,
  getRemoteAppServiceName,
  getRemoteComposeFile,
  getRuntimeContractSummary,
  isMainserverCheckRequired,
  isMigrationStatusCheckRequired,
  parseContainerEnv,
  resolveEffectiveImageRefForRemoteChecks,
  shouldSkipQuantumPrePull,
} = runtimeSupport.runtimeConfigOps;
export { buildGuardrailDoctorChecks };

const listGooseMigrationFiles = () => listGooseMigrationFilesFromDir(gooseMigrationsDir);

const getGooseConfiguredVersion = () => getGooseConfiguredVersionFromConfig(gooseConfig);

const getComposeArgs = (env: NodeJS.ProcessEnv) =>
  env.SVA_ENABLE_MONITORING === 'false' ? composeBaseArgs : composeWithMonitoringArgs;

const runLocalGooseStatus = (env: NodeJS.ProcessEnv) =>
  runLocalGooseStatusWithDeps({ rootDir, runCapture: rootCommands.runCapture }, gooseConfig, env);

export const runtimeEnvDangerousOperations = {
  assertDangerousOperationApproved,
  resolveLocalDangerousApprovalRequirement,
  resolveRemoteDangerousApprovalRequirement,
} as const;

const runHttpProbe = (input: {
  expect: (response: Response, payload: unknown) => string | null;
  headers?: HeadersInit;
  name: string;
  scope: AcceptanceProbeResult['scope'];
  target: string;
}) => runHttpProbeWithDeps(input);

const {
  doctorRuntime,
  runAcceptanceCommand,
  runLocalCommand,
  runtimeEnvRemoteVerification,
  runtimeEnvSmokeWarmup,
} = createRuntimeOrchestrator({
  acceptanceRemoteStateOps,
  appLogDir,
  applyCliOptionEnvOverrides,
  assertComposeServiceIngressLabels,
  assertComposeServiceNetworks,
  assertDangerousOperationApproved,
  assertDeterministicRemoteMutationContext,
  assertRuntimeEnv,
  bootstrapLocalAppUser,
  buildAcceptanceReportPaths,
  buildGuardrailDoctorChecks,
  buildImagePlatformDoctorCheck,
  buildLocalHealthUrl,
  buildLocalProvisioningWorkerCheckBase,
  buildProfileEnv,
  buildProdParityProbePlan,
  buildQuantumDeployComposeDocument,
  buildStudioImageVerifyEvidenceCheck,
  buildTrustedForwardedHeaders,
  checkHttpHealth,
  cliOptions,
  collectLocalInstanceIdentityDrift: localInstanceOps.collectLocalInstanceIdentityDrift,
  commandExists,
  composeWithMonitoringArgs,
  createDbSqlRunner,
  createLocalRuntimeAuditLogger,
  createStepResult,
  decorateDoctorCheck,
  deployReportDir,
  downLocalInfra,
  ensureDirs,
  finalizeDoctorReport,
  getComposeArgs,
  getConfiguredQuantumEndpoint,
  getConfiguredStackName,
  getGitCommitSha,
  getGooseConfiguredVersion,
  getRemoteAppServiceName,
  getRemoteComposeFile,
  getRuntimeContractSummary,
  getRuntimeProfileDefinition,
  getRuntimeProfileDerivedEnvKeys,
  getRuntimeProfileRequiredEnvKeys,
  getRuntimeStatusExecutionMode,
  hasLocalEmergencyRemoteMutationOverride,
  inspectRemoteServiceContract,
  isExpectedOidcRedirect,
  isMainserverCheckRequired,
  isMigrationStatusCheckRequired,
  isMockAuthRuntimeProfile,
  isProcessAlive,
  isRemoteRuntimeProfile,
  jsonOutput,
  listGooseMigrationFiles,
  loadActiveLocalTenantSecretStates: tenantSecretRegistryOps.loadActiveLocalTenantSecretStates as never,
  localInstanceOps,
  localStateFile,
  localWorkerStateFile,
  migrateLocalDatabase,
  parseInstanceIdList,
  parseJsonFromCommandOutput,
  parseRuntimeProfile,
  printDoctorReport,
  printJsonIfRequested,
  pullLocalInfra,
  readLocalState,
  readLocalWorkerState,
  rebuildAuditLogFile,
  resolveAcceptanceDeployOptions,
  resolveLocalDangerousApprovalRequirement,
  resolveRemoteDangerousApprovalRequirement,
  rootDir,
  run,
  runCapture,
  runCaptureDetailed,
  runHttpProbe,
  runLocalGooseStatus,
  runQuantumExec,
  runtimeArtifactsDir,
  shouldAuditLocalRuntimeCommand,
  shouldCheckLocalInstanceRegistryDriftBeforeCommand,
  shouldRunLocalProvisioningWorker,
  shouldSkipQuantumPrePull,
  sqlIdentifier,
  sqlLiteral,
  startLocalApp,
  startLocalProvisioningWorker,
  stopLocalApp,
  stopLocalProvisioningWorker,
  summarizeProcessOutput,
  summarizeSchemaGuardFailures,
  tenantSecretRegistryOps,
  syncLocalTenantSecretsToRegistry: tenantSecretRegistryOps.syncLocalTenantSecretsToRegistry,
  toDoctorCheck,
  upLocalInfra,
  validateRuntimeProfileEnv,
  verifyDbSchemaSnapshot,
  verifyLocalDbSchemaSnapshot,
  wait,
  withoutDebugEnv,
});

export { runtimeEnvRemoteVerification, runtimeEnvSmokeWarmup };

export const main = async () => {
  ensureDirs();

  const runtimeCommand = ensureKnownCommand(command);
  const runtimeProfile = ensureKnownProfile(profile);
  const definition = getRuntimeProfileDefinition(runtimeProfile);

  if (definition.isLocal) {
    if (!runLocalCommand) {
      throw new Error('Local-Command-Fassade ist noch nicht initialisiert.');
    }
    await runLocalCommand(runtimeProfile, runtimeCommand);
    return;
  }

  await runAcceptanceCommand(requireRemoteRuntimeProfile(runtimeProfile), runtimeCommand);
};
