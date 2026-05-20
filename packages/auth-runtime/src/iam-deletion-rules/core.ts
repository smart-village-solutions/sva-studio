import { createSdkLogger, getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import { loadMyDeletionRulesOverview, loadTenantDeletionRulesOverview } from '@sva/iam-governance';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { createPoolResolver, jsonResponse, textResponse, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { withAuthenticatedUser } from '../middleware.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import {
  parseContentPreferencePayload,
  parseTenantDeletionRulesPayload,
} from './payloads.js';
import { resolveRequestInstanceId, validateTenantAdminScope, validateTenantScope } from './scope.js';
import {
  resolveActorAccountId,
  saveAccountContentPreference,
  upsertTenantDeletionRules,
} from './store.js';

const logger = createSdkLogger({ component: 'iam-deletion-rules', level: 'info' });

const resolvePool = createPoolResolver(getIamDatabaseUrl);

const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withResolvedInstanceDb(resolvePool, instanceId, work);

const loadAdminDeletionRulesResponse = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, async (ctx) => {
      const scoped = validateTenantAdminScope(ctx, resolveRequestInstanceId(request, ctx.user.instanceId));
      if (!scoped.ok) {
        return scoped.response;
      }

      try {
        const overview = await withInstanceScopedDb(scoped.instanceId, (client) =>
          loadTenantDeletionRulesOverview(client, {
            instanceId: scoped.instanceId,
            canEdit: true,
          })
        );

        return jsonResponse(200, overview);
      } catch (error) {
        logger.error('Tenant deletion rules overview failed', {
          instance_id: scoped.instanceId,
          error: error instanceof Error ? error.message : String(error),
          request_id: getWorkspaceContext().requestId,
          trace_id: getWorkspaceContext().traceId,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Tenant-Löschregeln konnten nicht geladen werden.',
          getWorkspaceContext().requestId
        );
      }
    })
  );

const saveAdminDeletionRulesResponse = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, async (ctx) => {
      const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
      if (csrfError) {
        return csrfError;
      }

      const parsed = await parseTenantDeletionRulesPayload(request);
      if (!parsed.ok) {
        return parsed.response;
      }

      const scoped = validateTenantAdminScope(ctx, parsed.data.instanceId);
      if (!scoped.ok) {
        return scoped.response;
      }

      try {
        const overview = await withInstanceScopedDb(scoped.instanceId, async (client) => {
          await upsertTenantDeletionRules(client, parsed.data);

          return loadTenantDeletionRulesOverview(client, {
            instanceId: scoped.instanceId,
            canEdit: true,
          });
        });

        return jsonResponse(200, overview);
      } catch (error) {
        logger.error('Tenant deletion rules update failed', {
          instance_id: scoped.instanceId,
          error: error instanceof Error ? error.message : String(error),
          request_id: getWorkspaceContext().requestId,
          trace_id: getWorkspaceContext().traceId,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Tenant-Löschregeln konnten nicht gespeichert werden.',
          getWorkspaceContext().requestId
        );
      }
    })
  );

const loadMyDeletionRulesResponse = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, async (ctx) => {
      const scoped = validateTenantScope(ctx, ctx.user.instanceId);
      if (!scoped.ok) {
        return scoped.response;
      }

      try {
        const overview = await withInstanceScopedDb(scoped.instanceId, async (client) => {
          const accountId = await resolveActorAccountId(client, {
            instanceId: scoped.instanceId,
            keycloakSubject: ctx.user.id,
          });
          if (!accountId) {
            return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', getWorkspaceContext().requestId);
          }

          return jsonResponse(
            200,
            await loadMyDeletionRulesOverview(client, {
              instanceId: scoped.instanceId,
              accountId,
            })
          );
        });

        return overview;
      } catch (error) {
        logger.error('My deletion rules overview failed', {
          instance_id: scoped.instanceId,
          error: error instanceof Error ? error.message : String(error),
          request_id: getWorkspaceContext().requestId,
          trace_id: getWorkspaceContext().traceId,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Eigene Löschregeln konnten nicht geladen werden.',
          getWorkspaceContext().requestId
        );
      }
    })
  );

const saveMyDeletionRulesPreferenceResponse = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, async (ctx) => {
      const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
      if (csrfError) {
        return csrfError;
      }

      const scoped = validateTenantScope(ctx, ctx.user.instanceId);
      if (!scoped.ok) {
        return scoped.response;
      }

      const parsed = await parseContentPreferencePayload(request);
      if (!parsed.ok) {
        return parsed.response;
      }

      try {
        return await withInstanceScopedDb(scoped.instanceId, async (client) => {
          const accountId = await resolveActorAccountId(client, {
            instanceId: scoped.instanceId,
            keycloakSubject: ctx.user.id,
          });
          if (!accountId) {
            return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', getWorkspaceContext().requestId);
          }

          const overview = await loadMyDeletionRulesOverview(client, {
            instanceId: scoped.instanceId,
            accountId,
          });

          if (!overview.rules.allowContentPreferenceOverride) {
            return createApiError(
              403,
              'forbidden',
              'Die Überschreibung der Inhaltsregel ist für diesen Tenant deaktiviert.',
              getWorkspaceContext().requestId
            );
          }

          await saveAccountContentPreference(client, {
            instanceId: scoped.instanceId,
            accountId,
            strategy: parsed.data.strategy,
          });

          return jsonResponse(
            200,
            await loadMyDeletionRulesOverview(client, {
              instanceId: scoped.instanceId,
              accountId,
            })
          );
        });
      } catch (error) {
        logger.error('My deletion rules preference update failed', {
          instance_id: scoped.instanceId,
          error: error instanceof Error ? error.message : String(error),
          request_id: getWorkspaceContext().requestId,
          trace_id: getWorkspaceContext().traceId,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Die Inhaltspräferenz konnte nicht gespeichert werden.',
          getWorkspaceContext().requestId
        );
      }
    })
  );

export const deletionRulesAdminHandler = async (request: Request): Promise<Response> => {
  if (request.method === 'GET') {
    return loadAdminDeletionRulesResponse(request);
  }

  if (request.method === 'POST') {
    return saveAdminDeletionRulesResponse(request);
  }

  return textResponse(405, 'Method Not Allowed', 'text/plain; charset=utf-8');
};

export const myDeletionRulesOverviewHandler = async (request: Request): Promise<Response> =>
  loadMyDeletionRulesResponse(request);

export const myDeletionRulesPreferenceHandler = async (request: Request): Promise<Response> =>
  saveMyDeletionRulesPreferenceResponse(request);
