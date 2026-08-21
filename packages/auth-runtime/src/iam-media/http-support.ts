import { getWorkspaceContext } from '@sva/server-runtime';

import { emitAuthAuditEvent } from '../audit-events.js';
import { createApiError } from '../shared/request-helpers.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import type { MediaService } from './service.js';
import { MediaStorageUnavailableError, type MediaStoragePort } from './storage-port.js';
import type { MediaPrimitiveAuthorizationResult } from './server-authorization.js';
import type { scheduleMediaContentSaveRecovery } from './content-save-recovery.js';
import { getMediaRequestId } from './request-context.js';

export type MediaHttpHandlerDeps = {
  readonly withMediaService: <T>(
    instanceId: string,
    work: (service: MediaService) => Promise<T>
  ) => Promise<T>;
  readonly storagePort: MediaStoragePort;
  readonly resolveStoragePort?: (instanceId: string) => Promise<MediaStoragePort>;
  readonly authorizeAction: (input: {
    ctx: AuthenticatedRequestContext;
    instanceId?: string;
    action: string;
    resource?: {
      assetId?: string;
      targetType?: string;
      targetId?: string;
      visibility?: string;
    };
  }) => Promise<MediaPrimitiveAuthorizationResult>;
  readonly createId: () => string;
  readonly now: () => string;
  readonly emitAuditEvent: typeof emitAuthAuditEvent;
  readonly scheduleContentSaveRecovery?: typeof scheduleMediaContentSaveRecovery;
};

type MediaAuditResult = 'success' | 'failure' | 'denied';

export const emitMediaAuditEvent = async (input: {
  readonly deps: Pick<MediaHttpHandlerDeps, 'emitAuditEvent'>;
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly actionId: string;
  readonly result: MediaAuditResult;
  readonly reasonCode?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
}) => {
  const workspaceContext = getWorkspaceContext();
  await input.deps.emitAuditEvent({
    eventType:
      input.result === 'success'
        ? 'plugin_action_authorized'
        : input.result === 'denied'
          ? 'plugin_action_denied'
          : 'plugin_action_failed',
    actorUserId: input.ctx.user.id,
    actorEmail: input.ctx.user.email,
    actorDisplayName: input.ctx.user.displayName,
    scope: { kind: 'instance', instanceId: input.instanceId },
    workspaceId: input.instanceId,
    outcome: input.result,
    requestId: workspaceContext.requestId,
    traceId: workspaceContext.traceId,
    pluginAction: {
      actionId: input.actionId,
      actionNamespace: 'media',
      actionOwner: 'host',
      result: input.result,
      reasonCode: input.reasonCode,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    },
  });
};

export const mapMediaAuthorizationFailure = (
  result: Exclude<MediaPrimitiveAuthorizationResult, { ok: true }>
): Response => {
  const code: 'invalid_instance_id' | 'invalid_request' | 'database_unavailable' | 'forbidden' =
    result.error === 'missing_instance'
      ? 'invalid_instance_id'
      : result.error === 'invalid_action'
        ? 'invalid_request'
        : result.error;
  return createApiError(
    result.status,
    code,
    result.message,
    getMediaRequestId(),
    result.permissionDenial
  );
};

export const handleMediaStorageUnavailable = async (input: {
  readonly deps: Pick<MediaHttpHandlerDeps, 'emitAuditEvent'>;
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly actionId: string;
  readonly resourceType: string;
  readonly resourceId?: string;
}): Promise<Response> => {
  await emitMediaAuditEvent({
    ...input,
    result: 'failure',
    reasonCode: 'media_storage_unavailable',
  });
  return createApiError(
    503,
    'internal_error',
    'Medien-Storage ist momentan nicht verfügbar.',
    getMediaRequestId()
  );
};

export const withMediaStorageGuard = async (
  work: () => Promise<Response>,
  input: Parameters<typeof handleMediaStorageUnavailable>[0]
): Promise<Response> => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof MediaStorageUnavailableError) {
      return handleMediaStorageUnavailable(input);
    }
    throw error;
  }
};

export const resolveMediaStoragePort = async (
  deps: Pick<MediaHttpHandlerDeps, 'storagePort' | 'resolveStoragePort'>,
  instanceId: string
): Promise<MediaStoragePort> =>
  deps.resolveStoragePort ? deps.resolveStoragePort(instanceId) : deps.storagePort;

export const readTrustedBucketObjectMetadata = async (
  deps: Pick<MediaHttpHandlerDeps, 'storagePort' | 'resolveStoragePort'>,
  instanceId: string,
  storageKey: string
): Promise<{ byteSize: number }> => {
  const storagePort = await resolveMediaStoragePort(deps, instanceId);
  const object = await storagePort.statObject({ instanceId, storageKey });
  return { byteSize: object.byteSize };
};
