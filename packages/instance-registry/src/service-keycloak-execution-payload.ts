import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import { readPluginOidcClientRequirements } from './provisioning-auth-plugin-clients.js';
import type { PluginOidcClientRequirement } from './provisioning-auth-types.js';
import type { KeycloakProvisioningInput } from './provisioning-auth-types.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import type { KeycloakTenantPlan } from './keycloak-types.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { appendRunStep } from './service-keycloak-run-steps.js';
import {
  KEYCLOAK_REALM_BASELINE,
  KEYCLOAK_REALM_BASELINE_FINGERPRINT,
} from './keycloak-realm-baseline.js';

const buildTempPasswordAad = (runId: string): string =>
  `iam.instances.keycloak_run_temp_password:${runId}`;

export type KeycloakProvisioningMutation = 'executeKeycloakProvisioning' | 'reconcileKeycloak';

export const buildKeycloakProvisioningPayloadFingerprint = (input: {
  readonly mutation: KeycloakProvisioningMutation;
  readonly intent?: ExecuteInstanceKeycloakProvisioningInput['intent'];
  readonly rotateClientSecret?: boolean;
  readonly planFingerprint?: string;
  readonly tenantAdminTemporaryPassword?: string;
}): string => {
  const payload =
    input.mutation === 'executeKeycloakProvisioning'
      ? {
          intent: input.intent,
          planFingerprint: input.planFingerprint,
        }
      : {
          rotateClientSecret: input.rotateClientSecret ?? false,
          planFingerprint: input.planFingerprint,
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
  provisioningInput: Pick<KeycloakProvisioningInput, 'authClientId' | 'tenantAdminClient'>
): readonly PluginOidcClientRequirement[] => {
  if (details && details.pluginOidcSnapshotVersion === undefined) {
    return [];
  }
  const requirements = details?.pluginOidcClients;
  if (
    details?.pluginOidcSnapshotVersion !== '1.0' ||
    !Array.isArray(requirements) ||
    requirements.some(
      (requirement) =>
        requirement === null || typeof requirement !== 'object' || Array.isArray(requirement)
    )
  ) {
    throw new Error('queued_plugin_oidc_client_requirements_missing_or_invalid');
  }
  return readPluginOidcClientRequirements({
    ...provisioningInput,
    pluginOidcClients: requirements as unknown as readonly PluginOidcClientRequirement[],
  });
};

export const readLatestQueuedPluginOidcClientRequirements = (
  runs: readonly {
    readonly steps: readonly {
      readonly stepKey: string;
      readonly details?: Readonly<Record<string, unknown>>;
    }[];
  }[],
  provisioningInput: Pick<KeycloakProvisioningInput, 'authClientId' | 'tenantAdminClient'>,
  fallback: readonly PluginOidcClientRequirement[] = []
): readonly PluginOidcClientRequirement[] => {
  for (const run of runs) {
    const queued = run.steps.find((step) => step.stepKey === 'queued');
    if (!queued) continue;
    try {
      return readQueuedPluginOidcClientRequirements(queued.details, provisioningInput);
    } catch {
      return [];
    }
  }
  return fallback;
};

export const assertQueuedRealmBaselineCurrent = (
  details: Readonly<Record<string, unknown>> | undefined,
  realmMode: 'new' | 'existing'
): void => {
  if (realmMode !== 'new') return;
  if (
    details?.realmBaselineVersion !== KEYCLOAK_REALM_BASELINE.version ||
    details.realmBaselineFingerprint !== KEYCLOAK_REALM_BASELINE_FINGERPRINT
  ) {
    throw new Error('queued_realm_baseline_missing_or_changed');
  }
};

export const createQueuedRun = async (
  deps: InstanceRegistryServiceDeps,
  loaded: NonNullable<Awaited<ReturnType<typeof loadInstanceWithSecret>>>,
  input: ExecuteInstanceKeycloakProvisioningInput & {
    readonly mutation: KeycloakProvisioningMutation;
    readonly rotateClientSecret?: boolean;
    readonly confirmedPlan?: KeycloakTenantPlan;
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

  const requiresQueuedStep =
    created ||
    (run.overallStatus === 'planned' && !run.steps.some((step) => step.stepKey === 'queued'));
  if (requiresQueuedStep) {
    const readPluginOidcClientRequirements = deps.readPluginOidcClientRequirements;
    if (!readPluginOidcClientRequirements) {
      throw new Error('plugin_oidc_client_requirements_dependency_missing');
    }
    if (!deps.readRoleCatalogFingerprint) {
      throw new Error('role_catalog_fingerprint_dependency_missing');
    }
    const pluginOidcClients = readPluginOidcClientRequirements();
    const confirmedRoleCatalogFingerprint = await deps.readRoleCatalogFingerprint(
      loaded.instance.instanceId
    );
    await appendRunStep(deps, {
      runId: run.id,
      stepKey: 'queued',
      title: 'Provisioning-Auftrag einreihen',
      status: 'pending',
      summary:
        'Der Auftrag wurde gespeichert und wartet auf die Abarbeitung durch den Provisioning-Worker.',
      details: {
        intent: input.intent,
        mode: loaded.instance.realmMode,
        authRealm: loaded.instance.authRealm,
        authClientId: loaded.instance.authClientId,
        primaryHostname: loaded.instance.primaryHostname,
        confirmedPlanFingerprint: input.planFingerprint,
        confirmedPlanContractVersion: input.confirmedPlan?.contractVersion,
        confirmedPlanSteps: input.confirmedPlan?.steps,
        confirmedRoleCatalogFingerprint,
        realmBaselineVersion:
          loaded.instance.realmMode === 'new' ? KEYCLOAK_REALM_BASELINE.version : undefined,
        realmBaselineFingerprint:
          loaded.instance.realmMode === 'new' ? KEYCLOAK_REALM_BASELINE_FINGERPRINT : undefined,
        pluginOidcSnapshotVersion: '1.0',
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
