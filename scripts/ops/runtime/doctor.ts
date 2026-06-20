import type {
  AcceptanceDeployOptions,
  DoctorCheck,
  DoctorReport,
  RemoteRuntimeProfile,
  RuntimeProfile,
} from '../runtime-env.shared.ts';
import { createAssertionCheck, createEndpointHealthCheck, createRuntimeEnvCheck } from './doctor-check-builders.ts';
import type { RuntimeDoctorDeps } from './doctor.types.ts';

export const createRuntimeDoctorOps = (deps: RuntimeDoctorDeps) => {
  const precheckAcceptance = async (
    runtimeProfile: RemoteRuntimeProfile,
    env: NodeJS.ProcessEnv,
    options?: AcceptanceDeployOptions,
  ): Promise<DoctorReport> => {
    const checks: DoctorCheck[] = [];
    const validation = deps.validateRuntimeProfileEnv(runtimeProfile, env);
    const runtimeContract = deps.getRuntimeContractSummary(runtimeProfile, env);

    checks.push(
      createRuntimeEnvCheck(
        deps,
        runtimeProfile,
        validation,
        runtimeContract,
        'Remote-Profil ist nicht vollstaendig konfiguriert.',
      ),
    );
    checks.push(deps.buildImagePlatformDoctorCheck(env, options));
    checks.push(deps.buildStudioImageVerifyEvidenceCheck(runtimeProfile, env, options));
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
    if (options) {
      checks.push(await deps.buildAcceptanceLiveSpecCheck(runtimeProfile, env, options));
    }

    return deps.finalizeDoctorReport(runtimeProfile, checks);
  };

  const doctorRuntime = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): Promise<DoctorReport> => {
    const checks: DoctorCheck[] = [];
    const validation = deps.validateRuntimeProfileEnv(runtimeProfile, env);
    const runtimeContract = deps.getRuntimeContractSummary(runtimeProfile, env);

    checks.push(
      createRuntimeEnvCheck(deps, runtimeProfile, validation, runtimeContract, 'Runtime-Profil ist nicht vollstaendig konfiguriert.'),
    );

    checks.push(deps.buildLocalProvisioningWorkerCheck(runtimeProfile, deps.readLocalWorkerState(deps.localWorkerStateFile)));

    const baseUrl = env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    checks.push(
      await createEndpointHealthCheck(deps, {
        baseUrl,
        errorCode: 'live_failed',
        name: 'health-live',
        okCode: 'live_ok',
        okMessage: 'Live-Endpoint antwortet erfolgreich.',
        path: '/health/live',
        unreachableCode: 'live_unreachable',
      }),
    );
    checks.push(
      await createEndpointHealthCheck(deps, {
        baseUrl,
        errorCode: 'ready_failed',
        name: 'health-ready',
        okCode: 'ready_ok',
        okMessage: 'Readiness ist erfolgreich.',
        path: '/health/ready',
        unreachableCode: 'ready_unreachable',
      }),
    );

    checks.push(await deps.buildKeycloakClientSecretCheck(runtimeProfile, env));
    checks.push(
      await createAssertionCheck(deps, {
        code: 'auth_login_ok',
        errorCode: 'auth_login_failed',
        name: 'auth-login',
        okMessage: 'Login-Verhalten entspricht dem Profil.',
        run: () => deps.assertLoginFlow(runtimeProfile, env),
      }),
    );
    checks.push(
      await createAssertionCheck(deps, {
        code: 'auth_me_ok',
        errorCode: 'auth_me_failed',
        name: 'auth-me',
        okMessage: '/auth/me entspricht dem Profil.',
        run: () => deps.assertMeEndpoint(runtimeProfile, env),
      }),
    );

    if (deps.isMainserverCheckRequired(runtimeProfile, env)) {
      checks.push(
        await createAssertionCheck(deps, {
          code: 'mainserver_ok',
          errorCode: 'mainserver_failed',
          name: 'mainserver',
          okMessage: 'Mainserver-OAuth und GraphQL sind erreichbar.',
          run: () => deps.assertMainserverSmoke(env),
        }),
      );
    } else {
      checks.push(
        deps.toDoctorCheck(
          'mainserver',
          'skipped',
          'mainserver_optional',
          'Mainserver-Smoke ist fuer dieses Runtime-Profil optional und blockiert die Studio-Einrichtung nicht.',
        ),
      );
    }

    if (deps.getRuntimeProfileDefinition(runtimeProfile).isLocal) {
      checks.push(
        await createAssertionCheck(deps, {
          code: 'otel_ok',
          errorCode: 'otel_failed',
          name: 'otel',
          okMessage: 'Lokaler OTEL-Collector ist erreichbar.',
          run: () => deps.assertOtelLocal(env),
        }),
      );
    } else {
      checks.push(await deps.buildAcceptanceServiceCheck(env));
    }
    if (deps.isRemoteRuntimeProfile(runtimeProfile)) {
      checks.push(await deps.buildAppPrincipalReadinessCheck(env));
    }
    checks.push(await deps.buildObservabilityDoctorCheck(runtimeProfile, env));
    if (deps.isRemoteRuntimeProfile(runtimeProfile)) {
      checks.push(await deps.buildTenantAuthProofCheck(runtimeProfile, env));
    }

    checks.push(deps.buildFeatureFlagCheck(env));
    checks.push(deps.buildMigrationStatusCheck(runtimeProfile, env));
    checks.push(deps.buildSchemaGuardCheck(runtimeProfile, env));
    checks.push(deps.buildSchemaSnapshotCheck(runtimeProfile, env));
    if (runtimeProfile !== 'local-builder') {
      checks.push(deps.buildInstanceAuthConfigCheck(runtimeProfile, env));
      checks.push(deps.buildTenantAdminClientContractCheck(runtimeProfile, env));
      checks.push(await deps.buildInstanceHostnameMappingCheck(runtimeProfile, env));
      checks.push(deps.buildLocalInstanceIdentityDoctorCheck(runtimeProfile, env));
      checks.push(await deps.buildTenantAuthSecretContractCheck(runtimeProfile, env));
      checks.push(await deps.buildTenantAdminSecretContractCheck(runtimeProfile, env));
    }
    checks.push(...(await deps.buildGuardrailDoctorChecks(runtimeProfile, { env })));

    return deps.finalizeDoctorReport(runtimeProfile, checks);
  };

  return {
    doctorRuntime,
    precheckAcceptance,
  } as const;
};
