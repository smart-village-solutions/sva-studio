import type {
  AcceptanceDeployOptions,
  DoctorCheck,
  DoctorReport,
  RemoteRuntimeProfile,
  RuntimeProfile,
} from '../runtime-env.shared.ts';
import { createAssertionCheck, createEndpointHealthCheck, createRuntimeEnvCheck } from './doctor-check-builders.ts';
import type { RuntimeDoctorDeps } from './doctor.types.ts';

const addRuntimeEnvCheck = (
  deps: RuntimeDoctorDeps,
  checks: DoctorCheck[],
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
  message: string,
) => {
  const validation = deps.validateRuntimeProfileEnv(runtimeProfile, env);
  const runtimeContract = deps.getRuntimeContractSummary(runtimeProfile, env);
  checks.push(createRuntimeEnvCheck(deps, runtimeProfile, validation, runtimeContract, message));
};

const addEndpointChecks = async (deps: RuntimeDoctorDeps, checks: DoctorCheck[], baseUrl: string) => {
  checks.push(await createEndpointHealthCheck(deps, {
    baseUrl,
    errorCode: 'live_failed',
    errorMessage: (status) => `Live-Endpoint antwortet mit ${status}.`,
    name: 'health-live',
    okCode: 'live_ok',
    okMessage: 'Live-Endpoint antwortet erfolgreich.',
    path: '/health/live',
    unreachableCode: 'live_unreachable',
  }));
  checks.push(await createEndpointHealthCheck(deps, {
    baseUrl,
    errorCode: 'ready_failed',
    errorMessage: (status) => `Readiness antwortet mit ${status}.`,
    name: 'health-ready',
    okCode: 'ready_ok',
    okMessage: 'Readiness ist erfolgreich.',
    path: '/health/ready',
    unreachableCode: 'ready_unreachable',
  }));
};

const addAuthChecks = async (
  deps: RuntimeDoctorDeps,
  checks: DoctorCheck[],
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
) => {
  checks.push(await deps.buildKeycloakClientSecretCheck(runtimeProfile, env));
  checks.push(await createAssertionCheck(deps, {
    code: 'auth_login_ok',
    errorCode: 'auth_login_failed',
    name: 'auth-login',
    okMessage: 'Login-Verhalten entspricht dem Profil.',
    run: () => deps.assertLoginFlow(runtimeProfile, env),
  }));
  checks.push(await createAssertionCheck(deps, {
    code: 'auth_me_ok',
    errorCode: 'auth_me_failed',
    name: 'auth-me',
    okMessage: '/auth/me entspricht dem Profil.',
    run: () => deps.assertMeEndpoint(runtimeProfile, env),
  }));
};

const addMainserverCheck = async (
  deps: RuntimeDoctorDeps,
  checks: DoctorCheck[],
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
) => {
  if (!deps.isMainserverCheckRequired(runtimeProfile, env)) {
    checks.push(deps.toDoctorCheck('mainserver', 'skipped', 'mainserver_optional', 'Mainserver-Smoke ist fuer dieses Runtime-Profil optional und blockiert die Studio-Einrichtung nicht.'));
    return;
  }
  checks.push(await createAssertionCheck(deps, {
    code: 'mainserver_ok',
    errorCode: 'mainserver_failed',
    name: 'mainserver',
    okMessage: 'Mainserver-OAuth und GraphQL sind erreichbar.',
    run: () => deps.assertMainserverSmoke(env),
  }));
};

const addLocalOrRemoteSmokeChecks = async (
  deps: RuntimeDoctorDeps,
  checks: DoctorCheck[],
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
) => {
  if (deps.getRuntimeProfileDefinition(runtimeProfile).isLocal) {
    checks.push(await createAssertionCheck(deps, {
      code: 'otel_ok',
      errorCode: 'otel_failed',
      name: 'otel',
      okMessage: 'Lokaler OTEL-Collector ist erreichbar.',
      run: () => deps.assertOtelLocal(env),
    }));
    return;
  }

  checks.push(await deps.buildAcceptanceServiceCheck(env));
};

const addRemoteRuntimeChecks = async (
  deps: RuntimeDoctorDeps,
  checks: DoctorCheck[],
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
) => {
  if (!deps.isRemoteRuntimeProfile(runtimeProfile)) return;
  checks.push(await deps.buildAppPrincipalReadinessCheck(env));
  checks.push(await deps.buildTenantAuthProofCheck(runtimeProfile, env));
};

const addInstanceChecks = async (
  deps: RuntimeDoctorDeps,
  checks: DoctorCheck[],
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
) => {
  if (runtimeProfile === 'local-builder') return;
  if (runtimeProfile === 'local-keycloak') checks.push(deps.buildActorDoctorCheck(runtimeProfile, env));
  checks.push(deps.buildInstanceAuthConfigCheck(runtimeProfile, env));
  checks.push(deps.buildTenantAdminClientContractCheck(runtimeProfile, env));
  checks.push(await deps.buildInstanceHostnameMappingCheck(runtimeProfile, env));
  checks.push(deps.buildLocalInstanceIdentityDoctorCheck(runtimeProfile, env));
  checks.push(await deps.buildTenantAuthSecretContractCheck(runtimeProfile, env));
  checks.push(await deps.buildTenantAdminSecretContractCheck(runtimeProfile, env));
};

const addCommonDoctorChecks = async (
  deps: RuntimeDoctorDeps,
  checks: DoctorCheck[],
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
) => {
  checks.push(await deps.buildObservabilityDoctorCheck(runtimeProfile, env));
  checks.push(deps.buildFeatureFlagCheck(env));
  checks.push(deps.buildMigrationStatusCheck(runtimeProfile, env));
  checks.push(deps.buildSchemaGuardCheck(runtimeProfile, env));
  checks.push(deps.buildSchemaSnapshotCheck(runtimeProfile, env));
  await addInstanceChecks(deps, checks, runtimeProfile, env);
  checks.push(...(await deps.buildGuardrailDoctorChecks(runtimeProfile, { env })));
};

const precheckAcceptance = async (
  deps: RuntimeDoctorDeps,
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
  options?: AcceptanceDeployOptions,
): Promise<DoctorReport> => {
  const checks: DoctorCheck[] = [];
  addRuntimeEnvCheck(deps, checks, runtimeProfile, env, 'Remote-Profil ist nicht vollstaendig konfiguriert.');
  checks.push(deps.buildImagePlatformDoctorCheck(env, options));
  checks.push(deps.buildStudioImageVerifyEvidenceCheck(runtimeProfile, env, options));
  checks.push(await deps.buildLiveRuntimeEnvCheck(runtimeProfile, env));
  checks.push(await deps.buildAcceptanceServiceCheck(env));
  checks.push(await deps.buildAcceptanceIngressConsistencyCheck(env));
  checks.push(await deps.buildAppPrincipalReadinessCheck(env));
  checks.push(await deps.buildKeycloakClientSecretCheck(runtimeProfile, env));
  checks.push(await deps.buildObservabilityDoctorCheck(runtimeProfile, env));
  checks.push(await deps.buildTenantAuthProofCheck(runtimeProfile, env));
  checks.push(deps.buildAcceptancePostgresCheck(env));
  checks.push(deps.buildMigrationStatusCheck(runtimeProfile, env));
  checks.push(deps.buildSchemaGuardCheck(runtimeProfile, env));
  checks.push(deps.buildInstanceAuthConfigCheck(runtimeProfile, env));
  checks.push(deps.buildTenantAdminClientContractCheck(runtimeProfile, env));
  checks.push(await deps.buildInstanceHostnameMappingCheck(runtimeProfile, env));
  checks.push(...(await deps.buildGuardrailDoctorChecks(runtimeProfile, { env })));
  if (options) checks.push(await deps.buildAcceptanceLiveSpecCheck(runtimeProfile, env, options));
  return deps.finalizeDoctorReport(runtimeProfile, checks);
};

const doctorRuntime = async (
  deps: RuntimeDoctorDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
): Promise<DoctorReport> => {
  const checks: DoctorCheck[] = [];
  addRuntimeEnvCheck(deps, checks, runtimeProfile, env, 'Runtime-Profil ist nicht vollstaendig konfiguriert.');
  checks.push(deps.buildLocalProvisioningWorkerCheck(runtimeProfile, deps.readLocalWorkerState(deps.localWorkerStateFile)));
  await addEndpointChecks(deps, checks, env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000');
  await addAuthChecks(deps, checks, runtimeProfile, env);
  await addMainserverCheck(deps, checks, runtimeProfile, env);
  await addLocalOrRemoteSmokeChecks(deps, checks, runtimeProfile, env);
  await addRemoteRuntimeChecks(deps, checks, runtimeProfile, env);
  await addCommonDoctorChecks(deps, checks, runtimeProfile, env);
  return deps.finalizeDoctorReport(runtimeProfile, checks);
};

export const createRuntimeDoctorOps = (deps: RuntimeDoctorDeps) => ({
  doctorRuntime: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => doctorRuntime(deps, runtimeProfile, env),
  precheckAcceptance: (runtimeProfile: RemoteRuntimeProfile, env: NodeJS.ProcessEnv, options?: AcceptanceDeployOptions) =>
    precheckAcceptance(deps, runtimeProfile, env, options),
}) as const;
