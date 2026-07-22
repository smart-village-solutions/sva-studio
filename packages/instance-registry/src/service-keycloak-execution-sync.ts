import type { InstanceRegistryServiceDeps } from './service-types.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { buildProvisioningInput } from './service-keycloak-execution-payload.js';

const provisionedSecretReadDelaysMs = [100, 250] as const;

const waitForProvisionedSecretRead = async (deps: InstanceRegistryServiceDeps, delayMs: number): Promise<void> => {
  if (deps.waitForProvisionedSecretRead) {
    await deps.waitForProvisionedSecretRead(delayMs);
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
};

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

const hasRequiredProvisionedSecrets = (
  state: Awaited<ReturnType<NonNullable<InstanceRegistryServiceDeps['readKeycloakStateViaProvisioner']>>>,
  tenantAdminClientConfigured: boolean
): boolean => Boolean(state.keycloakClientSecret) && (!tenantAdminClientConfigured || Boolean(state.tenantAdminClientSecret));

const readProvisionedSecrets = async (
  deps: InstanceRegistryServiceDeps,
  input: Parameters<typeof buildProvisioningInput>[0],
  tenantAdminClientConfigured: boolean
) => {
  if (!deps.readKeycloakStateViaProvisioner) {
    throw new Error('dependency_missing_readKeycloakStateViaProvisioner');
  }

  let state = await deps.readKeycloakStateViaProvisioner(buildProvisioningInput(input));
  for (const delayMs of provisionedSecretReadDelaysMs) {
    if (hasRequiredProvisionedSecrets(state, tenantAdminClientConfigured)) {
      return state;
    }
    await waitForProvisionedSecretRead(deps, delayMs);
    state = await deps.readKeycloakStateViaProvisioner(buildProvisioningInput(input));
  }
  return state;
};

const readStateForRegistrySync = async (
  deps: InstanceRegistryServiceDeps,
  input: Parameters<typeof buildProvisioningInput>[0],
  realmMode: Parameters<typeof buildProvisioningInput>[0]['instance']['realmMode'],
  tenantAdminClientConfigured: boolean
) => {
  if (realmMode === 'new') {
    return readProvisionedSecrets(deps, input, tenantAdminClientConfigured);
  }
  if (!deps.readKeycloakStateViaProvisioner) {
    throw new Error('dependency_missing_readKeycloakStateViaProvisioner');
  }
  return deps.readKeycloakStateViaProvisioner(buildProvisioningInput(input));
};

const assertProvisionedSecretsAvailable = (
  realmMode: Parameters<typeof buildProvisioningInput>[0]['instance']['realmMode'],
  provisionedSecret: string | null | undefined,
  provisionedTenantAdminSecret: string | null | undefined,
  tenantAdminClientConfigured: boolean
): void => {
  if (realmMode !== 'new') {
    return;
  }
  if (provisionedSecret && (!tenantAdminClientConfigured || provisionedTenantAdminSecret)) {
    return;
  }
  throw new Error('tenant_client_secrets_missing_after_provisioning');
};

const updateLoadedSecrets = (
  loaded: {
    authClientSecret?: string;
    tenantAdminClientSecret?: string;
  },
  authSecretDrift: boolean,
  provisionedSecret: string | null | undefined,
  tenantAdminSecretDrift: boolean,
  provisionedTenantAdminSecret: string | null | undefined
): void => {
  loaded.authClientSecret = authSecretDrift ? provisionedSecret ?? undefined : loaded.authClientSecret;
  loaded.tenantAdminClientSecret = tenantAdminSecretDrift
    ? provisionedTenantAdminSecret ?? undefined
    : loaded.tenantAdminClientSecret;
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
  const { loaded } = input;
  const tenantAdminClientConfigured = Boolean(loaded.instance.tenantAdminClient?.clientId);
  const state = await readStateForRegistrySync(
    deps,
    loaded,
    loaded.instance.realmMode,
    tenantAdminClientConfigured
  );
  const provisionedSecret = state.keycloakClientSecret;
  const provisionedTenantAdminSecret = state.tenantAdminClientSecret;
  assertProvisionedSecretsAvailable(
    loaded.instance.realmMode,
    provisionedSecret,
    provisionedTenantAdminSecret,
    tenantAdminClientConfigured
  );
  const authSecretDrift = Boolean(provisionedSecret) && provisionedSecret !== loaded.authClientSecret;
  const tenantAdminSecretDrift = Boolean(provisionedTenantAdminSecret)
    && provisionedTenantAdminSecret !== loaded.tenantAdminClientSecret;
  if (!authSecretDrift && !tenantAdminSecretDrift) {
    return;
  }

  await deps.repository.updateInstance({
    instanceId: loaded.instance.instanceId,
    displayName: loaded.instance.displayName,
    parentDomain: loaded.instance.parentDomain,
    primaryHostname: loaded.instance.primaryHostname,
    realmMode: loaded.instance.realmMode,
    authRealm: loaded.instance.authRealm,
    authClientId: loaded.instance.authClientId,
    authIssuerUrl: loaded.instance.authIssuerUrl,
    authClientSecretCiphertext: encryptAuthClientSecret(
      deps,
      loaded.instance.instanceId,
      authSecretDrift ? provisionedSecret ?? undefined : loaded.authClientSecret
    ),
    keepExistingAuthClientSecret: false,
    tenantAdminClient: loaded.instance.tenantAdminClient
      ? {
          clientId: loaded.instance.tenantAdminClient.clientId,
          secretCiphertext: encryptTenantAdminClientSecret(
            deps,
            loaded.instance.instanceId,
            tenantAdminSecretDrift ? provisionedTenantAdminSecret ?? undefined : loaded.tenantAdminClientSecret
          ),
        }
      : undefined,
    keepExistingTenantAdminClientSecret: !(tenantAdminSecretDrift || loaded.tenantAdminClientSecret),
    tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
    actorId: input.actorId,
    requestId: input.requestId,
    themeKey: loaded.instance.themeKey,
    featureFlags: loaded.instance.featureFlags,
    mainserverConfigRef: loaded.instance.mainserverConfigRef,
  });

  updateLoadedSecrets(
    loaded,
    authSecretDrift,
    provisionedSecret,
    tenantAdminSecretDrift,
    provisionedTenantAdminSecret
  );
};
