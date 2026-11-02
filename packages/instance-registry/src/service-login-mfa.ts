import { loadInstanceWithSecret } from './service-keycloak-secrets.js';
import {
  buildProvisioningInput,
  readQueuedPluginOidcClientRequirements,
} from './service-keycloak-execution-payload.js';
import { appendFinalStatusSnapshot } from './service-keycloak-execution-finalize.js';
import { loadRealmBaselineApplicability } from './service-keycloak-snapshot-reader.js';
import type { InstanceKeycloakProvisioningRun, TenantLoginMfaPolicyView } from '@sva/core';
import type { InstanceRegistryService, InstanceRegistryServiceDeps } from './service-types.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';
import { appendRunStep } from './service-keycloak-run-steps.js';
import { failRun } from './service-keycloak-execution-failures.js';

export const createUpdateLoginMfaPolicy =
  (deps: InstanceRegistryServiceDeps): InstanceRegistryService['updateLoginMfaPolicy'] =>
  async (input) => {
    // The runtime wraps this entire operation in the tenant's existing transaction/lock.
    const instance = await deps.repository.updateLoginMfaPolicy(input);
    const mode = instance.loginMfaPolicy?.desiredMode ?? 'optional';
    const revision = instance.loginMfaRevision ?? 0;
    if (!deps.readPluginOidcClientRequirements)
      throw new Error('plugin_oidc_client_requirements_dependency_missing');
    const pluginOidcClients = deps.readPluginOidcClientRequirements() ?? [];
    const clientIds = [
      instance.authClientId,
      ...pluginOidcClients
        .filter((client) => client.contractVersion === '2.0')
        .map((client) => client.clientId),
    ];
    const details = {
      pluginOidcSnapshotVersion: '1.0',
      pluginOidcClients,
      loginMfaOnly: true,
      loginMfaMode: mode,
      loginMfaRevision: revision,
      authRealm: instance.authRealm,
      clientIds,
    };
    const { run } = await deps.repository.createKeycloakProvisioningRun({
      instanceId: input.instanceId,
      mutation: 'reconcileKeycloak',
      idempotencyKey: `login-mfa:${revision}`,
      payloadFingerprint: buildPayloadFingerprint(details),
      mode: instance.realmMode,
      intent: 'provision',
      overallStatus: 'planned',
      driftSummary: 'Tenant login MFA policy pending verification.',
      actorId: input.actorId,
      requestId: input.requestId,
    });
    await appendRunStep(deps, {
      runId: run.id,
      stepKey: 'queued',
      title: 'Apply tenant login MFA',
      status: 'pending',
      summary: 'Waiting for the existing provisioning worker.',
      details,
      requestId: input.requestId,
    });
    await deps.repository.bindLoginMfaRun({
      instanceId: input.instanceId,
      revision,
      runId: run.id,
    });
    await deps.repository.appendAuditEvent({
      instanceId: input.instanceId,
      eventType: 'instance_reconfigured',
      actorId: input.actorId,
      requestId: input.requestId,
      details: {
        action: 'iam.authenticationPolicy.manage',
        desiredMode: mode,
        appliedMode: instance.loginMfaPolicy?.appliedMode ?? null,
        revision,
        runId: run.id,
        status: 'pending',
      },
    });
    return {
      policy: {
        desiredMode: mode,
        appliedMode: instance.loginMfaPolicy?.appliedMode ?? null,
        status: 'pending',
      },
      revision,
      runId: run.id,
    } satisfies TenantLoginMfaPolicyView;
  };

export const processLoginMfaRun = async (
  deps: InstanceRegistryServiceDeps,
  run: InstanceKeycloakProvisioningRun
) => {
  try {
    const queued = run.steps.find((step) => step.stepKey === 'queued')?.details;
    const instance = await deps.repository.getInstanceById(run.instanceId);
    const mode = queued?.loginMfaMode;
    const revision = queued?.loginMfaRevision;
    if (
      !instance ||
      instance.loginMfaRunId !== run.id ||
      instance.loginMfaRevision !== revision ||
      instance.loginMfaPolicy?.desiredMode !== mode
    )
      throw new Error('login_mfa_request_superseded');
    if (
      (mode !== 'optional' && mode !== 'required') ||
      typeof revision !== 'number' ||
      !Array.isArray(queued?.clientIds) ||
      !queued.clientIds.every((id) => typeof id === 'string')
    )
      throw new Error('login_mfa_queue_invalid');
    if (!deps.reconcileLoginMfa) throw new Error('login_mfa_provisioner_unavailable');
    const state = await deps.reconcileLoginMfa({
      authRealm: instance.authRealm,
      mode,
      clientIds: queued.clientIds as string[],
    });
    if (!state.aligned || state.mode !== mode) throw new Error('login_mfa_readback_mismatch');
    // A policy revision invalidates prior full snapshots. Read all provider state
    // independently instead of carrying stale non-MFA checks into this revision.
    if (!deps.readKeycloakStateViaProvisioner) throw new Error('login_mfa_provisioner_unavailable');
    const loaded = await loadInstanceWithSecret(deps, run.instanceId);
    if (!loaded) throw new Error('login_mfa_request_superseded');
    const pluginOidcClients = readQueuedPluginOidcClientRequirements(queued, loaded.instance);
    const fullState = await deps.readKeycloakStateViaProvisioner({
      ...buildProvisioningInput(loaded),
      pluginOidcClients,
    });
    if (!fullState.loginMfa?.aligned || fullState.loginMfa.mode !== mode)
      throw new Error('login_mfa_readback_mismatch');

    if (
      !(await deps.repository.verifyLoginMfaPolicy({
        instanceId: run.instanceId,
        revision,
        mode,
        runId: run.id,
      }))
    )
      throw new Error('login_mfa_request_superseded');
    await appendFinalStatusSnapshot(
      deps,
      { loaded, runId: run.id, intent: run.intent, requestId: run.requestId, pluginOidcClients },
      loaded.instance,
      fullState,
      await loadRealmBaselineApplicability(deps, loaded.instance)
    );
    await appendRunStep(deps, {
      runId: run.id,
      stepKey: 'login_mfa',
      title: 'Verify tenant login MFA',
      status: 'done',
      summary: 'Managed flows, OTP enrollment and ACR mapping verified.',
      details: { desiredMode: mode, appliedMode: mode, revision },
      requestId: run.requestId,
    });
    await deps.repository.updateKeycloakProvisioningRun({
      runId: run.id,
      overallStatus: 'succeeded',
      driftSummary: 'Tenant login MFA verified.',
    });
    await deps.repository.appendAuditEvent({
      instanceId: run.instanceId,
      eventType: 'instance_reconfigured',
      actorId: run.actorId,
      requestId: run.requestId,
      details: {
        action: 'iam.authenticationPolicy.manage',
        appliedMode: mode,
        revision,
        runId: run.id,
        status: 'applied',
      },
    });
  } catch (error) {
    await failRun(deps, {
      runId: run.id,
      instanceId: run.instanceId,
      intent: run.intent,
      requestId: run.requestId,
      error,
    });
    await deps.repository.appendAuditEvent({
      instanceId: run.instanceId,
      eventType: 'instance_reconfigured',
      actorId: run.actorId,
      requestId: run.requestId,
      details: {
        action: 'iam.authenticationPolicy.manage',
        revision: run.steps.find((step) => step.stepKey === 'queued')?.details?.loginMfaRevision,
        runId: run.id,
        status: 'failed',
      },
    });
  }
  return deps.repository.getKeycloakProvisioningRun(run.instanceId, run.id);
};
