import type { IamOrganizationDetail } from '@sva/core';
import { loadInstanceById } from '@sva/data-repositories/server';
import {
  updateOrganizationMainserverProvisioningState,
  writeActiveOrganizationProvisioningCredentials,
} from '@sva/iam-admin';

import { recordMainserverDataProviderObservation } from '../iam-contents/mainserver-data-provider-bindings.js';
import { readEffectiveSvaMainserverCredentialsWithStatus } from '../mainserver-effective-credentials.js';
import { provisionMainserverUserCredentials } from '../iam-account-management/mainserver-user-provisioning.js';
import { persistProvisionedMainserverCredentials } from '../iam-account-management/user-create-operation.js';
import {
  resolveIdentityProviderForInstance,
  withInstanceScopedDb,
} from '../iam-account-management/shared.js';
import type { IdentityProviderResolution } from '../iam-account-management/shared-runtime.js';
import {
  auditOrganizationProvisioning,
  loadProvisioningOrganization,
  organizationProvisioningLogger,
  toSafeProvisioningErrorCode,
  type OrganizationMainserverProvisioningInput,
  type OrganizationMainserverProvisioningResult,
} from './organization-mainserver-provisioning.shared.js';
import { resolveOrganizationTechnicalAccount } from './organization-mainserver-technical-account.js';
import {
  isAutomaticPreflightSkip,
  preflightNewOrganizationProvisioning,
} from './organization-mainserver-verification.js';

type NewProvisioningInput = OrganizationMainserverProvisioningInput & {
  readonly operationReference: string;
  readonly organization: IamOrganizationDetail;
  readonly technicalAccountId?: string;
  readonly setPhase: (phase: string) => void;
};

const updateState = async (
  input: NewProvisioningInput,
  state: Parameters<typeof updateOrganizationMainserverProvisioningState>[1]
): Promise<void> => {
  const updatedState = await withInstanceScopedDb(input.instanceId, (client) =>
    updateOrganizationMainserverProvisioningState(client, state)
  );
  if (!updatedState) {
    throw new Error('organization_provisioning_lease_lost');
  }
};

const skipProvisioning = async (
  input: NewProvisioningInput,
  phase: string,
  errorCode?: string,
  technicalAccountId?: string
): Promise<OrganizationMainserverProvisioningResult> => {
  await updateState(input, {
    instanceId: input.instanceId,
    organizationId: input.organizationId,
    operationReference: input.operationReference,
    provisioningStatus: 'not_provisioned',
    provisioningPhase: phase,
    lastErrorCode: errorCode,
    releaseLease: true,
  });
  await auditOrganizationProvisioning({
    ...input,
    phase,
    outcome: 'skipped',
    errorCode,
    technicalAccountId,
  });
  return {
    outcome: 'skipped',
    organization: await loadProvisioningOrganization(input.instanceId, input.organizationId),
    ...(errorCode ? { errorCode } : {}),
  };
};

const runPreflight = async (
  input: NewProvisioningInput
): Promise<OrganizationMainserverProvisioningResult | undefined> => {
  input.setPhase('provisioning_preflight');
  try {
    const result = await preflightNewOrganizationProvisioning(input);
    return result === 'integration_not_configured' ? skipProvisioning(input, result) : undefined;
  } catch (error) {
    if (input.trigger !== 'organization_create' || !isAutomaticPreflightSkip(error)) {
      throw error;
    }
    return skipProvisioning(
      input,
      'personal_credentials_missing',
      toSafeProvisioningErrorCode(error)
    );
  }
};

const persistCredentials = async (
  input: NewProvisioningInput,
  resolved: Awaited<ReturnType<typeof resolveOrganizationTechnicalAccount>>,
  identityProvider: IdentityProviderResolution,
  credentials: NonNullable<Awaited<ReturnType<typeof provisionMainserverUserCredentials>>>
): Promise<void> => {
  input.setPhase('credential_persistence');
  const persisted = await withInstanceScopedDb(input.instanceId, (client) =>
    writeActiveOrganizationProvisioningCredentials(client, {
      instanceId: input.instanceId,
      organizationId: input.organizationId,
      operationReference: input.operationReference,
      actorAccountId: input.actorAccountId,
      mainserverApplicationId: credentials.mainserverUserApplicationId,
      mainserverApplicationSecret: credentials.mainserverUserApplicationSecret,
    })
  );
  if (!persisted) {
    throw new Error('organization_provisioning_lease_lost');
  }
  await persistProvisionedMainserverCredentials({
    identityProvider,
    keycloakSubject: resolved.account.keycloakSubject,
    credentials,
  });
};

const completeProvisioning = async (
  input: NewProvisioningInput,
  accountId: string,
  keycloakSubject: string,
  dataProviderId: string
): Promise<OrganizationMainserverProvisioningResult> => {
  input.setPhase('data_provider_binding');
  const effective = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: input.instanceId,
    keycloakSubject: input.actorSubject,
    activeOrganizationId: input.organizationId,
    actingPrincipalType: 'organization',
  });
  if (effective.status !== 'ok' || effective.source !== 'organization') {
    throw new Error('organization_credentials_unavailable_after_persist');
  }
  const binding = await recordMainserverDataProviderObservation({
    instanceId: input.instanceId,
    principalType: 'organization',
    principalId: input.organizationId,
    credentialFingerprint: effective.credentialFingerprint,
    dataProviderId,
    evidenceKind: 'create_response',
  });
  const conflict = binding.outcome === 'conflict';
  const phase = conflict ? 'binding_conflict' : 'completed';
  const outcome = conflict ? 'reconciliation_required' : 'ready';
  const errorCode = conflict ? 'data_provider_binding_conflict' : undefined;
  await updateState(input, {
    instanceId: input.instanceId,
    organizationId: input.organizationId,
    operationReference: input.operationReference,
    provisioningStatus: outcome,
    provisioningPhase: phase,
    lastErrorCode: errorCode,
    releaseLease: true,
    complete: true,
    verified: !conflict,
  });
  organizationProvisioningLogger.info('Organization Mainserver provisioning completed', {
    workspace_id: input.instanceId,
    context: {
      operation: 'organization_mainserver_provisioning',
      organization_id: input.organizationId,
      technical_account_id: accountId,
      keycloak_subject: keycloakSubject,
      trigger: input.trigger,
      operation_reference: input.operationReference,
      result: outcome,
    },
  });
  await auditOrganizationProvisioning({
    ...input,
    phase,
    outcome,
    technicalAccountId: accountId,
    errorCode,
  });
  return {
    outcome,
    organization: await loadProvisioningOrganization(input.instanceId, input.organizationId),
    ...(errorCode ? { errorCode } : {}),
  };
};

export const provisionNewOrganizationMainserver = async (
  input: NewProvisioningInput
): Promise<OrganizationMainserverProvisioningResult> => {
  const skipped = await runPreflight(input);
  if (skipped) return skipped;

  const tenant = await loadInstanceById(input.instanceId);
  const identityProvider = await resolveIdentityProviderForInstance(input.instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!identityProvider || !tenant) throw new Error('keycloak_unavailable');

  input.setPhase('account_resolution');
  const resolved = await resolveOrganizationTechnicalAccount({
    ...input,
    organizationDisplayName: input.organization.displayName,
    tenantDisplayName: tenant.displayName,
    identityProvider,
  });
  input.setPhase('mainserver_request');
  const credentials = await provisionMainserverUserCredentials({
    actor: { instanceId: input.instanceId, actorAccountId: input.actorAccountId },
    actorSubject: input.actorSubject,
    keycloakSubject: resolved.account.keycloakSubject,
    payload: {
      email: resolved.identity.email,
      firstName: resolved.identity.firstName,
      lastName: resolved.identity.lastName,
      status: 'active',
      isTechnicalAccount: true,
      roleIds: [],
      groupIds: [],
      sendPasswordSetupEmail: false,
    },
  });
  if (!credentials) {
    return skipProvisioning(input, 'integration_not_configured', undefined, resolved.account.id);
  }
  await persistCredentials(input, resolved, identityProvider, credentials);
  return completeProvisioning(
    input,
    resolved.account.id,
    resolved.account.keycloakSubject,
    credentials.dataProviderId
  );
};
