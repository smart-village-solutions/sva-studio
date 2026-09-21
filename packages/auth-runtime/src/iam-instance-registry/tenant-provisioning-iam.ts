import {
  isKeycloakIdentityProvider,
  resolveIdentityProviderForInstance,
} from '../iam-account-management/shared-runtime.js';
import { resolveAuthConfigForInstance } from '../config.js';
import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';
import { isUuid } from '../shared/input-readers.js';

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
  const authClientId =
    input.authClientId ?? (await resolveAuthConfigForInstance(input.instanceId)).clientId;
  const targetClient = await input.identityProvider.provider.getOidcClientByClientId(authClientId);
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

export const probeTenantIamAccess = async (input: {
  instanceId: string;
  authClientId?: string;
  requestId?: string;
}) => {
  const identityProvider = await resolveIdentityProviderForInstance(input.instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!identityProvider) {
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
    const [rolesResult, usersResult, capabilityResult] = await Promise.allSettled([
      identityProvider.provider.listRoles(),
      identityProvider.provider.listUsers({ max: 1 }),
      probePasswordSetupEmailCapability({
        instanceId: input.instanceId,
        authClientId: input.authClientId,
        identityProvider,
      }),
    ]);
    const firstAccessFailure =
      rolesResult.status === 'rejected'
        ? rolesResult.reason
        : usersResult.status === 'rejected'
          ? usersResult.reason
          : null;
    if (firstAccessFailure) throw firstAccessFailure;
    if (capabilityResult.status === 'rejected') throw capabilityResult.reason;
    const passwordSetupEmailCapability = capabilityResult.value;
    if (!passwordSetupEmailCapability.ok) {
      const failure = classifyPasswordSetupCapabilityFailure(passwordSetupEmailCapability);
      return {
        ...failure,
        source: 'access_probe',
        serviceIdentity: 'sva-studio-tenant-iam',
        checkedAt: new Date().toISOString(),
        requestId: input.requestId,
      } as const;
    }
    return {
      status: 'ready',
      summary: passwordSetupEmailCapability.loginClientId
        ? `Tenant-Admin-Client kann Nutzer lesen und Passwort-Setup-Mails über den Login-Client ${passwordSetupEmailCapability.loginClientId} anstoßen.`
        : 'Tenant-Admin-Client kann Nutzer lesen und Passwort-Setup-Mails anstoßen.',
      source: 'access_probe',
      serviceIdentity: 'sva-studio-tenant-iam',
      classification: 'ready',
      checkedAt: new Date().toISOString(),
      requestId: input.requestId,
    } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorCode =
      (error instanceof KeycloakAdminRequestError && error.statusCode === 403) ||
      message.includes('403') ||
      message.toLowerCase().includes('forbidden')
        ? 'IDP_FORBIDDEN'
        : 'IDP_UNAVAILABLE';
    return {
      status: errorCode === 'IDP_FORBIDDEN' ? 'blocked' : 'degraded',
      summary:
        errorCode === 'IDP_FORBIDDEN'
          ? 'Tenant-Admin-Client darf die erforderlichen IAM-Ressourcen nicht lesen.'
          : 'Tenant-Admin-Rechteprobe konnte nicht abgeschlossen werden.',
      source: 'access_probe',
      serviceIdentity: 'sva-studio-tenant-iam',
      classification: errorCode === 'IDP_FORBIDDEN' ? 'forbidden' : 'unavailable',
      checkedAt: new Date().toISOString(),
      errorCode,
      requestId: input.requestId,
    } as const;
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
