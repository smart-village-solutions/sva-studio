import { getWorkspaceContext } from '@sva/server-runtime';

import {
  createApiError,
  readInstanceIdFromRequest,
  readPathSegment,
} from '../shared/request-helpers.js';

export const getMediaRequestId = (): string | undefined => getWorkspaceContext().requestId;

export const resolveScopedMediaInstanceId = (
  request: Request,
  userInstanceId?: string
): string | Response => {
  const instanceId = readInstanceIdFromRequest(request, userInstanceId);
  if (!instanceId) {
    return createApiError(400, 'invalid_instance_id', 'Instanz-ID fehlt.');
  }
  if (userInstanceId && instanceId !== userInstanceId) {
    return createApiError(403, 'forbidden', 'Instanzkontext stimmt nicht mit der Sitzung überein.');
  }
  return instanceId;
};

const readRequiredPathId = (
  request: Request,
  index: number,
  missingMessage: string
): string | Response =>
  readPathSegment(request, index) ??
  createApiError(400, 'invalid_request', missingMessage, getMediaRequestId());

export const readMediaAssetId = (request: Request): string | Response =>
  readRequiredPathId(request, 4, 'Asset-ID fehlt im Pfad.');

export const readMediaUploadSessionId = (request: Request): string | Response =>
  readRequiredPathId(request, 5, 'Upload-Session-ID fehlt im Pfad.');

export const readMediaContentSaveOperationId = (request: Request): string | Response =>
  readRequiredPathId(request, 5, 'Content-Save-Operation-ID fehlt im Pfad.');

export type ScopedMediaInstanceResult =
  { ok: true; instanceId: string } | { ok: false; response: Response };

export const resolveBodyScopedMediaInstanceId = (
  requestedInstanceId: string | undefined,
  userInstanceId?: string
): ScopedMediaInstanceResult => {
  const instanceId = requestedInstanceId ?? userInstanceId;
  if (!instanceId) {
    return {
      ok: false,
      response: createApiError(
        400,
        'invalid_instance_id',
        'Instanz-ID fehlt.',
        getMediaRequestId()
      ),
    };
  }
  if (userInstanceId && instanceId !== userInstanceId) {
    return {
      ok: false,
      response: createApiError(
        403,
        'forbidden',
        'Instanzkontext stimmt nicht mit der Sitzung überein.',
        getMediaRequestId()
      ),
    };
  }
  return { ok: true, instanceId };
};
