import { withRequestContext } from '@sva/server-runtime';
import { runDsrMaintenance } from '@sva/iam-governance/dsr-maintenance';
import { withAuthenticatedUser } from '../middleware.js';
import { jsonResponse } from '../db.js';
import { readBoolean, readNumber, readString } from '../shared/input-readers.js';
import {
  DSR_WRITE_ACTION,
  authorizeDsrJsonAction,
  handleJsonDatabaseError,
  requireJsonBody,
  resolveJsonScopedInstance,
  withInstanceScopedDb,
} from './shared.js';
import { resolveAccountBySubject } from './persistence.js';

export const optionalProcessingExecuteHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const instanceScope = resolveJsonScopedInstance({
        request,
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
      });
      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      const { instanceId } = instanceScope;

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          const account = await resolveAccountBySubject(client, {
            instanceId,
            keycloakSubject: user.id,
          });
          if (!account) {
            return jsonResponse(404, { error: 'account_not_found' });
          }

          const blockedByRestriction = Boolean(account.processing_restricted_at);
          const blockedByObjection = Boolean(account.non_essential_processing_opt_out_at);
          if (blockedByRestriction || blockedByObjection) {
            return jsonResponse(423, {
              error: 'processing_restricted',
              blockedByRestriction,
              blockedByObjection,
            });
          }

          return jsonResponse(200, {
            status: 'ok',
            executed: true,
          });
        });
      } catch (error) {
        return handleJsonDatabaseError(
          'Optional processing execution check failed',
          'optional_processing_execute',
          instanceId,
          error
        );
      }
    });
  });
};
export const dataSubjectMaintenanceHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const authorizationError = await authorizeDsrJsonAction(ctx, DSR_WRITE_ACTION);
      if (authorizationError) {
        return authorizationError;
      }
      const { user } = ctx;

      const bodyResult = await requireJsonBody(request);
      if (!bodyResult.ok) {
        return bodyResult.response;
      }
      const { body } = bodyResult;

      const instanceScope = resolveJsonScopedInstance({
        bodyInstanceId: readString(body.instanceId),
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
      });
      const dryRun = readBoolean(body.dryRun) ?? false;
      const limit = readNumber(body.limit);
      void limit;

      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      const { instanceId } = instanceScope;

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          const result = await runDsrMaintenance(client, { instanceId, dryRun });
          return jsonResponse(200, result);
        });
      } catch (error) {
        return handleJsonDatabaseError(
          'DSR maintenance run failed',
          'maintenance',
          instanceId,
          error
        );
      }
    });
  });
};
