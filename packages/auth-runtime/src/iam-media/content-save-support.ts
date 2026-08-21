import { createApiError } from '../shared/request-helpers.js';
import type { AuthenticatedRequestContext } from '../middleware.js';
import type { MediaService } from './service.js';
import {
  getMediaRequestId as getRequestId,
  readMediaContentSaveOperationId as readContentSaveOperationId,
  resolveBodyScopedMediaInstanceId as resolveBodyScopedInstanceId,
} from './request-context.js';
import type { MediaHttpHandlerDeps } from './http-support.js';

export type ContentSaveOperationContext = Readonly<{
  instanceId: string;
  operationId: string;
  operation: NonNullable<Awaited<ReturnType<MediaService['getContentSaveOperation']>>>;
}>;

export const resolveContentSaveOperationContext = async (input: {
  deps: MediaHttpHandlerDeps;
  request: Request;
  ctx: AuthenticatedRequestContext;
  bodyInstanceId?: string;
}): Promise<ContentSaveOperationContext | Response> => {
  const operationId = readContentSaveOperationId(input.request);
  if (operationId instanceof Response) return operationId;
  const instanceScope = resolveBodyScopedInstanceId(
    input.bodyInstanceId,
    input.ctx.user.instanceId
  );
  if (!instanceScope.ok) return instanceScope.response;
  const operation = await input.deps.withMediaService(instanceScope.instanceId, (service) =>
    service.getContentSaveOperation({
      instanceId: instanceScope.instanceId,
      operationId,
      actorSubject: input.ctx.user.id,
    })
  );
  if (!operation) {
    return createApiError(
      404,
      'not_found',
      'Content-Speicheroperation nicht gefunden.',
      getRequestId()
    );
  }
  return { instanceId: instanceScope.instanceId, operationId, operation };
};
