import { createSdkLogger, toJsonErrorResponse, withRequestContext } from '@sva/server-runtime';
import { loadWasteDataSourceRecord, saveWasteConnectionCheck, saveWasteDataSourceRecord } from '@sva/data-repositories/server';

import { protectField, revealField } from '../iam-account-management/encryption.js';
import { buildLogContext } from '../log-context.js';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';

const logger = createSdkLogger({ component: 'waste-management-auth-runtime', level: 'info' });

const withWasteManagementRequestContext = <T>(request: Request, work: () => Promise<T>): Promise<T> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, work);

export const withAuthenticatedWasteManagementHandler = (
  request: Request,
  handler: (request: Request, ctx: AuthenticatedRequestContext) => Promise<Response>
): Promise<Response> =>
  withWasteManagementRequestContext(request, async () => {
    try {
      return await withAuthenticatedUser(request, (ctx) => handler(request, ctx));
    } catch (error) {
      const logContext = buildLogContext('default', { includeTraceId: true });
      logger.error('Waste management request failed unexpectedly', {
        operation: 'waste_management_request',
        endpoint: request.url,
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        reason_code: 'instance_scope_unhandled_failure',
        ...logContext,
      });
      return toJsonErrorResponse(500, 'internal_error', 'Unbehandelter Waste-Management-Fehler.', {
        requestId: logContext.request_id,
      });
    }
  });

export const sharedWasteManagementDeps = {
  loadWasteDataSourceRecord,
  saveWasteDataSourceRecord,
  saveWasteConnectionCheck,
  protectSecret: protectField,
  revealSecret: revealField,
} as const;
