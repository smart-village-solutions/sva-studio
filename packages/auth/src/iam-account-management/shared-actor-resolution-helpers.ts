import type { ApiErrorCode } from '@sva/core';
import {
  createActorResolutionServices,
  resolveActorAccountId,
  resolveMissingActorDiagnosticReason as resolveMissingActorDiagnosticReasonWithClient,
} from '@sva/iam-admin';

import { jitProvisionAccountWithClient } from '../jit-provisioning.server.js';

import { createApiError } from './api-helpers.js';
import { addActiveSpanEvent, annotateActiveSpan, createActorResolutionDetails } from './diagnostics.js';
import { logger } from './shared-observability.js';
import { withInstanceScopedDb } from './shared-runtime.js';

const actorResolutionServices = createActorResolutionServices({
  jitProvisionAccountWithClient,
  resolveActorAccountId,
  resolveMissingActorDiagnosticReason: resolveMissingActorDiagnosticReasonWithClient,
  withInstanceScopedDb,
});

export const { resolveActorAccountIdWithProvision } = actorResolutionServices;

export const createInstanceLookupError = (
  resolvedInstance: { reason: 'database_unavailable' | 'missing_instance' | 'invalid_instance' },
  requestId?: string,
  requestedInstanceId?: string
): {
  status: number;
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  requestedInstanceId?: string;
} => ({
  status: resolvedInstance.reason === 'database_unavailable' ? 503 : 400,
  code: resolvedInstance.reason === 'database_unavailable' ? 'database_unavailable' : 'invalid_instance_id',
  message:
    resolvedInstance.reason === 'database_unavailable'
      ? 'IAM-Datenbank ist nicht erreichbar.'
      : 'Ungültige oder fehlende instanceId.',
  requestId,
  requestedInstanceId,
});

export const resolveMissingActorDiagnosticReason = async (instanceId: string, keycloakSubject: string) => {
  return actorResolutionServices.resolveMissingActorDiagnosticReason(instanceId, keycloakSubject);
};

export const createMissingActorMembershipError = (input: {
  diagnosticReason: 'missing_actor_account' | 'missing_instance_membership';
  instanceId: string;
  userId: string;
  sessionInstanceId?: string;
  mayProvisionMissingActorMembership: boolean;
  requestId?: string;
  traceId?: string;
}) => {
  annotateActiveSpan({
    'iam.actor_resolution': input.diagnosticReason,
    'iam.reason_code': input.diagnosticReason,
    'iam.instance_id': input.instanceId,
  });
  addActiveSpanEvent('iam.actor_resolution_rejected', {
    'iam.reason_code': input.diagnosticReason,
    'iam.instance_id': input.instanceId,
  });
  logger.warn('IAM actor resolution rejected request without actor membership', {
    operation: 'resolve_actor',
    user_id: input.userId,
    instance_id: input.instanceId,
    session_instance_id: input.sessionInstanceId,
    allow_jit_provision: input.mayProvisionMissingActorMembership,
    actor_account_id: null,
    diagnostic_reason: input.diagnosticReason,
    request_id: input.requestId,
    trace_id: input.traceId,
  });
  return {
    error: createApiError(
      403,
      'forbidden',
      'Akteur-Account nicht gefunden.',
      input.requestId,
      createActorResolutionDetails({
        actorResolution: input.diagnosticReason,
        instanceId: input.instanceId,
      })
    ),
  };
};
