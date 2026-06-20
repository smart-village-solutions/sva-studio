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

export const createRuntimeFacadeSupport = (deps: RuntimeFacadeSupportDeps) => {
  const runtimeContext = createRuntimeEnvContext();
  const {
    appLogDir,
    commandExists,
    deployReportDir,
    gooseConfig,
    gooseMigrationsDir,
    localStateFile,
    localWorkerStateFile,
    rebuildAuditLogFile,
    rootCommands,
    rootDir,
    run,
    runCapture,
    runCaptureDetailed,
    runQuantumExec,
    runtimeArtifactsDir,
  } = runtimeContext;

  const runtimeConfigOps = createRuntimeConfigOps({
    getRuntimeProfileDefinition: deps.getRuntimeProfileDefinition,
    runCapture: (command, args) => runCapture(command, args),
  });

  const studioImageVerifyEvidenceReaders = createStudioImageVerifyEvidenceReaders({
    commandExists,
    runCapture: (runtimeCommand, args) => runCapture(runtimeCommand, args ?? []),
    runtimeArtifactsDir,
  });

  const runtimeDoctorReportOps = createRuntimeDoctorReportOps({
    appLogDir,
    deployReportDir,
    getRuntimeProfileDefinition: deps.getRuntimeProfileDefinition,
    guardrailCheckOrder,
    jsonOutput: deps.jsonOutput,
    runtimeArtifactsDir,
    runGuardrailReport,
    shouldRunLocalProvisioningWorker: deps.shouldRunLocalProvisioningWorker,
    studioImageVerifyEvidenceReaders,
  });

  const runtimeDbOps = createRuntimeDbOps({
    commandExists,
    getConfiguredQuantumEndpoint: runtimeConfigOps.getConfiguredQuantumEndpoint,
    getConfiguredStackName: runtimeConfigOps.getConfiguredStackName,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    rootDir,
    runCaptureDetailed: (command, args, env) => {
      const result = runCaptureDetailed(command, args, env);
      return {
        status: result.status ?? 1,
        stdout: result.stdout,
      };
    },
    runQuantumExec,
  });

  const {
    buildLocalProvisioningWorkerCheck: buildLocalProvisioningWorkerCheckBase,
    buildStudioImageVerifyEvidenceCheck,
    createStepResult,
    decorateDoctorCheck,
    ensureDirs,
    finalizeDoctorReport,
    printDoctorReport,
    printJsonIfRequested,
    toDoctorCheck,
    buildGuardrailDoctorChecks,
  } = runtimeDoctorReportOps;

  const {
    createDbSqlRunner,
    createLocalSchemaDumpRunner,
    verifyLocalDbSchemaSnapshot,
  } = runtimeDbOps;

  const localInstanceOps = createRuntimeLocalInstanceOps({
    createDbSqlRunner,
    parseJsonFromCommandOutput,
    run,
  });

  const tenantSecretRegistryOps = createTenantSecretRegistryOps({
    createDbSqlRunner,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    parseJsonFromCommandOutput,
    withTemporaryProcessEnv,
  });

  const acceptanceRemoteStateOps = createAcceptanceRemoteStateOps({
    commandExists,
    getConfiguredQuantumEndpoint: runtimeConfigOps.getConfiguredQuantumEndpoint,
    getConfiguredStackName: runtimeConfigOps.getConfiguredStackName,
    getRemoteAppServiceName: runtimeConfigOps.getRemoteAppServiceName,
    getRemoteComposeFile: runtimeConfigOps.getRemoteComposeFile,
    jobCommands: rootCommands,
    rootDir,
    runCapture,
    runCaptureDetailed,
  });

  const buildImagePlatformDoctorCheck = (
    env: NodeJS.ProcessEnv,
    options?: AcceptanceDeployOptions,
  ): DoctorCheck => {
    const imageRef = runtimeConfigOps.resolveEffectiveImageRefForRemoteChecks(env, options);

    if (!imageRef) {
      return toDoctorCheck(
        'image-platform',
        'error',
        'image_ref_missing',
        'Keine Image-Referenz fuer die Plattform-Pruefung vorhanden.',
      );
    }

    try {
      const platforms = inspectImagePlatforms(imageRef, withoutDebugEnv(env), {
        commandExists,
        runCaptureDetailed,
      });
      assertRequiredImagePlatform(imageRef, platforms);
      return toDoctorCheck(
        'image-platform',
        'ok',
        'image_platform_supported',
        'Image-Plattform ist fuer den Linux-Swarm geeignet.',
        {
          imageRef,
          platforms: formatImagePlatforms(platforms),
          requiredPlatform: 'linux/amd64',
        },
      );
    } catch (error) {
      return toDoctorCheck(
        'image-platform',
        'error',
        'image_platform_unsupported',
        error instanceof Error ? error.message : String(error),
        {
          imageRef,
          requiredPlatform: 'linux/amd64',
        },
      );
    }
  };

  const contextSupport = {
    appLogDir,
    commandExists,
    deployReportDir,
    gooseConfig,
    gooseMigrationsDir,
    localStateFile,
    localWorkerStateFile,
    rebuildAuditLogFile,
    rootCommands,
    rootDir,
    run,
    runCapture,
    runCaptureDetailed,
    runQuantumExec,
    runtimeArtifactsDir,
  } as const;

  const doctorReportSupport = {
    buildGuardrailDoctorChecks,
    buildImagePlatformDoctorCheck,
    buildLocalProvisioningWorkerCheckBase,
    buildStudioImageVerifyEvidenceCheck,
    createStepResult,
    decorateDoctorCheck,
    ensureDirs,
    finalizeDoctorReport,
    printDoctorReport,
    printJsonIfRequested,
    toDoctorCheck,
  } as const;

  const dbSupport = {
    createDbSqlRunner,
    createLocalSchemaDumpRunner,
    verifyLocalDbSchemaSnapshot,
  } as const;

  return {
    acceptanceRemoteStateOps,
    localInstanceOps,
    ...contextSupport,
    ...doctorReportSupport,
    ...dbSupport,
    runtimeConfigOps,
    runtimeDbOps,
    tenantSecretRegistryOps,
  } as const;
};
