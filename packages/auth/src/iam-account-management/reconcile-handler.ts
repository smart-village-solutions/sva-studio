import { getWorkspaceContext } from '@sva/server-runtime';
import { createReconcileHandlerInternal } from '@sva/iam-admin';

import type { AuthenticatedRequestContext } from '../middleware.server.js';
import { jsonResponse } from '../shared/db-helpers.js';

import { SYSTEM_ADMIN_ROLES } from './constants.js';
import { asApiItem, createApiError } from './api-helpers.js';
import { ensureFeature, getFeatureFlags } from './feature-flags.js';
import { consumeRateLimit } from './rate-limit.js';
import { reconcilePlatformRolesInternal } from './platform-iam-handlers.js';
import { runRoleCatalogReconciliation } from './reconcile-core.js';
import { logger, requireRoles, resolveActorInfo } from './shared.js';
import { validateCsrf } from './csrf.js';
import { mapRoleSyncErrorCode, sanitizeRoleErrorMessage } from './role-audit.js';

export const reconcilePlaceholderInternal = createReconcileHandlerInternal({
  asApiItem,
  consumeRateLimit,
  createApiError,
  ensureIamAdminFeature: (requestId) => ensureFeature(getFeatureFlags(), 'iam_admin', requestId),
  getRequestContext: getWorkspaceContext,
  jsonResponse,
  logger,
  mapRoleSyncErrorCode,
  reconcilePlatformRoles: reconcilePlatformRolesInternal,
  requireSystemAdminRole: (ctx, requestId) => requireRoles(ctx, SYSTEM_ADMIN_ROLES, requestId),
  resolveActorInfo,
  runRoleCatalogReconciliation,
  sanitizeRoleErrorMessage,
  validateCsrf,
});

let roleCatalogSchedulerStarted = false;
const roleCatalogSchedulerInFlight = new Set<string>();

export const readScheduledReconcileInstanceIds = (): readonly string[] =>
  (process.env.IAM_ROLE_RECONCILE_INSTANCE_IDS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const ensureRoleCatalogSchedulerStarted = (): void => {
  if (roleCatalogSchedulerStarted) {
    return;
  }

  const intervalRaw = process.env.IAM_ROLE_RECONCILE_INTERVAL_MS;
  const intervalMs = intervalRaw ? Number(intervalRaw) : Number.NaN;
  const instanceIds = readScheduledReconcileInstanceIds();
  if (!Number.isFinite(intervalMs) || intervalMs <= 0 || instanceIds.length === 0) {
    return;
  }

  roleCatalogSchedulerStarted = true;
  const timer = setInterval(async () => {
    for (const instanceId of instanceIds) {
      if (roleCatalogSchedulerInFlight.has(instanceId)) {
        logger.warn('Role catalog reconciliation already running; skipping overlapping scheduler run', {
          operation: 'reconcile_roles_scheduler',
          workspace_id: instanceId,
          instance_id: instanceId,
          result: 'skipped',
          error_code: 'SCHEDULER_ALREADY_RUNNING',
          request_id: `scheduler:${Date.now()}:${instanceId}`,
        });
        continue;
      }

      roleCatalogSchedulerInFlight.add(instanceId);
      const schedulerRequestId = `scheduler:${Date.now()}:${instanceId}`;
      try {
        const report = await runRoleCatalogReconciliation({
          instanceId,
          requestId: schedulerRequestId,
        });
        logger.info('Role catalog reconciliation completed', {
          operation: 'reconcile_roles_scheduler',
          workspace_id: instanceId,
          instance_id: instanceId,
          result: 'success',
          request_id: schedulerRequestId,
          checked_count: report.checkedCount,
          corrected_count: report.correctedCount,
          failed_count: report.failedCount,
          requires_manual_action_count: report.requiresManualActionCount,
        });
      } catch (error) {
        logger.error('Role catalog reconciliation scheduler failed', {
          operation: 'reconcile_roles_scheduler',
          workspace_id: instanceId,
          instance_id: instanceId,
          result: 'failure',
          request_id: schedulerRequestId,
          error: sanitizeRoleErrorMessage(error),
        });
      } finally {
        roleCatalogSchedulerInFlight.delete(instanceId);
      }
    }
  }, intervalMs);

  timer.unref?.();
};

ensureRoleCatalogSchedulerStarted();
