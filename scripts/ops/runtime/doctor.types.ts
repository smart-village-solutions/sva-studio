import type { AcceptanceDeployOptions, DoctorCheck, DoctorReport, RemoteRuntimeProfile, RuntimeProfile } from '../runtime-env.shared.ts';

export type RuntimeProfileValidation = {
  derived: readonly string[] | Record<string, unknown>;
  invalid: readonly string[];
  missing: readonly string[];
  placeholders: readonly string[];
};

export type HttpHealthResult = {
  payload?: unknown;
  response: { ok: boolean; status: number };
};

export type RuntimeDoctorDeps = {
  assertLoginFlow: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Promise<void>;
  assertMainserverSmoke: (env: NodeJS.ProcessEnv) => Promise<void>;
  assertMeEndpoint: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Promise<void>;
  assertOtelLocal: (env: NodeJS.ProcessEnv) => Promise<void>;
  buildAcceptanceIngressConsistencyCheck: (env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildAcceptanceLiveSpecCheck: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv, options: AcceptanceDeployOptions) => Promise<DoctorCheck>;
  buildAcceptancePostgresCheck: (env: NodeJS.ProcessEnv) => DoctorCheck;
  buildAcceptanceServiceCheck: (env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildAppPrincipalReadinessCheck: (env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildFeatureFlagCheck: (env: NodeJS.ProcessEnv) => DoctorCheck;
  buildGuardrailDoctorChecks: (runtimeProfile: RuntimeProfile, options: { readonly env: NodeJS.ProcessEnv }) => Promise<readonly DoctorCheck[]>;
  buildImagePlatformDoctorCheck: (env: NodeJS.ProcessEnv, options?: AcceptanceDeployOptions) => DoctorCheck;
  buildInstanceAuthConfigCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => DoctorCheck;
  buildInstanceHostnameMappingCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildKeycloakClientSecretCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildLocalInstanceIdentityDoctorCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => DoctorCheck;
  buildLocalProvisioningWorkerCheck: (runtimeProfile: RuntimeProfile, workerState: unknown) => DoctorCheck;
  buildMigrationStatusCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => DoctorCheck;
  buildObservabilityDoctorCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildSchemaGuardCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => DoctorCheck;
  buildSchemaSnapshotCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => DoctorCheck;
  buildStudioImageVerifyEvidenceCheck: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv, options?: AcceptanceDeployOptions) => DoctorCheck;
  buildTenantAdminClientContractCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => DoctorCheck;
  buildTenantAdminSecretContractCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildTenantAuthProofCheck: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  buildTenantAuthSecretContractCheck: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Promise<DoctorCheck>;
  checkHttpHealth: (url: string) => Promise<HttpHealthResult>;
  finalizeDoctorReport: (runtimeProfile: RuntimeProfile, checks: readonly DoctorCheck[]) => DoctorReport;
  getRuntimeContractSummary: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => Readonly<Record<string, unknown>>;
  getRuntimeProfileDefinition: (runtimeProfile: RuntimeProfile) => { isLocal: boolean };
  getRuntimeProfileDerivedEnvKeys: (runtimeProfile: RuntimeProfile) => readonly string[];
  getRuntimeProfileRequiredEnvKeys: (runtimeProfile: RuntimeProfile) => readonly string[];
  isMainserverCheckRequired: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => boolean;
  isRemoteRuntimeProfile: (runtimeProfile: RuntimeProfile) => runtimeProfile is RemoteRuntimeProfile;
  localWorkerStateFile: string;
  readLocalWorkerState: (path: string) => unknown;
  toDoctorCheck: (name: string, status: DoctorCheck['status'], code: string, message: string, details?: Readonly<Record<string, unknown>>) => DoctorCheck;
  validateRuntimeProfileEnv: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => RuntimeProfileValidation;
};
