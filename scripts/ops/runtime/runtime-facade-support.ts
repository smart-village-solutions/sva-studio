import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import { createRuntimeEnvContext } from './context.ts';
import { createRuntimeConfigOps, withTemporaryProcessEnv } from './runtime-config.ts';
import { createRuntimeDbOps } from './runtime-db.ts';
import { createRuntimeDoctorReportOps } from './runtime-doctor-report.ts';
import { createStudioImageVerifyEvidenceReaders } from './studio-image-verify-evidence.ts';
import { createTenantSecretRegistryOps } from './tenant-secret-registry.ts';
import { createAcceptanceRemoteStateOps } from './acceptance-remote-state.ts';
import { createRuntimeLocalInstanceOps } from './runtime-local-instance-ops.ts';
import { guardrailCheckOrder, runGuardrailReport } from '../../ci/guardrail-report.ts';
import {
  assertRequiredImagePlatform,
  formatImagePlatforms,
  inspectImagePlatforms,
} from './image-platform.ts';
import { parseJsonFromCommandOutput, type AcceptanceDeployOptions, type DoctorCheck, type RemoteRuntimeProfile } from '../runtime-env.shared.ts';
import { withoutDebugEnv } from './process.ts';

type RuntimeFacadeSupportDeps = {
  getRuntimeProfileDefinition: (runtimeProfile: RuntimeProfile) => { isLocal: boolean };
  isRemoteRuntimeProfile: (runtimeProfile: RuntimeProfile) => runtimeProfile is RemoteRuntimeProfile;
  jsonOutput: boolean;
  shouldRunLocalProvisioningWorker: (runtimeProfile: RuntimeProfile) => boolean;
};

type RuntimeContext = ReturnType<typeof createRuntimeEnvContext>;
type RuntimeConfigOps = ReturnType<typeof createRuntimeConfigOps>;
type RuntimeDbOps = ReturnType<typeof createRuntimeDbOps>;
type RuntimeDoctorReportOps = ReturnType<typeof createRuntimeDoctorReportOps>;

const createConfigSupport = (deps: RuntimeFacadeSupportDeps, context: RuntimeContext) =>
  createRuntimeConfigOps({
    getRuntimeProfileDefinition: deps.getRuntimeProfileDefinition,
    runCapture: (command, args) => context.runCapture(command, args),
  });

const createDoctorReportSupport = (
  deps: RuntimeFacadeSupportDeps,
  context: RuntimeContext,
) => {
  const studioImageVerifyEvidenceReaders = createStudioImageVerifyEvidenceReaders({
    commandExists: context.commandExists,
    runCapture: (runtimeCommand, args) => context.runCapture(runtimeCommand, args ?? []),
    runtimeArtifactsDir: context.runtimeArtifactsDir,
  });
  return createRuntimeDoctorReportOps({
    appLogDir: context.appLogDir,
    deployReportDir: context.deployReportDir,
    getRuntimeProfileDefinition: deps.getRuntimeProfileDefinition,
    guardrailCheckOrder,
    jsonOutput: deps.jsonOutput,
    runtimeArtifactsDir: context.runtimeArtifactsDir,
    runGuardrailReport,
    shouldRunLocalProvisioningWorker: deps.shouldRunLocalProvisioningWorker,
    studioImageVerifyEvidenceReaders,
  });
};

const createDbSupport = (
  deps: RuntimeFacadeSupportDeps,
  context: RuntimeContext,
  runtimeConfigOps: RuntimeConfigOps,
) =>
  createRuntimeDbOps({
    commandExists: context.commandExists,
    getConfiguredQuantumEndpoint: runtimeConfigOps.getConfiguredQuantumEndpoint,
    getConfiguredStackName: runtimeConfigOps.getConfiguredStackName,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    rootDir: context.rootDir,
    runCaptureDetailed: (command, args, env) => {
      const result = context.runCaptureDetailed(command, args, env);
      return { status: result.status ?? 1, stdout: result.stdout };
    },
    runQuantumExec: context.runQuantumExec,
  });

const buildImagePlatformDoctorCheck = (
  context: RuntimeContext,
  runtimeConfigOps: RuntimeConfigOps,
  toDoctorCheck: RuntimeDoctorReportOps['toDoctorCheck'],
  env: NodeJS.ProcessEnv,
  options?: AcceptanceDeployOptions,
): DoctorCheck => {
  const imageRef = runtimeConfigOps.resolveEffectiveImageRefForRemoteChecks(env, options);
  if (!imageRef) {
    return toDoctorCheck('image-platform', 'error', 'image_ref_missing', 'Keine Image-Referenz fuer die Plattform-Pruefung vorhanden.');
  }

  try {
    const platforms = inspectImagePlatforms(imageRef, withoutDebugEnv(env), {
      commandExists: context.commandExists,
      runCaptureDetailed: context.runCaptureDetailed,
    });
    assertRequiredImagePlatform(imageRef, platforms);
    return toDoctorCheck('image-platform', 'ok', 'image_platform_supported', 'Image-Plattform ist fuer den Linux-Swarm geeignet.', {
      imageRef,
      platforms: formatImagePlatforms(platforms),
      requiredPlatform: 'linux/amd64',
    });
  } catch (error) {
    return toDoctorCheck('image-platform', 'error', 'image_platform_unsupported', error instanceof Error ? error.message : String(error), {
      imageRef,
      requiredPlatform: 'linux/amd64',
    });
  }
};

const createLocalAndSecretSupport = (
  deps: RuntimeFacadeSupportDeps,
  context: RuntimeContext,
  runtimeDbOps: RuntimeDbOps,
) => ({
  localInstanceOps: createRuntimeLocalInstanceOps({
    createDbSqlRunner: runtimeDbOps.createDbSqlRunner,
    parseJsonFromCommandOutput,
    run: context.run,
  }),
  tenantSecretRegistryOps: createTenantSecretRegistryOps({
    createDbSqlRunner: runtimeDbOps.createDbSqlRunner,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    parseJsonFromCommandOutput,
    withTemporaryProcessEnv,
  }),
});

const createRemoteStateSupport = (context: RuntimeContext, runtimeConfigOps: RuntimeConfigOps) =>
  createAcceptanceRemoteStateOps({
    commandExists: context.commandExists,
    getConfiguredQuantumEndpoint: runtimeConfigOps.getConfiguredQuantumEndpoint,
    getConfiguredStackName: runtimeConfigOps.getConfiguredStackName,
    getRemoteAppServiceName: runtimeConfigOps.getRemoteAppServiceName,
    getRemoteComposeFile: runtimeConfigOps.getRemoteComposeFile,
    jobCommands: context.rootCommands,
    rootDir: context.rootDir,
    runCapture: context.runCapture,
    runCaptureDetailed: context.runCaptureDetailed,
  });

const pickDoctorReportSupport = (
  context: RuntimeContext,
  runtimeConfigOps: RuntimeConfigOps,
  runtimeDoctorReportOps: RuntimeDoctorReportOps,
) => ({
  buildGuardrailDoctorChecks: runtimeDoctorReportOps.buildGuardrailDoctorChecks,
  buildImagePlatformDoctorCheck: (env: NodeJS.ProcessEnv, options?: AcceptanceDeployOptions) =>
    buildImagePlatformDoctorCheck(context, runtimeConfigOps, runtimeDoctorReportOps.toDoctorCheck, env, options),
  buildLocalProvisioningWorkerCheckBase: runtimeDoctorReportOps.buildLocalProvisioningWorkerCheck,
  buildStudioImageVerifyEvidenceCheck: runtimeDoctorReportOps.buildStudioImageVerifyEvidenceCheck,
  createStepResult: runtimeDoctorReportOps.createStepResult,
  decorateDoctorCheck: runtimeDoctorReportOps.decorateDoctorCheck,
  ensureDirs: runtimeDoctorReportOps.ensureDirs,
  finalizeDoctorReport: runtimeDoctorReportOps.finalizeDoctorReport,
  printDoctorReport: runtimeDoctorReportOps.printDoctorReport,
  printJsonIfRequested: runtimeDoctorReportOps.printJsonIfRequested,
  toDoctorCheck: runtimeDoctorReportOps.toDoctorCheck,
});

const pickDbSupport = (runtimeDbOps: RuntimeDbOps) => ({
  createDbSqlRunner: runtimeDbOps.createDbSqlRunner,
  createLocalSchemaDumpRunner: runtimeDbOps.createLocalSchemaDumpRunner,
  verifyLocalDbSchemaSnapshot: runtimeDbOps.verifyLocalDbSchemaSnapshot,
});

export const createRuntimeFacadeSupport = (deps: RuntimeFacadeSupportDeps) => {
  const context = createRuntimeEnvContext();
  const runtimeConfigOps = createConfigSupport(deps, context);
  const runtimeDoctorReportOps = createDoctorReportSupport(deps, context);
  const runtimeDbOps = createDbSupport(deps, context, runtimeConfigOps);
  const { localInstanceOps, tenantSecretRegistryOps } = createLocalAndSecretSupport(deps, context, runtimeDbOps);

  return {
    acceptanceRemoteStateOps: createRemoteStateSupport(context, runtimeConfigOps),
    localInstanceOps,
    ...context,
    ...pickDoctorReportSupport(context, runtimeConfigOps, runtimeDoctorReportOps),
    ...pickDbSupport(runtimeDbOps),
    runtimeConfigOps,
    runtimeDbOps,
    tenantSecretRegistryOps,
  } as const;
};
