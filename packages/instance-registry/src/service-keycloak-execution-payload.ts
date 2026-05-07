import { createHash } from 'node:crypto';

import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import { appendRunStep } from './service-keycloak-run-steps.js';

const buildTempPasswordAad = (runId: string): string => `iam.instances.keycloak_run_temp_password:${runId}`;

export type KeycloakProvisioningMutation = 'executeKeycloakProvisioning' | 'reconcileKeycloak';

const normalizeForFingerprint = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeForFingerprint);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeForFingerprint(entryValue)])
    );
  }
  return value;
};

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
  return createHash('sha256')
    .update(JSON.stringify(normalizeForFingerprint(payload)))
    .digest('hex');
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
        tenantAdminTemporaryPasswordCiphertext: input.tenantAdminTemporaryPassword
          ? deps.protectSecret?.(input.tenantAdminTemporaryPassword, buildTempPasswordAad(run.id))
          : undefined,
      },
      requestId: input.requestId,
    });
  }

  return { provisioningInput, run };
};
