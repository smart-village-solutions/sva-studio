import type { DoctorCheck } from '../runtime-env.shared.ts';
import { createRuntimeDoctorOps } from './doctor.ts';
import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { RuntimeDoctorDeps } from './doctor.types.ts';

type LocalStateLike = {
  [key: string]: unknown;
} | null;

type RuntimeDoctorFacadeDeps = Omit<RuntimeDoctorDeps, 'buildLocalProvisioningWorkerCheck' | 'readLocalWorkerState'> & {
  buildLocalProvisioningWorkerCheckBase: (
    runtimeProfile: RuntimeProfile,
    workerState: unknown,
    isProcessAlive: (pid: number) => boolean,
  ) => DoctorCheck;
  isProcessAlive: (pid: number) => boolean;
  readLocalWorkerState: (path: string) => LocalStateLike;
};

export const createRuntimeDoctorFacade = (deps: RuntimeDoctorFacadeDeps) => {
  const runtimeDoctorOps = createRuntimeDoctorOps({
    assertLoginFlow: deps.assertLoginFlow,
    assertMainserverSmoke: deps.assertMainserverSmoke,
    assertMeEndpoint: deps.assertMeEndpoint,
    assertOtelLocal: deps.assertOtelLocal,
    buildAcceptanceIngressConsistencyCheck: deps.buildAcceptanceIngressConsistencyCheck,
    buildAcceptanceLiveSpecCheck: deps.buildAcceptanceLiveSpecCheck,
    buildAcceptancePostgresCheck: deps.buildAcceptancePostgresCheck,
    buildAcceptanceServiceCheck: deps.buildAcceptanceServiceCheck,
    buildAppPrincipalReadinessCheck: deps.buildAppPrincipalReadinessCheck,
    buildActorDoctorCheck: deps.buildActorDoctorCheck,
    buildFeatureFlagCheck: deps.buildFeatureFlagCheck,
    buildGuardrailDoctorChecks: deps.buildGuardrailDoctorChecks,
    buildImagePlatformDoctorCheck: deps.buildImagePlatformDoctorCheck,
    buildInstanceAuthConfigCheck: deps.buildInstanceAuthConfigCheck,
    buildInstanceHostnameMappingCheck: deps.buildInstanceHostnameMappingCheck,
    buildKeycloakClientSecretCheck: deps.buildKeycloakClientSecretCheck,
    buildLiveRuntimeEnvCheck: deps.buildLiveRuntimeEnvCheck,
    buildLocalInstanceIdentityDoctorCheck: deps.buildLocalInstanceIdentityDoctorCheck,
    buildLocalProvisioningWorkerCheck: (runtimeProfile, workerState) =>
      deps.buildLocalProvisioningWorkerCheckBase(runtimeProfile, workerState, deps.isProcessAlive),
    buildMigrationStatusCheck: deps.buildMigrationStatusCheck,
    buildObservabilityDoctorCheck: deps.buildObservabilityDoctorCheck,
    buildSchemaGuardCheck: deps.buildSchemaGuardCheck,
    buildSchemaSnapshotCheck: deps.buildSchemaSnapshotCheck,
    buildStudioImageVerifyEvidenceCheck: deps.buildStudioImageVerifyEvidenceCheck,
    buildTenantAdminClientContractCheck: deps.buildTenantAdminClientContractCheck,
    buildTenantAdminSecretContractCheck: deps.buildTenantAdminSecretContractCheck,
    buildTenantAuthProofCheck: deps.buildTenantAuthProofCheck,
    buildTenantAuthSecretContractCheck: deps.buildTenantAuthSecretContractCheck,
    checkHttpHealth: deps.checkHttpHealth,
    finalizeDoctorReport: deps.finalizeDoctorReport,
    getRuntimeContractSummary: deps.getRuntimeContractSummary,
    getRuntimeProfileDefinition: deps.getRuntimeProfileDefinition,
    getRuntimeProfileDerivedEnvKeys: deps.getRuntimeProfileDerivedEnvKeys,
    getRuntimeProfileRequiredEnvKeys: deps.getRuntimeProfileRequiredEnvKeys,
    isMainserverCheckRequired: deps.isMainserverCheckRequired,
    isRemoteRuntimeProfile: deps.isRemoteRuntimeProfile,
    localWorkerStateFile: deps.localWorkerStateFile,
    readLocalWorkerState: deps.readLocalWorkerState,
    toDoctorCheck: deps.toDoctorCheck,
    validateRuntimeProfileEnv: deps.validateRuntimeProfileEnv,
  });

  return {
    doctorRuntime: runtimeDoctorOps.doctorRuntime,
    precheckAcceptance: runtimeDoctorOps.precheckAcceptance,
  };
};
