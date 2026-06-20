import { resolve } from 'node:path';

import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type {
  AcceptanceDeployReport,
  AcceptanceDeployOptions,
  DoctorCheck,
  RemoteRuntimeProfile,
} from '../runtime-env.shared.ts';
import { createAcceptanceMaintenanceOps } from './acceptance-maintenance.ts';
import { createAcceptanceDeployRunner } from './acceptance-deploy.ts';
import {
  buildAcceptanceIngressConsistencyCheck as buildAcceptanceIngressConsistencyCheckWithDeps,
  buildAcceptanceLiveSpecCheck as buildAcceptanceLiveSpecCheckWithDeps,
  buildAcceptanceServiceCheck as buildAcceptanceServiceCheckWithDeps,
  buildAppPrincipalReadinessCheck as buildAppPrincipalReadinessCheckWithDeps,
} from './acceptance-runtime-checks.ts';
import type { ComposeDocument } from './deploy-project.ts';
import type { SchemaGuardReport } from '../../../packages/auth-runtime/src/iam-account-management/schema-guard.ts';
import type { AcceptanceRuntimeFacadeDeps } from './acceptance-runtime-facade.types.ts';

type AcceptanceDeployFacadeInput = Pick<
  AcceptanceRuntimeFacadeDeps,
  'runImageSmoke' | 'runInternalVerify' | 'writeAcceptanceDeployReport'
> & {
  captureAcceptanceStackStatus: (env: NodeJS.ProcessEnv) => Promise<{ services?: string; tasks?: string }>;
  createBaseAcceptanceDeployReport: (
    runtimeProfile: RemoteRuntimeProfile,
    env: NodeJS.ProcessEnv,
    options: AcceptanceDeployOptions,
    migrationFiles: readonly string[],
  ) => AcceptanceDeployReport;
  deployAcceptanceStack: (env: NodeJS.ProcessEnv) => void;
  runAcceptanceDeployExternalSmoke: AcceptanceRuntimeFacadeDeps['runExternalSmokeWithWarmup'];
};

export const createAcceptanceRuntimeCore = (deps: AcceptanceRuntimeFacadeDeps) => {
  const renderRemoteComposeDocument = (env: NodeJS.ProcessEnv): ComposeDocument =>
    JSON.parse(
      deps.runCapture('docker', ['compose', '-f', resolve(deps.rootDir, deps.getRemoteComposeFile(env)), 'config', '--format', 'json'], env),
    ) as ComposeDocument;

  const acceptanceRuntimeCheckDeps = {
    assertComposeServiceIngressLabels: deps.assertComposeServiceIngressLabels,
    assertComposeServiceNetworks: deps.assertComposeServiceNetworks,
    checkHttpHealth: deps.checkHttpHealth,
    getConfiguredQuantumEndpoint: deps.getConfiguredQuantumEndpoint,
    getConfiguredStackName: deps.getConfiguredStackName,
    getRemoteAppServiceName: deps.getRemoteAppServiceName,
    getRuntimeContractSummary: deps.getRuntimeContractSummary,
    getRuntimeProfileDerivedEnvKeys: deps.getRuntimeProfileDerivedEnvKeys,
    getRuntimeProfileRequiredEnvKeys: deps.getRuntimeProfileRequiredEnvKeys,
    inspectRemoteServiceContract: deps.inspectRemoteServiceContract,
    readRemoteStackEvidence: deps.acceptanceRemoteStateOps.readRemoteStackEvidence,
    renderRemoteComposeDocument,
    resolveLiveImageFallback: async (env: NodeJS.ProcessEnv, input: { stackName: string }) => {
      const liveContractResult = deps.runCaptureDetailed(
        'docker',
        ['service', 'inspect', `${input.stackName}_app`, '--format', '{{.Spec.TaskTemplate.ContainerSpec.Image}}'],
        env,
      );
      return liveContractResult.status === 0 ? liveContractResult.stdout.trim() : '';
    },
    toDoctorCheck: deps.toDoctorCheck,
  };

  const buildAcceptanceServiceCheck = (env: NodeJS.ProcessEnv): Promise<DoctorCheck> =>
    buildAcceptanceServiceCheckWithDeps(acceptanceRuntimeCheckDeps as never, env);

  const buildAcceptanceIngressConsistencyCheck = (env: NodeJS.ProcessEnv): Promise<DoctorCheck> =>
    buildAcceptanceIngressConsistencyCheckWithDeps(acceptanceRuntimeCheckDeps as never, env);

  const buildAcceptanceLiveSpecCheck = (
    runtimeProfile: RuntimeProfile,
    env: NodeJS.ProcessEnv,
    options: AcceptanceDeployOptions,
  ): Promise<DoctorCheck> =>
    buildAcceptanceLiveSpecCheckWithDeps(acceptanceRuntimeCheckDeps as never, runtimeProfile, env, options);

  const buildAppPrincipalReadinessCheck = (env: NodeJS.ProcessEnv): Promise<DoctorCheck> =>
    buildAppPrincipalReadinessCheckWithDeps(acceptanceRuntimeCheckDeps as never, env);

  const acceptanceMaintenanceOps = createAcceptanceMaintenanceOps({
    assertComposeServiceIngressLabels: deps.assertComposeServiceIngressLabels,
    assertComposeServiceNetworks: deps.assertComposeServiceNetworks,
    buildAcceptanceIngressConsistencyCheck,
    buildAppPrincipalReadinessCheck,
    buildLocalRuntimeDeployReportPaths: deps.buildAcceptanceReportPaths,
    buildQuantumDeployComposeDocument: deps.buildQuantumDeployComposeDocument,
    checkHttpHealth: deps.checkHttpHealth,
    commandExists: deps.commandExists,
    createStepResult: deps.createStepResult,
    deployReportDir: deps.deployReportDir,
    getConfiguredQuantumEndpoint: deps.getConfiguredQuantumEndpoint,
    getConfiguredStackName: deps.getConfiguredStackName,
    getGooseConfiguredVersion: () => deps.getGooseConfiguredVersion() ?? '',
    getRemoteAppServiceName: deps.getRemoteAppServiceName,
    getRemoteComposeFile: deps.getRemoteComposeFile,
    getRuntimeContractSummary: deps.getRuntimeContractSummary,
    getRuntimeProfileDerivedEnvKeys: deps.getRuntimeProfileDerivedEnvKeys,
    getRuntimeProfileRequiredEnvKeys: deps.getRuntimeProfileRequiredEnvKeys,
    inspectRemoteServiceContract: deps.inspectRemoteServiceContract as never,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    listGooseMigrationFiles: deps.listGooseMigrationFiles,
    parseJsonFromCommandOutput: deps.parseJsonFromCommandOutput,
    readRemoteStackEvidence: deps.acceptanceRemoteStateOps.readRemoteStackEvidence,
    rootDir: deps.rootDir,
    run: deps.run,
    runBootstrapJobAgainstAcceptance: deps.acceptanceRemoteStateOps.runBootstrapJobAgainstAcceptance,
    runCapture: deps.runCapture,
    runCaptureDetailed: (command, args, env) => {
      const result = deps.runCaptureDetailed(command, args, env);
      return {
        status: result.status ?? 1,
        stdout: result.stdout,
      };
    },
    runMigrationJobAgainstAcceptance: deps.acceptanceRemoteStateOps.runMigrationJobAgainstAcceptance,
    runQuantumExec: deps.runQuantumExec,
    runSchemaGuard: (runtimeProfile, env) => deps.runSchemaGuard(runtimeProfile as RemoteRuntimeProfile, env),
    shouldSkipQuantumPrePull: deps.shouldSkipQuantumPrePull,
    summarizeSchemaGuardFailures: (report) => deps.summarizeSchemaGuardFailures(report as SchemaGuardReport),
    withoutDebugEnv: deps.withoutDebugEnv,
  });

  return {
    acceptanceMaintenanceOps,
    buildAcceptanceIngressConsistencyCheck,
    buildAcceptanceLiveSpecCheck,
    buildAcceptancePostgresCheck: (env: NodeJS.ProcessEnv) =>
      deps.toDoctorCheck(
        'postgres-health',
        'skipped',
        'postgres_health_deferred',
        `Remote-Postgres wird im Standardpfad nicht mehr ueber quantum-cli exec geprueft; massgeblich sind Swarm-Service-Sicht, /health/ready und Bootstrap-/Schema-Evidenz (${env.POSTGRES_USER ?? 'sva'}@${env.POSTGRES_DB ?? 'sva_studio'}).`,
      ),
    buildAcceptanceServiceCheck,
    buildAppPrincipalReadinessCheck,
    buildSwarmServicePresenceProbe: acceptanceMaintenanceOps.buildSwarmServicePresenceProbe,
    captureAcceptanceStackStatus: acceptanceMaintenanceOps.captureAcceptanceStackStatus,
    deployAcceptanceStack: acceptanceMaintenanceOps.deployAcceptanceStack,
    migrateAcceptance: acceptanceMaintenanceOps.migrateAcceptance,
    resetAcceptance: acceptanceMaintenanceOps.resetAcceptance,
    writeAcceptanceDeployReport: acceptanceMaintenanceOps.writeAcceptanceDeployReport,
  };
};

export const createAcceptanceDeployFacade = (
  deps: AcceptanceRuntimeFacadeDeps,
  input: AcceptanceDeployFacadeInput,
) =>
  createAcceptanceDeployRunner(
    {
      assertDeterministicRemoteMutationContext: deps.assertDeterministicRemoteMutationContext,
      buildInstanceHostnameMappingCheck: deps.buildInstanceHostnameMappingCheck,
      captureAcceptanceStackStatus: input.captureAcceptanceStackStatus,
      createBaseAcceptanceDeployReport: input.createBaseAcceptanceDeployReport,
      createStepResult: deps.createStepResult,
      deployAcceptanceStack: input.deployAcceptanceStack,
      getGooseConfiguredVersion: () => deps.getGooseConfiguredVersion() ?? '',
      jsonOutput: deps.jsonOutput,
      listGooseMigrationFiles: deps.listGooseMigrationFiles,
      precheckAcceptance: deps.precheckAcceptance,
      printJsonIfRequested: deps.printJsonIfRequested,
      resolveAcceptanceDeployOptions: deps.resolveAcceptanceDeployOptions,
      runBootstrapJobAgainstAcceptance: deps.acceptanceRemoteStateOps.runBootstrapJobAgainstAcceptance,
      runExternalSmokeWithWarmup: input.runAcceptanceDeployExternalSmoke,
      runImageSmoke: input.runImageSmoke,
      runInternalVerify: input.runInternalVerify,
      runMigrationJobAgainstAcceptance: deps.acceptanceRemoteStateOps.runMigrationJobAgainstAcceptance,
      runSchemaGuard: deps.runSchemaGuard,
      summarizeSchemaGuardFailures: (report) => deps.summarizeSchemaGuardFailures(report as SchemaGuardReport) ?? 'unbekannt',
      waitForPostDeployStabilization: deps.waitForPostDeployStabilization,
      writeAcceptanceDeployReport: input.writeAcceptanceDeployReport,
    },
    deps.cliOptions,
  );
