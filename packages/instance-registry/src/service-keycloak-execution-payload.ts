import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import { readPluginOidcClientRequirements } from './provisioning-auth-plugin-clients.js';
import type { PluginOidcClientRequirement } from './provisioning-auth-types.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { appendRunStep } from './service-keycloak-run-steps.js';

const buildTempPasswordAad = (runId: string): string => `iam.instances.keycloak_run_temp_password:${runId}`;

export type KeycloakProvisioningMutation = 'executeKeycloakProvisioning' | 'reconcileKeycloak';

export const buildKeycloakProvisioningPayloadFingerprint = (input: {
  readonly mutation: KeycloakProvisioningMutation;
  readonly intent?: ExecuteInstanceKeycloakProvisioningInput['intent'];
  readonly rotateClientSecret?: boolean;
  readonly tenantAdminTemporaryPassword?: string;
}): string => {
  const payload =
    input.mutation === 'executeKeycloakProvisioning'
      ? {
          intent: input.intent,
        }
      : {
          rotateClientSecret: input.rotateClientSecret ?? false,
        };
  return buildPayloadFingerprint(payload);
};

export const buildProvisioningInput = (
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>
) => ({
  instanceId: loaded.instance.instanceId,
  primaryHostname: loaded.instance.primaryHostname,
  realmMode: loaded.instance.realmMode,
  authRealm: loaded.instance.authRealm,
  authClientId: loaded.instance.authClientId,
  authIssuerUrl: loaded.instance.authIssuerUrl,
  authClientSecretConfigured: loaded.instance.authClientSecretConfigured,
  authClientSecret: loaded.authClientSecret,
  tenantAdminClient: loaded.instance.tenantAdminClient,
  tenantAdminClientSecret: loaded.tenantAdminClientSecret,
  tenantAdminBootstrap: loaded.instance.tenantAdminBootstrap,
});

export const readQueuedTemporaryPassword = (
  deps: Pick<InstanceRegistryServiceDeps, 'revealSecret'>,
  runId: string,
  details: Readonly<Record<string, unknown>> | undefined
): string | undefined => {
  const ciphertext =
    typeof details?.tenantAdminTemporaryPasswordCiphertext === 'string'
      ? details.tenantAdminTemporaryPasswordCiphertext
      : undefined;
  return deps.revealSecret?.(ciphertext, buildTempPasswordAad(runId));
};

export const readQueuedPluginOidcClientRequirements = (
  details: Readonly<Record<string, unknown>> | undefined,
  provisioningInput: ReturnType<typeof buildProvisioningInput>
): readonly PluginOidcClientRequirement[] => {
  const requirements = details?.pluginOidcClients;
  if (!Array.isArray(requirements) || requirements.some(
    (requirement) => requirement === null || typeof requirement !== 'object' || Array.isArray(requirement)
  )) {
    throw new Error('queued_plugin_oidc_client_requirements_missing_or_invalid');
  }
  return readPluginOidcClientRequirements({
    ...provisioningInput,
    pluginOidcClients: requirements as unknown as readonly PluginOidcClientRequirement[],
  });
};

export const createQueuedRun = async (
  deps: InstanceRegistryServiceDeps,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>,
  input: ExecuteInstanceKeycloakProvisioningInput & {
    readonly mutation: KeycloakProvisioningMutation;
    readonly rotateClientSecret?: boolean;
  }
) => {
  const provisioningInput = buildProvisioningInput(loaded);
  const { run, created } = await deps.repository.createKeycloakProvisioningRun({
    instanceId: loaded.instance.instanceId,
    mutation: input.mutation,
    idempotencyKey: input.idempotencyKey,
    payloadFingerprint: buildKeycloakProvisioningPayloadFingerprint(input),
    mode: loaded.instance.realmMode,
    intent: input.intent,
    overallStatus: 'planned',
    driftSummary: 'Provisioning-Auftrag erstellt und für den Worker vorgemerkt.',
    actorId: input.actorId,
    requestId: input.requestId,
  });

  if (created) {
    const readPluginOidcClientRequirements = deps.readPluginOidcClientRequirements;
    if (!readPluginOidcClientRequirements) {
      throw new Error('plugin_oidc_client_requirements_dependency_missing');
    }
    const pluginOidcClients = readPluginOidcClientRequirements();
    await appendRunStep(deps, {
      runId: run.id,
      stepKey: 'queued',
      title: 'Provisioning-Auftrag einreihen',
      status: 'pending',
      summary: 'Der Auftrag wurde gespeichert und wartet auf die Abarbeitung durch den Provisioning-Worker.',
      details: {
        intent: input.intent,
        mode: loaded.instance.realmMode,
        authRealm: loaded.instance.authRealm,
        authClientId: loaded.instance.authClientId,
        primaryHostname: loaded.instance.primaryHostname,
        pluginOidcClients,
        tenantAdminTemporaryPasswordCiphertext: input.tenantAdminTemporaryPassword
          ? deps.protectSecret?.(input.tenantAdminTemporaryPassword, buildTempPasswordAad(run.id))
          : undefined,
      },
      requestId: input.requestId,
    });
  }

  return { provisioningInput, run };
};
