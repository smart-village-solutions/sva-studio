import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { DoctorCheck, DoctorReasonCode, DoctorReport } from '../runtime-env.shared.ts';
import { createLocalCommandFacade } from './local-command-facade.ts';
import type { LocalSchemaGuardResult } from './local-command.types.ts';
import { createLocalRuntimeRepairOps } from './local-repair.ts';
import type { LocalTenantSecretSyncSummary } from './tenant-secret-registry.ts';

type RuntimeLocalCommandOrchestratorDeps = {
  appLogDir: string;
  assertDangerousOperationApproved: typeof import('./runtime-approvals.ts').assertDangerousOperationApproved;
  assertRuntimeEnv: typeof import('./profile-env.ts').assertRuntimeEnv;
  bootstrapLocalAppUser: typeof import('./local-runtime.ts').bootstrapLocalAppUser;
  buildLocalHealthUrl: typeof import('./local-runtime.ts').buildLocalHealthUrl;
  buildProfileEnv: typeof import('./profile-env.ts').buildProfileEnv;
  cliOptions: ReturnType<typeof import('../runtime-env.shared.ts').parseRuntimeCliOptions>;
  composeWithMonitoringArgs: readonly string[];
  createLocalRuntimeAuditLogger: typeof import('./rebuild-audit.ts').createLocalRuntimeAuditLogger;
  doctorRuntime: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorReport>;
  downLocalInfra: typeof import('./local-runtime.ts').downLocalInfra;
  getComposeArgs: (env: NodeJS.ProcessEnv) => readonly string[];
  getGitCommitSha: ReturnType<typeof import('./runtime-config.ts').createRuntimeConfigOps>['getGitCommitSha'];
  jsonOutput: boolean;
  localInstanceOps: ReturnType<typeof import('./runtime-local-instance-ops.ts').createRuntimeLocalInstanceOps>;
  localStateFile: string;
  localWorkerStateFile: string;
  migrateLocalDatabase: typeof import('./local-runtime.ts').migrateLocalDatabase;
  printDoctorReport: ReturnType<typeof import('./runtime-doctor-report.ts').createRuntimeDoctorReportOps>['printDoctorReport'];
  pullLocalInfra: typeof import('./local-runtime.ts').pullLocalInfra;
  readLocalState: typeof import('./local-runtime.ts').readLocalState;
  readLocalWorkerState: typeof import('./local-runtime.ts').readLocalWorkerState;
  rebuildAuditLogFile: string;
  resolveLocalDangerousApprovalRequirement: typeof import('./runtime-approvals.ts').resolveLocalDangerousApprovalRequirement;
  rootDir: string;
  run: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => void;
  runSchemaGuard: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => LocalSchemaGuardResult;
  shouldAuditLocalRuntimeCommand: typeof import('./rebuild-audit.ts').shouldAuditLocalRuntimeCommand;
  shouldRunLocalProvisioningWorker: typeof import('./local-runtime.ts').shouldRunLocalProvisioningWorker;
  smokeRuntime: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Promise<void>;
  startLocalApp: typeof import('./local-runtime.ts').startLocalApp;
  startLocalProvisioningWorker: typeof import('./local-runtime.ts').startLocalProvisioningWorker;
  stopLocalApp: typeof import('./local-runtime.ts').stopLocalApp;
  stopLocalProvisioningWorker: typeof import('./local-runtime.ts').stopLocalProvisioningWorker;
  summarizeSchemaGuardFailures: typeof import('../../../packages/auth-runtime/src/iam-account-management/schema-guard.ts').summarizeSchemaGuardFailures;
  syncLocalTenantSecretsToRegistry: ReturnType<typeof import('./tenant-secret-registry.ts').createTenantSecretRegistryOps>['syncLocalTenantSecretsToRegistry'];
  upLocalInfra: typeof import('./local-runtime.ts').upLocalInfra;
  verifyLocalDbSchemaSnapshot: ReturnType<typeof import('./runtime-db.ts').createRuntimeDbOps>['verifyLocalDbSchemaSnapshot'];
};

export const createRuntimeLocalCommandOrchestrator = (deps: RuntimeLocalCommandOrchestratorDeps) => {
  const hasBlockingReasonCode = (report: DoctorReport, reasonCode: DoctorReasonCode) =>
    report.checks.some((check) => check.reasonCode === reasonCode);

  const isBlockingRepairFailure = (check: DoctorCheck): boolean => {
    if (check.status === 'warn') {
      return check.reasonCode === 'instance_identity_drift';
    }

    return check.status === 'error';
  };

  const localRuntimeRepairOps = createLocalRuntimeRepairOps<
    DoctorCheck,
    DoctorReport,
    LocalTenantSecretSyncSummary
  >({
    getCheckCode: (check) => check.code,
    getCheckMessage: (check) => check.message,
    getCheckReasonCode: (check) => check.reasonCode,
    getChecks: (report) => report.checks,
    hasBlockingReasonCode: (report, reasonCode) => hasBlockingReasonCode(report, reasonCode as DoctorReasonCode),
    isBlockingRepairFailure,
  });

  const runLocalCommand = createLocalCommandFacade({
    appLogDir: deps.appLogDir,
    assertDangerousOperationApproved: deps.assertDangerousOperationApproved,
    assertRuntimeEnv: deps.assertRuntimeEnv,
    bootstrapLocalAppUser: deps.bootstrapLocalAppUser,
    buildLocalHealthUrl: deps.buildLocalHealthUrl,
    buildProfileEnv: deps.buildProfileEnv,
    checkLocalInstanceRegistryDrift: deps.localInstanceOps.checkLocalInstanceRegistryDrift,
    cliOptions: deps.cliOptions,
    composeWithMonitoringArgs: deps.composeWithMonitoringArgs,
    createLocalRuntimeAuditLogger: deps.createLocalRuntimeAuditLogger,
    doctorRuntime: deps.doctorRuntime,
    downLocalInfra: deps.downLocalInfra,
    getComposeArgs: deps.getComposeArgs,
    getGitCommitSha: deps.getGitCommitSha,
    jsonOutput: deps.jsonOutput,
    localStateFile: deps.localStateFile,
    localWorkerStateFile: deps.localWorkerStateFile,
    migrateLocalDatabase: deps.migrateLocalDatabase,
    printDoctorReport: deps.printDoctorReport,
    pullLocalInfra: deps.pullLocalInfra,
    readLocalState: deps.readLocalState,
    readLocalWorkerState: deps.readLocalWorkerState,
    rebuildAuditLogFile: deps.rebuildAuditLogFile,
    reconcileLocalInstanceRegistry: deps.localInstanceOps.reconcileLocalInstanceRegistry,
    repairActorBindingFromEnv: deps.localInstanceOps.repairActorBindingFromEnv,
    repairLocalRuntimeWithDeps: localRuntimeRepairOps.repairLocalRuntimeWithDeps,
    resolveLocalDangerousApprovalRequirement: deps.resolveLocalDangerousApprovalRequirement,
    rootDir: deps.rootDir,
    run: deps.run,
    runSchemaGuard: deps.runSchemaGuard,
    shouldAuditLocalRuntimeCommand: deps.shouldAuditLocalRuntimeCommand,
    shouldRunLocalProvisioningWorker: deps.shouldRunLocalProvisioningWorker,
    smokeRuntime: deps.smokeRuntime,
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
    repairLocalRuntimeWithDeps: localRuntimeRepairOps.repairLocalRuntimeWithDeps,
    runLocalCommand,
  };
};
