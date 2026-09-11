import type { InstanceRegistryServiceDeps } from './service-types.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { buildProvisioningInput } from './service-keycloak-execution-payload.js';

const provisionedSecretReadDelaysMs = [100, 250] as const;

const waitForProvisionedSecretRead = async (
  deps: InstanceRegistryServiceDeps,
  delayMs: number
): Promise<void> => {
  if (deps.waitForProvisionedSecretRead) {
    await deps.waitForProvisionedSecretRead(delayMs);
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
};

const buildAuthClientSecretAad = (instanceId: string): string =>
  `iam.instances.auth_client_secret:${instanceId}`;
const buildTenantAdminClientSecretAad = (instanceId: string): string =>
  `iam.instances.tenant_admin_client_secret:${instanceId}`;

const protectSecret = (
  deps: InstanceRegistryServiceDeps,
  value: string,
  aad: string
): string | undefined => {
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
  state: Awaited<
    ReturnType<NonNullable<InstanceRegistryServiceDeps['readKeycloakClientSecretsViaProvisioner']>>
  >,
  tenantAdminClientConfigured: boolean
): boolean => {
  const authClientSecretPresent = Boolean(state.keycloakClientSecret?.trim());
  const tenantAdminClientSecretPresent = Boolean(state.tenantAdminClientSecret?.trim());
  return (
    authClientSecretPresent && (!tenantAdminClientConfigured || tenantAdminClientSecretPresent)
  );
};

const readProvisionedSecrets = async (
  deps: InstanceRegistryServiceDeps,
  input: Parameters<typeof buildProvisioningInput>[0],
  tenantAdminClientConfigured: boolean
) => {
  if (!deps.readKeycloakClientSecretsViaProvisioner) {
    throw new Error('dependency_missing_readKeycloakClientSecretsViaProvisioner');
  }

  const provisioningInput = buildProvisioningInput(input);
  let state = await deps.readKeycloakClientSecretsViaProvisioner(provisioningInput);
  for (const delayMs of provisionedSecretReadDelaysMs) {
    if (hasRequiredProvisionedSecrets(state, tenantAdminClientConfigured)) {
      return state;
    }
    await waitForProvisionedSecretRead(deps, delayMs);
    state = await deps.readKeycloakClientSecretsViaProvisioner(provisioningInput);
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
  if (!deps.readKeycloakClientSecretsViaProvisioner) {
    throw new Error('dependency_missing_readKeycloakClientSecretsViaProvisioner');
  }
  return deps.readKeycloakClientSecretsViaProvisioner(buildProvisioningInput(input));
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
  if (
    provisionedSecret?.trim() &&
    (!tenantAdminClientConfigured || provisionedTenantAdminSecret?.trim())
  ) {
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
  loaded.authClientSecret = authSecretDrift
    ? (provisionedSecret ?? undefined)
    : loaded.authClientSecret;
  loaded.tenantAdminClientSecret = tenantAdminSecretDrift
    ? (provisionedTenantAdminSecret ?? undefined)
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
  if (!deps.readKeycloakClientSecretsViaProvisioner) {
    throw new Error('dependency_missing_readKeycloakClientSecretsViaProvisioner');
  }
  const state = await deps.readKeycloakClientSecretsViaProvisioner(
    buildProvisioningInput(input.loaded)
  );
  const rotatedSecret = state.keycloakClientSecret;
  if (!rotatedSecret) {
    throw new Error('tenant_auth_client_secret_missing_after_rotation');
  }

  const updatedInstance = await deps.repository.updateInstanceKeycloakSecrets({
    instanceId: input.loaded.instance.instanceId,
    authClientSecretCiphertext: encryptAuthClientSecret(
      deps,
      input.loaded.instance.instanceId,
      rotatedSecret
    ),
    keepExistingAuthClientSecret: false,
    tenantAdminClientSecretCiphertext: encryptTenantAdminClientSecret(
      deps,
      input.loaded.instance.instanceId,
      state.tenantAdminClientSecret ?? input.loaded.tenantAdminClientSecret
    ),
    keepExistingTenantAdminClientSecret:
      !state.tenantAdminClientSecret && !input.loaded.tenantAdminClientSecret,
    actorId: input.actorId,
    requestId: input.requestId,
  });
  if (!updatedInstance) {
    throw new Error('instance_update_failed_after_secret_rotation');
  }

  input.loaded.instance = updatedInstance;
  input.loaded.authClientSecret = rotatedSecret;
  input.loaded.tenantAdminClientSecret =
    state.tenantAdminClientSecret ?? input.loaded.tenantAdminClientSecret;
};

export const syncProvisionedClientSecretToRegistry = async (
  deps: InstanceRegistryServiceDeps,
  input: {
    loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>;
    requestId?: string;
    actorId?: string;
  }
) => {
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
  const authSecretDrift =
    Boolean(provisionedSecret) && provisionedSecret !== loaded.authClientSecret;
  const tenantAdminSecretDrift =
    Boolean(provisionedTenantAdminSecret) &&
    provisionedTenantAdminSecret !== loaded.tenantAdminClientSecret;
  if (!authSecretDrift && !tenantAdminSecretDrift) {
    return;
  }

  const updatedInstance = await deps.repository.updateInstanceKeycloakSecrets({
    instanceId: loaded.instance.instanceId,
    authClientSecretCiphertext: encryptAuthClientSecret(
      deps,
      loaded.instance.instanceId,
      authSecretDrift ? (provisionedSecret ?? undefined) : loaded.authClientSecret
    ),
    keepExistingAuthClientSecret: !authSecretDrift,
    tenantAdminClientSecretCiphertext: encryptTenantAdminClientSecret(
      deps,
      loaded.instance.instanceId,
      provisionedTenantAdminSecret ?? undefined
    ),
    keepExistingTenantAdminClientSecret: !tenantAdminSecretDrift,
    actorId: input.actorId,
    requestId: input.requestId,
  });
  if (!updatedInstance) {
    throw new Error('instance_update_failed_after_secret_sync');
  }

  loaded.instance = updatedInstance;
  updateLoadedSecrets(
    loaded,
    authSecretDrift,
    provisionedSecret,
    tenantAdminSecretDrift,
    provisionedTenantAdminSecret
  );
};
