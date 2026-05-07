import type { InstanceRegistryServiceDeps } from './service-types.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { buildProvisioningInput } from './service-keycloak-execution-payload.js';

const buildAuthClientSecretAad = (instanceId: string): string => `iam.instances.auth_client_secret:${instanceId}`;
const buildTenantAdminClientSecretAad = (instanceId: string): string =>
  `iam.instances.tenant_admin_client_secret:${instanceId}`;

const protectSecret = (deps: InstanceRegistryServiceDeps, value: string, aad: string): string | undefined => {
  if (!deps.protectSecret) {
    throw new Error('dependency_missing_protectSecret');
  }
  return deps.protectSecret(value, aad) ?? undefined;
};

const encryptAuthClientSecret = (
  deps: InstanceRegistryServiceDeps,
  instanceId: string,
  secret: string | undefined
): string | undefined => {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return undefined;
  }
  return protectSecret(deps, normalizedSecret, buildAuthClientSecretAad(instanceId));
};

const encryptTenantAdminClientSecret = (
  deps: InstanceRegistryServiceDeps,
  instanceId: string,
  secret: string | undefined
): string | undefined => {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return undefined;
  }
  return protectSecret(deps, normalizedSecret, buildTenantAdminClientSecretAad(instanceId));
};

export const syncRotatedClientSecretToRegistry = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>;
    requestId?: string;
    actorId?: string;
  }
) => {
  if (!deps.readKeycloakStateViaProvisioner) {
    throw new Error('dependency_missing_readKeycloakStateViaProvisioner');
  }
  const state = await deps.readKeycloakStateViaProvisioner(buildProvisioningInput(input.loaded));
  const rotatedSecret = state.keycloakClientSecret;
  if (!rotatedSecret) {
    throw new Error('tenant_auth_client_secret_missing_after_rotation');
  }

  await deps.repository.updateInstance({
    instanceId: input.loaded.instance.instanceId,
    displayName: input.loaded.instance.displayName,
    parentDomain: input.loaded.instance.parentDomain,
    primaryHostname: input.loaded.instance.primaryHostname,
    realmMode: input.loaded.instance.realmMode,
    authRealm: input.loaded.instance.authRealm,
    authClientId: input.loaded.instance.authClientId,
    authIssuerUrl: input.loaded.instance.authIssuerUrl,
    authClientSecretCiphertext: encryptAuthClientSecret(deps, input.loaded.instance.instanceId, rotatedSecret),
    keepExistingAuthClientSecret: false,
    tenantAdminClient: input.loaded.instance.tenantAdminClient
      ? {
          clientId: input.loaded.instance.tenantAdminClient.clientId,
          secretCiphertext: encryptTenantAdminClientSecret(
            deps,
            input.loaded.instance.instanceId,
            state.tenantAdminClientSecret ?? input.loaded.tenantAdminClientSecret
          ),
        }
      : undefined,
    keepExistingTenantAdminClientSecret: !state.tenantAdminClientSecret && !input.loaded.tenantAdminClientSecret,
    tenantAdminBootstrap: input.loaded.instance.tenantAdminBootstrap,
    actorId: input.actorId,
    requestId: input.requestId,
    themeKey: input.loaded.instance.themeKey,
    featureFlags: input.loaded.instance.featureFlags,
    mainserverConfigRef: input.loaded.instance.mainserverConfigRef,
  });

  input.loaded.authClientSecret = rotatedSecret;
  input.loaded.tenantAdminClientSecret = state.tenantAdminClientSecret ?? input.loaded.tenantAdminClientSecret;
};

export const syncProvisionedClientSecretToRegistry = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>;
    requestId?: string;
    actorId?: string;
  }
) => {
  if (!deps.readKeycloakStateViaProvisioner) {
    throw new Error('dependency_missing_readKeycloakStateViaProvisioner');
  }
  const state = await deps.readKeycloakStateViaProvisioner(buildProvisioningInput(input.loaded));
  const provisionedSecret = state.keycloakClientSecret;
  const provisionedTenantAdminSecret = state.tenantAdminClientSecret;
  const authSecretDrift = Boolean(provisionedSecret) && provisionedSecret !== input.loaded.authClientSecret;
  const tenantAdminSecretDrift = Boolean(provisionedTenantAdminSecret)
    && provisionedTenantAdminSecret !== input.loaded.tenantAdminClientSecret;
  if (!authSecretDrift && !tenantAdminSecretDrift) {
    return;
  }

  await deps.repository.updateInstance({
    instanceId: input.loaded.instance.instanceId,
    displayName: input.loaded.instance.displayName,
    parentDomain: input.loaded.instance.parentDomain,
    primaryHostname: input.loaded.instance.primaryHostname,
    realmMode: input.loaded.instance.realmMode,
    authRealm: input.loaded.instance.authRealm,
    authClientId: input.loaded.instance.authClientId,
    authIssuerUrl: input.loaded.instance.authIssuerUrl,
    authClientSecretCiphertext: encryptAuthClientSecret(
      deps,
      input.loaded.instance.instanceId,
      authSecretDrift ? provisionedSecret ?? undefined : input.loaded.authClientSecret
    ),
    keepExistingAuthClientSecret: false,
    tenantAdminClient: input.loaded.instance.tenantAdminClient
      ? {
          clientId: input.loaded.instance.tenantAdminClient.clientId,
          secretCiphertext: encryptTenantAdminClientSecret(
            deps,
            input.loaded.instance.instanceId,
            tenantAdminSecretDrift ? provisionedTenantAdminSecret ?? undefined : input.loaded.tenantAdminClientSecret
          ),
        }
      : undefined,
    keepExistingTenantAdminClientSecret: !(tenantAdminSecretDrift || input.loaded.tenantAdminClientSecret),
    tenantAdminBootstrap: input.loaded.instance.tenantAdminBootstrap,
    actorId: input.actorId,
    requestId: input.requestId,
    themeKey: input.loaded.instance.themeKey,
    featureFlags: input.loaded.instance.featureFlags,
    mainserverConfigRef: input.loaded.instance.mainserverConfigRef,
  });

  input.loaded.authClientSecret = authSecretDrift ? provisionedSecret ?? undefined : input.loaded.authClientSecret;
  input.loaded.tenantAdminClientSecret = tenantAdminSecretDrift
    ? provisionedTenantAdminSecret ?? undefined
    : input.loaded.tenantAdminClientSecret;
};
