import type { DoctorCheck } from '../runtime-env.shared.ts';
import type { AcceptanceRuntimeCheckDeps } from './acceptance-runtime-checks.types.ts';

export const buildAcceptanceServiceCheck = async (
  deps: AcceptanceRuntimeCheckDeps,
  env: NodeJS.ProcessEnv,
): Promise<DoctorCheck> => {
  try {
    const output = await deps.readRemoteStackEvidence(env);
    return deps.toDoctorCheck('acceptance-services', 'ok', 'remote_services_visible', 'Remote-Service-Status konnte abgefragt werden.', {
      channel: output.channel,
      summary: output.summary,
    });
  } catch (error) {
    return deps.toDoctorCheck(
      'acceptance-services',
      'warn',
      'remote_service_status_failed',
      error instanceof Error ? error.message : String(error),
    );
  }
};

export const buildAcceptanceIngressConsistencyCheck = async (
  deps: AcceptanceRuntimeCheckDeps,
  env: NodeJS.ProcessEnv,
): Promise<DoctorCheck> => {
  try {
    const evidence = await deps.readRemoteStackEvidence(env);
    const stackName = deps.getConfiguredStackName(env);
    const baseUrl = env.SVA_PUBLIC_BASE_URL ?? 'https://studio.smart-village.app';
    const hasRunningAppTask = evidence.hasRunningService(deps.getRemoteAppServiceName(env));
    const live = await deps.checkHttpHealth(new URL('/health/live', baseUrl).toString());

    return hasRunningAppTask && !live.response.ok
      ? deps.toDoctorCheck(
          'acceptance-ingress-consistency',
          'error',
          'remote_app_ingress_inconsistent',
          'Swarm meldet einen laufenden App-Task, aber der externe Live-Endpoint ist nicht gesund.',
          { baseUrl, channel: evidence.channel, liveStatus: live.response.status, stackName },
        )
      : deps.toDoctorCheck(
          'acceptance-ingress-consistency',
          'ok',
          'remote_app_ingress_consistent',
          'Swarm-Task-Status und externer Live-Endpoint sind konsistent.',
          { baseUrl, channel: evidence.channel, liveStatus: live.response.status, stackName },
        );
  } catch (error) {
    return deps.toDoctorCheck(
      'acceptance-ingress-consistency',
      'warn',
      'remote_app_ingress_probe_failed',
      error instanceof Error ? error.message : String(error),
    );
  }
};

export const isExpectedOidcRedirect = (location: string, env: NodeJS.ProcessEnv) => {
  if (location.length === 0) {
    return false;
  }

  const authIssuer = env.SVA_AUTH_ISSUER?.trim();
  if (authIssuer && location.startsWith(authIssuer)) {
    return true;
  }

  const keycloakAdminBaseUrl = env.KEYCLOAK_ADMIN_BASE_URL?.trim();
  if (keycloakAdminBaseUrl && location.startsWith(`${keycloakAdminBaseUrl.replace(/\/+$/u, '')}/realms/`)) {
    return true;
  }

  return location.includes('/realms/') && location.includes('/protocol/openid-connect/auth');
};

export const buildAppPrincipalReadinessCheck = async (
  deps: AcceptanceRuntimeCheckDeps,
  env: NodeJS.ProcessEnv,
): Promise<DoctorCheck> => {
  const baseUrl = env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const appDbUser = env.APP_DB_USER?.trim() || 'sva_app';

  try {
    const ready = await deps.checkHttpHealth(new URL('/health/ready', baseUrl).toString());
    const payload = (ready.payload ?? {}) as {
      checks?: {
        auth?: { realm?: string };
        db?: boolean;
        errors?: Record<string, unknown>;
        keycloak?: boolean;
        redis?: boolean;
      };
    };
    const checks = payload.checks ?? {};

    return ready.response.ok && checks.db === true && checks.redis === true && checks.keycloak === true
      ? deps.toDoctorCheck(
          'app-db-principal',
          'ok',
          'app_db_principal_ready',
          'Die laufende App bestaetigt Registry-/Auth-Readiness aus Sicht des Runtime-DB-Users.',
          { appDbUser, authRealm: checks.auth?.realm, status: ready.response.status },
        )
      : deps.toDoctorCheck(
          'app-db-principal',
          'error',
          'app_db_principal_not_ready',
          'Die laufende App meldet Registry-/Auth- oder Datenbank-Readiness nicht stabil.',
          { appDbUser, payload, status: ready.response.status },
        );
  } catch (error) {
    return deps.toDoctorCheck(
      'app-db-principal',
      'error',
      'app_db_principal_check_failed',
      error instanceof Error ? error.message : String(error),
      { appDbUser },
    );
  }
};
