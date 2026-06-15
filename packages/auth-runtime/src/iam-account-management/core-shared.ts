import { createSdkLogger, toJsonErrorResponse, withRequestContext } from '@sva/server-runtime';

import {
  withAuthenticatedUser,
  type AuthenticatedRequestContext,
} from '../middleware.js';
import { buildLogContext } from '../log-context.js';

const logger = createSdkLogger({ component: 'iam-service', level: 'info' });

const withIamRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

export const withAuthenticatedIamHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withIamRequestContext(request, async () => {
    try {
      return await withAuthenticatedUser(request, (ctx) => handler(request, ctx));
    } catch (error) {
      const logContext = buildLogContext(undefined, { includeTraceId: true });
      logger.error('IAM request failed unexpectedly', {
        operation: 'iam_request',
        endpoint: request.url,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
        ...logContext,
      });

      return toJsonErrorResponse(500, 'internal_error', 'Unbehandelter IAM-Fehler.', {
        requestId: logContext.request_id,
      });
    }
  });
