import { randomUUID } from 'node:crypto';

import { loadInstanceById } from '@sva/data-repositories/server';
import {
  reserveOrganizationMainserverProvisioning,
  updateOrganizationMainserverProvisioningState,
  type OrganizationMainserverProvisioningReservation,
} from '@sva/iam-admin';

import { recordMainserverDataProviderObservation } from '../iam-contents/mainserver-data-provider-bindings.js';
import { MainserverUserProvisioningError } from '../iam-account-management/mainserver-user-provisioning-error.js';
import {
  resolveIdentityProviderForInstance,
  withInstanceScopedDb,
} from '../iam-account-management/shared.js';
import { persistProvisionedMainserverCredentials } from '../iam-account-management/user-create-operation.js';
import { provisionNewOrganizationMainserver } from './organization-mainserver-new-provisioning.js';
import {
  ORGANIZATION_PROVISIONING_LEASE_SECONDS,
  auditOrganizationProvisioning,
  loadProvisioningOrganization,
  organizationProvisioningLogger,
  toSafeProvisioningErrorCode,
  type OrganizationMainserverProvisioningInput,
  type OrganizationMainserverProvisioningResult,
  type OrganizationMainserverProvisioningTrigger,
} from './organization-mainserver-provisioning.shared.js';
import {
  deriveOrganizationTechnicalIdentity,
  resolveOrganizationTechnicalAccount,
  type DerivedOrganizationTechnicalIdentity,
} from './organization-mainserver-technical-account.js';
import { verifyExistingOrganizationCredentials } from './organization-mainserver-verification.js';

export { deriveOrganizationTechnicalIdentity };
export type {
  DerivedOrganizationTechnicalIdentity,
  OrganizationMainserverProvisioningResult,
  OrganizationMainserverProvisioningTrigger,
};

const returnReservedOutcome = async (
  input: OrganizationMainserverProvisioningInput,
  operationReference: string,
  reservation: Awaited<ReturnType<typeof reserveOrganizationMainserverProvisioning>>,
  organization: OrganizationMainserverProvisioningResult['organization']
): Promise<OrganizationMainserverProvisioningResult | undefined> => {
  if (reservation.acquired) return undefined;
  const outcome = reservation.state.provisioningStatus === 'ready' ? 'ready' : 'in_progress';
  await auditOrganizationProvisioning({
    ...input,
    operationReference,
    phase: reservation.state.provisioningPhase ?? 'reservation',
    outcome,
    technicalAccountId: reservation.state.technicalAccountId,
  });
  return { outcome, organization };
};

const verifyReservedCredentials = async (
  input: OrganizationMainserverProvisioningInput,
  operationReference: string,
  organization: OrganizationMainserverProvisioningResult['organization'],
  technicalAccountId: string | undefined,
  setPhase: (phase: string) => void
): Promise<OrganizationMainserverProvisioningResult> => {
  const verified = await verifyExistingOrganizationCredentials(input);
  setPhase('account_resolution');
  const tenant = await loadInstanceById(input.instanceId);
  const identityProvider = await resolveIdentityProviderForInstance(input.instanceId, {
    executionMode: 'tenant_admin',
  });
  if (!identityProvider || !tenant) throw new Error('keycloak_unavailable');
  const resolved = await resolveOrganizationTechnicalAccount({
    ...input,
    organizationDisplayName: organization.displayName,
    tenantDisplayName: tenant.displayName,
    technicalAccountId,
    operationReference,
    identityProvider,
  });
  setPhase('credential_persistence');
  const stateBeforeAccountWrite = await withInstanceScopedDb(input.instanceId, (client) =>
    updateOrganizationMainserverProvisioningState(client, {
      instanceId: input.instanceId,
      organizationId: input.organizationId,
      operationReference,
      provisioningStatus: 'provisioning',
      provisioningPhase: 'account_credentials_persistence',
    })
  );
  if (!stateBeforeAccountWrite) {
    throw new Error('organization_provisioning_lease_lost');
  }
  await persistProvisionedMainserverCredentials({
    identityProvider,
    keycloakSubject: resolved.account.keycloakSubject,
    credentials: {
      dataProviderId: verified.dataProviderId,
      mainserverUserApplicationId: verified.credentials.apiKey,
      mainserverUserApplicationSecret: verified.credentials.apiSecret,
    },
  });
  setPhase('data_provider_binding');
  const observation = await recordMainserverDataProviderObservation({
    instanceId: input.instanceId,
    principalType: 'organization',
    principalId: input.organizationId,
    credentialFingerprint: verified.credentialFingerprint,
    dataProviderId: verified.dataProviderId,
    dataProviderName: verified.dataProviderName,
    evidenceKind: 'identity_endpoint',
  });
  const conflict = observation.outcome === 'conflict';
  const phase = conflict ? 'binding_conflict' : 'verified_existing_credentials';
  const outcome = conflict ? 'reconciliation_required' : 'ready';
  const errorCode = conflict ? 'data_provider_binding_conflict' : undefined;
  const state = await withInstanceScopedDb(input.instanceId, (client) =>
    updateOrganizationMainserverProvisioningState(client, {
      instanceId: input.instanceId,
      organizationId: input.organizationId,
      operationReference,
      provisioningStatus: outcome,
      provisioningPhase: phase,
      lastErrorCode: errorCode,
      releaseLease: true,
      complete: true,
      verified: !conflict,
    })
  );
  if (!state) {
    throw new Error('organization_provisioning_lease_lost');
  }
  await auditOrganizationProvisioning({
    ...input,
    operationReference,
    phase,
    outcome,
    errorCode,
    technicalAccountId: resolved.account.id,
  });
  return {
    outcome,
    organization: await loadProvisioningOrganization(input.instanceId, input.organizationId),
    ...(errorCode ? { errorCode } : {}),
  };
};

const isUncertainFailure = (phase: string, error: unknown): boolean =>
  (phase === 'mainserver_request' &&
    error instanceof MainserverUserProvisioningError &&
    error.outcomeUnknown) ||
  ['credential_persistence', 'data_provider_binding', 'data_provider_verification'].includes(phase);

const recordFailure = async (
  input: OrganizationMainserverProvisioningInput,
  operationReference: string,
  reservation: OrganizationMainserverProvisioningReservation,
  phase: string,
  error: unknown
): Promise<OrganizationMainserverProvisioningResult> => {
  const errorCode = toSafeProvisioningErrorCode(error);
  const uncertain = isUncertainFailure(phase, error);
  const outcome = uncertain ? 'reconciliation_required' : 'failed';
  await withInstanceScopedDb(input.instanceId, (client) =>
    updateOrganizationMainserverProvisioningState(client, {
      instanceId: input.instanceId,
      organizationId: input.organizationId,
      operationReference,
      provisioningStatus: outcome,
      provisioningPhase: phase,
      lastErrorCode: errorCode,
      releaseLease: true,
      complete: true,
    })
  ).catch(() => undefined);
  organizationProvisioningLogger.error('Organization Mainserver provisioning failed', {
    workspace_id: input.instanceId,
    context: {
      operation: 'organization_mainserver_provisioning',
      organization_id: input.organizationId,
      trigger: input.trigger,
      operation_reference: operationReference,
      phase,
      error_code: errorCode,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
    },
  });
  await auditOrganizationProvisioning({
    ...input,
    operationReference,
    phase,
    outcome,
    errorCode,
    technicalAccountId: reservation.state.technicalAccountId,
  });
  return {
    outcome,
    organization: await loadProvisioningOrganization(input.instanceId, input.organizationId),
    errorCode,
  };
};

export const provisionOrganizationMainserver = async (
  input: OrganizationMainserverProvisioningInput
): Promise<OrganizationMainserverProvisioningResult> => {
  const operationReference = input.operationReference ?? randomUUID();
  const organization = await loadProvisioningOrganization(input.instanceId, input.organizationId);
  const reservation = await withInstanceScopedDb(input.instanceId, (client) =>
    reserveOrganizationMainserverProvisioning(client, {
      instanceId: input.instanceId,
      organizationId: input.organizationId,
      operationReference,
      actorAccountId: input.actorAccountId,
      leaseSeconds: ORGANIZATION_PROVISIONING_LEASE_SECONDS,
      allowReadyRefresh: input.trigger === 'explicit_retry',
    })
  );
  const reservedOutcome = await returnReservedOutcome(
    input,
    operationReference,
    reservation,
    organization
  );
  if (reservedOutcome) return reservedOutcome;

  let phase = 'identity_provider';
  try {
    if (
      reservation.state.mainserverApplicationId &&
      reservation.state.mainserverApplicationSecretSet
    ) {
      phase = 'data_provider_verification';
      return await verifyReservedCredentials(
        input,
        operationReference,
        organization,
        reservation.state.technicalAccountId,
        (nextPhase) => {
          phase = nextPhase;
        }
      );
    }
    return await provisionNewOrganizationMainserver({
      ...input,
      operationReference,
      organization,
      technicalAccountId: reservation.state.technicalAccountId,
      setPhase: (nextPhase) => {
        phase = nextPhase;
      },
    });
  } catch (error) {
    return recordFailure(input, operationReference, reservation, phase, error);
  }
};
