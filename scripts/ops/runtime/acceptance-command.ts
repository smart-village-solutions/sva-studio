import type {
  AcceptanceReleaseMode,
  DoctorCheck,
  DoctorReport,
  RemoteRuntimeProfile,
  RuntimeCommand,
} from '../runtime-env.shared.ts';
import { dispatchRuntimeCommand } from './command-dispatch.ts';

type RemoteDangerousApprovalRequirement = {
  reason: string;
  token: string;
};

type AcceptanceCommandCliOptions = {
  approvalToken?: string;
  localOverrideFile?: string;
  releaseMode?: AcceptanceReleaseMode;
};

type AcceptanceCommandDeps = {
  applyCliOptionEnvOverrides: (env: NodeJS.ProcessEnv, cliOptions: AcceptanceCommandCliOptions) => NodeJS.ProcessEnv;
  assertDangerousOperationApproved: (input: {
    actualApprovalToken: string | undefined;
    expectedApprovalToken: string;
    reason: string;
  }) => void;
  assertDeterministicRemoteMutationContext: (
    env: NodeJS.ProcessEnv,
    runtimeProfile: RemoteRuntimeProfile,
    operation: 'deploy' | 'down' | 'migrate' | 'reset',
  ) => void;
  assertRuntimeEnv: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => void;
  buildProfileEnv: (
    runtimeProfile: RemoteRuntimeProfile,
    options: {
      localOverrideFile?: string;
      processEnv: NodeJS.ProcessEnv;
      rootDir: string;
    },
  ) => NodeJS.ProcessEnv;
  cliOptions: AcceptanceCommandCliOptions;
  doctorRuntime: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorReport>;
  getConfiguredStackName: (env: NodeJS.ProcessEnv) => string;
  getRuntimeStatusExecutionMode: (runtimeProfile: RemoteRuntimeProfile) => 'local' | 'remote';
  migrateAcceptance: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<void>;
  precheckAcceptance: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorReport>;
  printDoctorReport: (report: DoctorReport) => void;
  readRemoteStackEvidence: (env: NodeJS.ProcessEnv) => Promise<{ summary: string }>;
  resetAcceptance: (
    runtimeProfile: RemoteRuntimeProfile,
    env: NodeJS.ProcessEnv,
    verifyPostReset: () => Promise<void>,
  ) => Promise<void>;
  resolveRemoteDangerousApprovalRequirement: (
    runtimeProfile: RemoteRuntimeProfile,
    runtimeCommand: 'deploy' | 'down' | 'migrate' | 'reset',
    options: {
      releaseMode?: AcceptanceReleaseMode;
    },
  ) => RemoteDangerousApprovalRequirement;
  rootDir: string;
  run: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => void;
  runAcceptanceDeploy: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<void>;
  runSchemaGuard: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => { ok: boolean };
  runtimeDoctorDbCheckOps: {
    buildInstanceHostnameMappingCheck: (
      runtimeProfile: RemoteRuntimeProfile,
      env: NodeJS.ProcessEnv,
    ) => Promise<DoctorCheck>;
    runSchemaGuard: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => { ok: boolean };
  };
  smokeRuntime: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<void>;
  summarizeSchemaGuardFailures: (report: { ok: boolean }) => string | undefined;
};

const createBlockedRemoteMutationError = (
  runtimeCommand: RuntimeCommand,
  runtimeProfile: RemoteRuntimeProfile,
) =>
  new Error(
    `Direkte Remote-Operationen ueber ${runtimeCommand} sind gesperrt. Nutze den kanonischen Pfad pnpm env:deploy:${runtimeProfile}.`,
  );

const assertApprovedRemoteMutation = (
  deps: AcceptanceCommandDeps,
  env: NodeJS.ProcessEnv,
  runtimeProfile: RemoteRuntimeProfile,
  runtimeCommand: 'deploy' | 'down' | 'migrate' | 'reset',
) => {
  deps.assertDeterministicRemoteMutationContext(env, runtimeProfile, runtimeCommand);
  const approvalRequirement = deps.resolveRemoteDangerousApprovalRequirement(runtimeProfile, runtimeCommand, {
    releaseMode: deps.cliOptions.releaseMode,
  });
  deps.assertDangerousOperationApproved({
    actualApprovalToken: deps.cliOptions.approvalToken,
    expectedApprovalToken: approvalRequirement.token,
    reason: approvalRequirement.reason,
  });
};

export const createAcceptanceCommandRunner = (deps: AcceptanceCommandDeps) => {
  return async (runtimeProfile: RemoteRuntimeProfile, runtimeCommand: RuntimeCommand) => {
    const env = deps.applyCliOptionEnvOverrides(
      deps.buildProfileEnv(runtimeProfile, {
        localOverrideFile: deps.cliOptions.localOverrideFile,
        processEnv: process.env,
        rootDir: deps.rootDir,
      }),
      deps.cliOptions,
    );
    const stackName = deps.getConfiguredStackName(env);

    await dispatchRuntimeCommand(runtimeCommand, {
      up: () => {
        throw createBlockedRemoteMutationError(runtimeCommand, runtimeProfile);
      },
      update: () => {
        throw createBlockedRemoteMutationError(runtimeCommand, runtimeProfile);
      },
      repair: () => {
        throw createBlockedRemoteMutationError(runtimeCommand, runtimeProfile);
      },
      reconcile: () => {
        throw createBlockedRemoteMutationError(runtimeCommand, runtimeProfile);
      },
      'verify-schema-snapshot': () => {
        throw createBlockedRemoteMutationError(runtimeCommand, runtimeProfile);
      },
      down: () => {
        assertApprovedRemoteMutation(deps, env, runtimeProfile, 'down');
        deps.run('docker', ['stack', 'rm', stackName], env);
        console.log(`Stack ${stackName} entfernt.`);
      },
      status: async () => {
        deps.assertRuntimeEnv(runtimeProfile, env);
        if (deps.getRuntimeStatusExecutionMode(runtimeProfile) === 'remote') {
          const evidence = await deps.readRemoteStackEvidence(env);
          console.log(evidence.summary);
          return;
        }

        deps.run('docker', ['stack', 'services', stackName], env);
        deps.run('docker', ['stack', 'ps', stackName], env);
      },
      precheck: async () => {
        const report = await deps.precheckAcceptance(runtimeProfile, env);
        deps.printDoctorReport(report);
        if (report.status === 'error') {
          process.exitCode = 1;
        }
      },
      deploy: async () => {
        deps.assertRuntimeEnv(runtimeProfile, env);
        assertApprovedRemoteMutation(deps, env, runtimeProfile, 'deploy');
        env.QUANTUM_ENVIRONMENT = env.QUANTUM_ENVIRONMENT?.trim() || runtimeProfile;
        await deps.runAcceptanceDeploy(runtimeProfile, env);
      },
      smoke: async () => {
        deps.assertRuntimeEnv(runtimeProfile, env);
        await deps.smokeRuntime(runtimeProfile, env);
        console.log(`Smoke-Checks fuer ${runtimeProfile} erfolgreich.`);
      },
      migrate: async () => {
        assertApprovedRemoteMutation(deps, env, runtimeProfile, 'migrate');
        await deps.migrateAcceptance(runtimeProfile, env);
        const hostnameCheck = await deps.runtimeDoctorDbCheckOps.buildInstanceHostnameMappingCheck(runtimeProfile, env);
        if (hostnameCheck.status !== 'ok') {
          throw new Error(hostnameCheck.message);
        }
        const schemaGuard = deps.runtimeDoctorDbCheckOps.runSchemaGuard(runtimeProfile, env);
        if (!schemaGuard.ok) {
          throw new Error(
            `Kritische IAM-Schema-Drift nach Migration fuer ${runtimeProfile}: ${deps.summarizeSchemaGuardFailures(schemaGuard)}`,
          );
        }
        console.log(`Migrationen fuer ${runtimeProfile} abgeschlossen.`);
      },
      reset: async () => {
        deps.assertRuntimeEnv(runtimeProfile, env);
        assertApprovedRemoteMutation(deps, env, runtimeProfile, 'reset');
        await deps.resetAcceptance(runtimeProfile, env, async () => {
          const schemaGuard = deps.runSchemaGuard(runtimeProfile, env);
          if (!schemaGuard.ok) {
            throw new Error(
              `Kritische IAM-Schema-Drift nach Reset fuer ${runtimeProfile}: ${deps.summarizeSchemaGuardFailures(schemaGuard)}`,
            );
          }
        });
        console.log(`Postgres und Redis fuer ${runtimeProfile} wurden zurueckgesetzt.`);
      },
      doctor: async () => {
        const report = await deps.doctorRuntime(runtimeProfile, env);
        deps.printDoctorReport(report);
        if (report.status === 'error') {
          process.exitCode = 1;
        }
      },
    });
  };
};
