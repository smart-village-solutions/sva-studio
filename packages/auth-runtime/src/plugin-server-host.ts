import { emitAuthAuditEvent } from './audit-events.js';
import { evaluateAuthorizeDecision } from '@sva/iam-core';
import {
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
  saveExternalInterfaceRecord,
  saveExternalInterfaceConnectionCheck,
} from '@sva/data-repositories/server';
import { withInstanceDb } from './db.js';
import { revealField } from './iam-account-management/encryption.js';
import {
  completeIdempotency,
  hasIdempotentAuditEvent,
  releaseIdempotencyReservation,
  renewIdempotencyLease,
  reserveIdempotency,
  resolveActorInfo,
} from './iam-account-management/shared.js';
import { getAuthorizedPluginRequest } from './plugin-server-handlers/authorized-request.js';
import { buildLogContext } from './log-context.js';
import { withAuthenticatedUser } from './middleware.js';
import {
  readPluginOperationInput,
  storePluginOperationInput,
} from './plugin-operation-artifacts.server.js';
import {
  createJsonItemResponse,
  createPluginOperationJob,
  markPluginOperationEnqueueFailed,
} from './plugin-operations/core.shared.js';
import { withStudioJobRepository } from './plugin-operations/repository.js';
import { queuePluginOperationJob } from './plugin-operations/runner.js';
import { createApiError, toPayloadHash } from './shared/request-helpers.js';
import { validateCsrf } from './shared/request-security.js';

const authorizePluginAction = async (input: {
  request?: Request;
  handlerId?: string;
  instanceId: string;
  keycloakSubject: string;
  action: string;
  resourceType: string;
  requestId?: string;
}) => {
  const authorized = getAuthorizedPluginRequest({
    request: input.request,
    handlerId: input.handlerId,
    pluginId: input.resourceType,
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
  });
  if (!authorized) return { ok: true as const, allowed: false, reason: 'unverified_request' };
  const decision =
    authorized.decisions.get(input.action) ??
    evaluateAuthorizeDecision(
      {
        instanceId: input.instanceId,
        action: input.action,
        resource: { type: input.resourceType },
        context: input.requestId ? { requestId: input.requestId } : {},
      },
      authorized.permissions
    );
  return { ok: true as const, allowed: decision.allowed, reason: decision.reason };
};

const isAuthorizedPluginRequest = (input: {
  request: Request;
  handlerId: string;
  pluginId: string;
  instanceId: string;
  keycloakSubject: string;
}): boolean => getAuthorizedPluginRequest(input) !== null;

export const pluginServerHost = {
  emitAuthAuditEvent,
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
  saveExternalInterfaceRecord,
  saveExternalInterfaceConnectionCheck,
  withInstanceDb,
  revealField,
  completeIdempotency,
  hasIdempotentAuditEvent,
  releaseIdempotencyReservation,
  renewIdempotencyLease,
  reserveIdempotency,
  resolveActorInfo,
  authorizePluginAction,
  isAuthorizedPluginRequest,
  buildLogContext,
  withAuthenticatedUser,
  readPluginOperationInput,
  storePluginOperationInput,
  createJsonItemResponse,
  createPluginOperationJob,
  markPluginOperationEnqueueFailed,
  withStudioJobRepository,
  queuePluginOperationJob,
  createApiError,
  toPayloadHash,
  validateCsrf,
} as const;
