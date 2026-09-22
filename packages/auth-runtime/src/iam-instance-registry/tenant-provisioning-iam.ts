import {
  isKeycloakIdentityProvider,
  resolveIdentityProviderForInstance,
} from '../iam-account-management/shared-runtime.js';
import { createSdkLogger } from '@sva/server-runtime';
import { resolveAuthConfigForInstance } from '../config.js';
import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';
import { isUuid } from '../shared/input-readers.js';

const logger = createSdkLogger({ component: 'iam-tenant-provisioning', level: 'info' });

type TenantIamProbeFailureStage =
  | 'auth_config_resolution'
  | 'identity_provider_resolution'
  | 'login_client_visibility'
  | 'password_setup_capability'
  | 'roles_read'
  | 'users_read';

type TenantIamProbeInput = {
  readonly instanceId: string;
  readonly authClientId?: string;
  readonly requestId?: string;
};

type TenantIamAuthClientSource = 'active_runtime_fallback' | 'instance';

const probeFailureStage = Symbol('tenantIamProbeFailureStage');

const annotateProbeFailure = (error: unknown, stage: TenantIamProbeFailureStage): unknown => {
  if (error !== null && typeof error === 'object') {
    try {
      Object.defineProperty(error, probeFailureStage, {
        configurable: true,
        enumerable: false,
        value: stage,
      });
    } catch {
      // Keep the original upstream error when it cannot be annotated.
    }
  }
  return error;
};

const readProbeFailureStage = (error: unknown): TenantIamProbeFailureStage | undefined => {
  if (error === null || typeof error !== 'object') return undefined;
  try {
    return Reflect.get(error, probeFailureStage) as TenantIamProbeFailureStage | undefined;
  } catch {
    return undefined;
  }
};

const logTenantIamProbeCompleted = (input: {
  readonly instanceId: string;
  readonly requestId?: string;
  readonly result: 'blocked' | 'degraded' | 'ready' | 'unknown';
  readonly classification: 'forbidden' | 'misconfigured' | 'ready' | 'unavailable' | 'unknown';
  readonly authClientSource: TenantIamAuthClientSource;
  readonly errorCode?: string;
  readonly failureStage?: TenantIamProbeFailureStage;
  readonly error?: unknown;
}): void => {
  const context = {
    operation: 'probe_tenant_iam_access',
    result: input.result,
    instance_id: input.instanceId,
    request_id: input.requestId,
    classification: input.classification,
    auth_client_source: input.authClientSource,
    ...(input.errorCode ? { error_code: input.errorCode, reason_code: input.errorCode } : {}),
    ...(input.failureStage ? { failure_stage: input.failureStage } : {}),
    ...(input.error
      ? {
          error: input.errorCode ?? 'tenant_iam_access_probe_failed',
          error_type: input.error instanceof Error ? input.error.name : typeof input.error,
        }
      : {}),
  };
  if (input.result === 'ready') {
    logger.info('tenant_iam_access_probe_completed', context);
  } else {
    logger.warn('tenant_iam_access_probe_completed', context);
  }
};

const probePasswordSetupEmailCapability = async (input: {
  instanceId: string;
  authClientId?: string;
  identityProvider: NonNullable<Awaited<ReturnType<typeof resolveIdentityProviderForInstance>>>;
}) => {
  if (!input.identityProvider.provider.executeActionsEmail) {
    return {
      ok: false as const,
      errorCode: 'IDP_UNSUPPORTED_PASSWORD_SETUP_EMAIL',
      summary: 'Tenant-Admin-Client unterstützt den Passwort-Setup-Mailversand nicht.',
    };
  }
  if (!isKeycloakIdentityProvider(input.identityProvider.provider)) {
    return { ok: true as const, loginClientId: undefined };
  }
  let authClientId = input.authClientId;
  if (!authClientId) {
    try {
      authClientId = (await resolveAuthConfigForInstance(input.instanceId)).clientId;
    } catch (error) {
      throw annotateProbeFailure(error, 'auth_config_resolution');
    }
  }
  let targetClient: unknown;
  try {
    targetClient = await input.identityProvider.provider.getOidcClientByClientId(authClientId);
  } catch (error) {
    throw annotateProbeFailure(error, 'login_client_visibility');
  }
  if (!targetClient) {
    return {
      ok: false as const,
      errorCode: 'AUTH_CLIENT_VISIBILITY_UNCONFIRMED',
      summary: `Tenant-Admin-Client konnte die Sichtbarkeit des Login-Clients ${authClientId} nicht bestätigen.`,
    };
  }
  return { ok: true as const, loginClientId: authClientId };
};

const classifyPasswordSetupCapabilityFailure = (input: {
  readonly errorCode: string;
  readonly summary: string;
}) => {
  if (input.errorCode === 'AUTH_CLIENT_VISIBILITY_UNCONFIRMED') {
    return { ...input, status: 'unknown', classification: 'unknown' } as const;
  }
  return { ...input, status: 'blocked', classification: 'misconfigured' } as const;
};

const readSettledProbeValue = <T>(
  result: PromiseSettledResult<T>,
  failureStage: TenantIamProbeFailureStage
): T => {
  if (result.status === 'rejected') {
    throw annotateProbeFailure(result.reason, readProbeFailureStage(result.reason) ?? failureStage);
  }
  return result.value;
};

const runTenantIamProbeChecks = async (
  input: TenantIamProbeInput,
  identityProvider: NonNullable<Awaited<ReturnType<typeof resolveIdentityProviderForInstance>>>
) => {
  const [rolesResult, usersResult, capabilityResult] = await Promise.allSettled([
    identityProvider.provider.listRoles(),
    identityProvider.provider.listUsers({ max: 1 }),
    probePasswordSetupEmailCapability({
      instanceId: input.instanceId,
      authClientId: input.authClientId,
      identityProvider,
    }),
  ]);
  readSettledProbeValue(rolesResult, 'roles_read');
  readSettledProbeValue(usersResult, 'users_read');
  return readSettledProbeValue(capabilityResult, 'password_setup_capability');
};

const buildTenantIamCapabilityResult = (
  input: TenantIamProbeInput,
  authClientSource: TenantIamAuthClientSource,
  capability: Awaited<ReturnType<typeof probePasswordSetupEmailCapability>>
) => {
  if (!capability.ok) {
    const failure = classifyPasswordSetupCapabilityFailure(capability);
    logTenantIamProbeCompleted({
      instanceId: input.instanceId,
      requestId: input.requestId,
      result: failure.status,
      classification: failure.classification,
      authClientSource,
      errorCode: failure.errorCode,
      failureStage:
        failure.errorCode === 'AUTH_CLIENT_VISIBILITY_UNCONFIRMED'
          ? 'login_client_visibility'
          : 'password_setup_capability',
    });
    return {
      ...failure,
      source: 'access_probe',
      serviceIdentity: 'sva-studio-tenant-iam',
      checkedAt: new Date().toISOString(),
      requestId: input.requestId,
    } as const;
  }
  logTenantIamProbeCompleted({
    instanceId: input.instanceId,
    requestId: input.requestId,
    result: 'ready',
    classification: 'ready',
    authClientSource,
  });
  return {
    status: 'ready',
    summary: capability.loginClientId
      ? `Tenant-Admin-Client kann Nutzer lesen und Passwort-Setup-Mails über den Login-Client ${capability.loginClientId} anstoßen.`
      : 'Tenant-Admin-Client kann Nutzer lesen und Passwort-Setup-Mails anstoßen.',
    source: 'access_probe',
    serviceIdentity: 'sva-studio-tenant-iam',
    classification: 'ready',
    checkedAt: new Date().toISOString(),
    requestId: input.requestId,
  } as const;
};

const buildTenantIamProbeErrorResult = (
  input: TenantIamProbeInput,
  authClientSource: TenantIamAuthClientSource,
  error: unknown
) => {
  const message = error instanceof Error ? error.message : String(error);
  const forbidden =
    (error instanceof KeycloakAdminRequestError && error.statusCode === 403) ||
    message.includes('403') ||
    message.toLowerCase().includes('forbidden');
  const errorCode = forbidden ? 'IDP_FORBIDDEN' : 'IDP_UNAVAILABLE';
  logTenantIamProbeCompleted({
    instanceId: input.instanceId,
    requestId: input.requestId,
    result: forbidden ? 'blocked' : 'degraded',
    classification: forbidden ? 'forbidden' : 'unavailable',
    authClientSource,
    errorCode,
    failureStage: readProbeFailureStage(error) ?? 'password_setup_capability',
    error,
  });
  return {
    status: forbidden ? 'blocked' : 'degraded',
    summary: forbidden
      ? 'Tenant-Admin-Client darf die erforderlichen IAM-Ressourcen nicht lesen.'
      : 'Tenant-Admin-Rechteprobe konnte nicht abgeschlossen werden.',
    source: 'access_probe',
    serviceIdentity: 'sva-studio-tenant-iam',
    classification: forbidden ? 'forbidden' : 'unavailable',
    checkedAt: new Date().toISOString(),
    errorCode,
    requestId: input.requestId,
  } as const;
};

export const probeTenantIamAccess = async (input: TenantIamProbeInput) => {
  const authClientSource = input.authClientId ? 'instance' : 'active_runtime_fallback';
  let identityProvider: Awaited<ReturnType<typeof resolveIdentityProviderForInstance>>;
  try {
    identityProvider = await resolveIdentityProviderForInstance(input.instanceId, {
      executionMode: 'tenant_admin',
    });
  } catch (error) {
    logTenantIamProbeCompleted({
      instanceId: input.instanceId,
      requestId: input.requestId,
      result: 'degraded',
      classification: 'unavailable',
      authClientSource,
      errorCode: 'IDP_UNAVAILABLE',
      failureStage: 'identity_provider_resolution',
      error,
    });
    throw error;
  }
  if (!identityProvider) {
    logTenantIamProbeCompleted({
      instanceId: input.instanceId,
      requestId: input.requestId,
      result: 'blocked',
      classification: 'misconfigured',
      authClientSource,
      errorCode: 'tenant_admin_client_not_configured',
      failureStage: 'identity_provider_resolution',
    });
    return {
      status: 'blocked',
      summary: 'Tenant-Admin-Client ist für diese Instanz noch nicht konfiguriert.',
      source: 'access_probe',
      serviceIdentity: 'sva-studio-tenant-iam',
      classification: 'misconfigured',
      checkedAt: new Date().toISOString(),
      errorCode: 'tenant_admin_client_not_configured',
      requestId: input.requestId,
    } as const;
  }
  try {
    const capability = await runTenantIamProbeChecks(input, identityProvider);
    return buildTenantIamCapabilityResult(input, authClientSource, capability);
  } catch (error) {
    return buildTenantIamProbeErrorResult(input, authClientSource, error);
  }
};

export const reconcileTenantIamRoles = async (input: {
  instanceId: string;
  actorId?: string;
  requestId?: string;
  expectedRoleCatalogFingerprint?: string;
}) => {
  const { runRoleCatalogReconciliation } =
    await import('../iam-account-management/reconcile-core.js');
  return runRoleCatalogReconciliation({
    instanceId: input.instanceId,
    actorAccountId: input.actorId && isUuid(input.actorId) ? input.actorId : undefined,
    requestId: input.requestId,
    ...(input.expectedRoleCatalogFingerprint
      ? { expectedRoleCatalogFingerprint: input.expectedRoleCatalogFingerprint }
      : {}),
  });
};
