import { createLocalRuntimeCommandRunner } from './local-command.ts';
import type { LocalRuntimeCommandDeps } from './local-command.types.ts';

type LocalCommandFacadeDeps = Omit<
  LocalRuntimeCommandDeps,
  'consoleLike' | 'createRepairDeps' | 'processExitCodeSetter'
> & {
  repairActorBindingFromEnv: (env: NodeJS.ProcessEnv) => Promise<void>;
};

export const createLocalCommandFacade = (deps: LocalCommandFacadeDeps) =>
  createLocalRuntimeCommandRunner({
    appLogDir: deps.appLogDir,
    assertDangerousOperationApproved: deps.assertDangerousOperationApproved,
    assertRuntimeEnv: deps.assertRuntimeEnv,
    bootstrapLocalAppUser: deps.bootstrapLocalAppUser,
    buildLocalHealthUrl: deps.buildLocalHealthUrl,
    buildProfileEnv: deps.buildProfileEnv,
    checkLocalInstanceRegistryDrift: deps.checkLocalInstanceRegistryDrift,
    cliOptions: deps.cliOptions,
    composeWithMonitoringArgs: deps.composeWithMonitoringArgs,
    createLocalRuntimeAuditLogger: (input) => deps.createLocalRuntimeAuditLogger(input),
    createRepairDeps: ({ authoritative, doctorRuntime, env, rebuildAuditLogger, runtimeProfile }) => ({
      preflightDoctor: () => rebuildAuditLogger.run('preflight-doctor', doctorRuntime),
      postflightDoctor: () => rebuildAuditLogger.run('postflight-doctor', doctorRuntime),
      runMigrate: async () =>
        rebuildAuditLogger.run('db-migrate-and-app-user-bootstrap', async () => {
          deps.migrateLocalDatabase(deps.run, env);
          deps.bootstrapLocalAppUser(deps.run, env);
        }),
      reconcileInstanceRegistry: async () =>
        rebuildAuditLogger.run('instance-registry-reconcile', () =>
          deps.reconcileLocalInstanceRegistry(runtimeProfile, env, { authoritative }),
        ),
      syncTenantSecrets: () => rebuildAuditLogger.run('tenant-secret-sync', () => deps.syncLocalTenantSecretsToRegistry(env)),
      runActorBindingRepair:
        env.SVA_DOCTOR_BIND_COPY_FROM_KEYCLOAK_SUBJECT?.trim()
          ? () => rebuildAuditLogger.run('actor-binding-repair', () => deps.repairActorBindingFromEnv(env))
          : undefined,
    }),
    doctorRuntime: deps.doctorRuntime,
    downLocalInfra: deps.downLocalInfra,
    getComposeArgs: deps.getComposeArgs,
    getGitCommitSha: deps.getGitCommitSha,
    jsonOutput: deps.jsonOutput,
    localStateFile: deps.localStateFile,
    localWorkerStateFile: deps.localWorkerStateFile,
    migrateLocalDatabase: deps.migrateLocalDatabase,
    printDoctorReport: deps.printDoctorReport,
    processExitCodeSetter: (code) => {
      process.exitCode = code;
    },
    pullLocalInfra: deps.pullLocalInfra,
    readLocalState: deps.readLocalState,
    readLocalWorkerState: deps.readLocalWorkerState,
    rebuildAuditLogFile: deps.rebuildAuditLogFile,
    reconcileLocalInstanceRegistry: deps.reconcileLocalInstanceRegistry,
    repairLocalRuntimeWithDeps: deps.repairLocalRuntimeWithDeps,
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
    consoleLike: console,
  });
