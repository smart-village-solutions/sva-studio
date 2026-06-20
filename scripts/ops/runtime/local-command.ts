import type { RuntimeCommand, RuntimeProfile } from '../runtime-env.shared.ts';
import type { LocalRuntimeCommandDeps } from './local-command.types.ts';

type LocalCommandAuditLogger = NonNullable<ReturnType<LocalRuntimeCommandDeps['createLocalRuntimeAuditLogger']>>;

type LocalCommandContext = {
  deps: LocalRuntimeCommandDeps;
  env: NodeJS.ProcessEnv;
  rebuildAuditLogger: LocalCommandAuditLogger | null;
  runtimeCommand: RuntimeCommand;
  runtimeProfile: RuntimeProfile;
};

type LocalCommandHandler = (context: LocalCommandContext) => Promise<void>;

const createLocalCommandContext = (
  deps: LocalRuntimeCommandDeps,
  runtimeProfile: RuntimeProfile,
  runtimeCommand: RuntimeCommand,
): LocalCommandContext => {
  const env = deps.buildProfileEnv(runtimeProfile, {
    localOverrideFile: deps.cliOptions.localOverrideFile,
    processEnv: process.env,
    rootDir: deps.rootDir,
  });
  const rebuildAuditLogger = deps.shouldAuditLocalRuntimeCommand(runtimeCommand)
    ? deps.createLocalRuntimeAuditLogger({
        authoritative: Boolean(deps.cliOptions.authoritative),
        composeMode: env.SVA_ENABLE_MONITORING === 'false' ? 'base' : 'with-monitoring',
        driftCheckEnabled: runtimeCommand === 'up' || runtimeCommand === 'update',
        gitSha: deps.getGitCommitSha(),
        jsonOutput: deps.jsonOutput,
        logFile: deps.rebuildAuditLogFile,
        runtimeCommand,
        runtimeProfile,
        workerEnabled: deps.shouldRunLocalProvisioningWorker(runtimeProfile),
      })
    : null;

  return { deps, env, rebuildAuditLogger, runtimeCommand, runtimeProfile };
};

const runWithCommandAudit = async <T>(
  { rebuildAuditLogger }: LocalCommandContext,
  operation: () => Promise<T> | T,
): Promise<T> => rebuildAuditLogger ? rebuildAuditLogger.run('command', operation) : await operation();

const runLocalInfraRebuild = async (context: LocalCommandContext, phase: 'infra-up' | 'infra-pull') => {
  const { deps, env, rebuildAuditLogger } = context;
  const operation = phase === 'infra-pull'
    ? () => deps.pullLocalInfra({ composeArgs: deps.getComposeArgs(env), env, run: deps.run })
    : () => deps.upLocalInfra({ composeArgs: deps.getComposeArgs(env), env, run: deps.run });
  await rebuildAuditLogger?.run(phase, operation);
};

const runLocalPostInfraBootstrap = async (context: LocalCommandContext) => {
  const { deps, env, rebuildAuditLogger, runtimeCommand, runtimeProfile } = context;
  await rebuildAuditLogger?.run('db-migrate', () => deps.migrateLocalDatabase(deps.run, env));
  await rebuildAuditLogger?.run('bootstrap-app-user', () => deps.bootstrapLocalAppUser(deps.run, env));
  if (runtimeCommand === 'up' || runtimeCommand === 'update') {
    await rebuildAuditLogger?.run('instance-registry-drift-check', () => deps.checkLocalInstanceRegistryDrift(runtimeProfile, env));
  }
};

const startLocalRuntimeProcesses = async (context: LocalCommandContext) => {
  const { deps, env, rebuildAuditLogger, runtimeProfile } = context;
  await rebuildAuditLogger?.run('app-start', () =>
    deps.startLocalApp({
      appLogDir: deps.appLogDir,
      env,
      healthUrl: deps.buildLocalHealthUrl(env),
      localStateFile: deps.localStateFile,
      rootDir: deps.rootDir,
      runtimeProfile,
    }),
  );
  if (deps.shouldRunLocalProvisioningWorker(runtimeProfile)) {
    await rebuildAuditLogger?.run('worker-start', () =>
      deps.startLocalProvisioningWorker({
        appLogDir: deps.appLogDir,
        env,
        localWorkerStateFile: deps.localWorkerStateFile,
        rootDir: deps.rootDir,
        runtimeProfile,
      }),
    );
  }
};

const stopLocalRuntimeProcesses = async ({ deps, rebuildAuditLogger }: LocalCommandContext) => {
  await rebuildAuditLogger?.run('worker-stop', () =>
    deps.stopLocalProvisioningWorker({ localWorkerStateFile: deps.localWorkerStateFile, rootDir: deps.rootDir }),
  );
  await rebuildAuditLogger?.run('app-stop', () => deps.stopLocalApp({ localStateFile: deps.localStateFile, rootDir: deps.rootDir }));
};

const runUpCommand: LocalCommandHandler = async (context) => {
  const { deps, env, runtimeProfile } = context;
  await runWithCommandAudit(context, async () => {
    deps.assertRuntimeEnv(runtimeProfile, env);
    await runLocalInfraRebuild(context, 'infra-up');
    await runLocalPostInfraBootstrap(context);
    await startLocalRuntimeProcesses(context);
    deps.consoleLike.log(`Profil ${runtimeProfile} gestartet.`);
  });
};

const runDownCommand: LocalCommandHandler = async (context) => {
  const { deps, env, rebuildAuditLogger, runtimeProfile } = context;
  await runWithCommandAudit(context, async () => {
    await stopLocalRuntimeProcesses(context);
    await rebuildAuditLogger?.run('infra-down', () =>
      deps.downLocalInfra({ composeArgs: deps.composeWithMonitoringArgs, env, run: deps.run }),
    );
    deps.consoleLike.log(`Profil ${runtimeProfile} gestoppt.`);
  });
};

const runUpdateCommand: LocalCommandHandler = async (context) => {
  const { deps, env, runtimeProfile } = context;
  await runWithCommandAudit(context, async () => {
    deps.assertRuntimeEnv(runtimeProfile, env);
    await runLocalInfraRebuild(context, 'infra-pull');
    await runLocalInfraRebuild(context, 'infra-up');
    await runLocalPostInfraBootstrap(context);
    await stopLocalRuntimeProcesses(context);
    await startLocalRuntimeProcesses(context);
    deps.consoleLike.log(`Profil ${runtimeProfile} aktualisiert.`);
  });
};

const runStatusCommand: LocalCommandHandler = async ({ deps, env, runtimeProfile }) => {
  const state = deps.readLocalState(deps.localStateFile);
  const worker = deps.readLocalWorkerState(deps.localWorkerStateFile);
  deps.consoleLike.log(JSON.stringify({ app: state, profile: runtimeProfile, worker }, null, 2));
  deps.run('docker', [...deps.getComposeArgs(env), 'ps'], env);
};

const runSmokeCommand: LocalCommandHandler = async ({ deps, env, runtimeProfile }) => {
  await deps.smokeRuntime(runtimeProfile, env);
  deps.consoleLike.log(`Smoke-Checks fuer ${runtimeProfile} erfolgreich.`);
};

const runMigrateCommand: LocalCommandHandler = async (context) => {
  const { deps, env, rebuildAuditLogger, runtimeProfile } = context;
  await runWithCommandAudit(context, async () => {
    deps.assertRuntimeEnv(runtimeProfile, env);
    await rebuildAuditLogger?.run('db-migrate', () => deps.migrateLocalDatabase(deps.run, env));
    await rebuildAuditLogger?.run('bootstrap-app-user', () => deps.bootstrapLocalAppUser(deps.run, env));
    await rebuildAuditLogger?.run('schema-guard', () => {
      const schemaGuard = deps.runSchemaGuard(runtimeProfile, env);
      if (!schemaGuard.ok) {
        throw new Error(`Kritische IAM-Schema-Drift nach Migration: ${deps.summarizeSchemaGuardFailures(schemaGuard)}`);
      }
    });
    deps.consoleLike.log(`Migrationen fuer ${runtimeProfile} abgeschlossen.`);
  });
};

const assertLocalDangerousApproval = (
  { deps, runtimeProfile }: LocalCommandContext,
  runtimeCommand: 'reconcile' | 'repair',
) => {
  const approvalRequirement = deps.resolveLocalDangerousApprovalRequirement(runtimeProfile, runtimeCommand, {
    authoritative: Boolean(deps.cliOptions.authoritative),
  });
  if (!approvalRequirement) {
    return;
  }
  deps.assertDangerousOperationApproved({
    actualApprovalToken: deps.cliOptions.approvalToken,
    expectedApprovalToken: approvalRequirement.token,
    reason: approvalRequirement.reason,
  });
};

const runRepairCommand: LocalCommandHandler = async (context) => {
  const { deps, env, rebuildAuditLogger, runtimeProfile } = context;
  await runWithCommandAudit(context, async () => {
    deps.assertRuntimeEnv(runtimeProfile, env);
    assertLocalDangerousApproval(context, 'repair');
    if (!rebuildAuditLogger) {
      throw new Error('Lokaler Repair erwartet einen Audit-Logger.');
    }
    const repairResult = await deps.repairLocalRuntimeWithDeps(
      deps.createRepairDeps({
        authoritative: Boolean(deps.cliOptions.authoritative),
        doctorRuntime: () => deps.doctorRuntime(runtimeProfile, env),
        env,
        rebuildAuditLogger,
        runtimeProfile,
      }),
      { authoritative: Boolean(deps.cliOptions.authoritative) },
    );

    if (deps.jsonOutput) {
      deps.consoleLike.log(JSON.stringify({
        authoritative: Boolean(deps.cliOptions.authoritative),
        postflightReport: repairResult.postflightReport,
        preflightReport: repairResult.preflightReport,
        tenantSecretSync: repairResult.tenantSecretSync,
      }, null, 2));
      return;
    }
    deps.consoleLike.log(`Lokaler Runtime-Repair fuer ${runtimeProfile} abgeschlossen.`);
    deps.consoleLike.log(`  Tenant-Secrets geheilt: ${repairResult.tenantSecretSync.healedInstanceIds.join(', ') || 'keine'}`);
    if (repairResult.tenantSecretSync.errors.length > 0) {
      deps.consoleLike.log(`  Secret-Fehler: ${repairResult.tenantSecretSync.errors.join(' | ')}`);
    }
    deps.printDoctorReport(repairResult.postflightReport);
  });
};

const runReconcileCommand: LocalCommandHandler = async (context) => {
  const { deps, env, rebuildAuditLogger, runtimeProfile } = context;
  await runWithCommandAudit(context, async () => {
    deps.assertRuntimeEnv(runtimeProfile, env);
    assertLocalDangerousApproval(context, 'reconcile');
    await rebuildAuditLogger?.run('instance-registry-reconcile', () =>
      deps.reconcileLocalInstanceRegistry(runtimeProfile, env, { authoritative: deps.cliOptions.authoritative }),
    );
    deps.consoleLike.log(`Lokale Instanz-Registry fuer ${runtimeProfile} abgeglichen.`);
  });
};

const runDoctorCommand: LocalCommandHandler = async ({ deps, env, runtimeProfile }) => {
  const report = await deps.doctorRuntime(runtimeProfile, env);
  deps.printDoctorReport(report);
  if (report.status === 'error') {
    deps.processExitCodeSetter(1);
  }
};

const runVerifySchemaSnapshotCommand: LocalCommandHandler = async ({ deps, env, runtimeProfile }) => {
  deps.assertRuntimeEnv(runtimeProfile, env);
  const report = deps.verifyLocalDbSchemaSnapshot(env);
  if (deps.jsonOutput) {
    deps.consoleLike.log(JSON.stringify(report, null, 2));
  } else if (report.status === 'ok') {
    deps.consoleLike.log('Der DB-Schema-Snapshot entspricht dem aktuellen lokalen Datenbankstand.');
  } else {
    deps.consoleLike.log('Der DB-Schema-Snapshot driftet vom aktuellen lokalen Datenbankstand ab.');
    deps.consoleLike.log(`  Fehlende Objekte: ${report.missingObjects.join(', ') || 'keine'}`);
    deps.consoleLike.log(`  Unerwartete Objekte: ${report.unexpectedObjects.join(', ') || 'keine'}`);
  }

  if (report.status === 'drift') {
    deps.processExitCodeSetter(1);
  }
};

const localCommandHandlers: Partial<Record<RuntimeCommand, LocalCommandHandler>> = {
  doctor: runDoctorCommand,
  down: runDownCommand,
  migrate: runMigrateCommand,
  reconcile: runReconcileCommand,
  repair: runRepairCommand,
  smoke: runSmokeCommand,
  status: runStatusCommand,
  up: runUpCommand,
  update: runUpdateCommand,
  'verify-schema-snapshot': runVerifySchemaSnapshotCommand,
};

export const createLocalRuntimeCommandRunner = (deps: LocalRuntimeCommandDeps) => {
  return async (runtimeProfile: RuntimeProfile, runtimeCommand: RuntimeCommand) => {
    const handler = localCommandHandlers[runtimeCommand];
    if (!handler) {
      throw new Error(`Lokales Runtime-Kommando nicht unterstuetzt: ${runtimeCommand}`);
    }
    await handler(createLocalCommandContext(deps, runtimeProfile, runtimeCommand));
  };
};
