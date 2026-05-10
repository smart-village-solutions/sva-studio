import { type WasteManagementDataSourceRecord } from '@sva/core';
import { resolveWasteDataSource, runWasteConnectionCheck } from '@sva/server-runtime';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementSettingsSchema } from './schemas.js';
import { buildSettingsRecord, defaultRunConnectionProbe, sanitizeWasteSettings } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const toUpdatedSettingsRecord = (
  record: WasteManagementDataSourceRecord,
  connectionCheck: {
    visibleStatus: WasteManagementDataSourceRecord['visibleStatus'];
    checkedAt: string;
    checkStatus: WasteManagementDataSourceRecord['lastCheckStatus'];
    errorCode?: string;
    errorMessage?: string;
  }
) =>
  ({
    ...record,
    visibleStatus: connectionCheck.visibleStatus,
    lastCheckedAt: connectionCheck.checkedAt,
    lastCheckStatus: connectionCheck.checkStatus,
    lastCheckErrorCode: connectionCheck.errorCode,
    lastCheckErrorMessage: connectionCheck.errorMessage,
  }) satisfies WasteManagementDataSourceRecord;

export const wasteManagementSettingsHandlers = {
  updateWasteManagementSettingsInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.settings.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, wasteManagementSettingsSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const record = await buildSettingsRecord(deps, instanceId, parsed.data);
      await requireDeps(deps.saveWasteDataSourceRecord, 'saveWasteDataSourceRecord')(record);

      const connectionCheck = await runWasteConnectionCheck({
        dataSource: await resolveWasteDataSource({
          instanceId,
          loadRecord: async () => record,
          revealSecret: (ciphertext, aad) => requireDeps(deps.revealSecret, 'revealSecret')(ciphertext, aad) ?? undefined,
        }),
        probe: deps.runConnectionProbe ?? defaultRunConnectionProbe,
        now: () => new Date(),
      });

      await requireDeps(deps.saveWasteConnectionCheck, 'saveWasteConnectionCheck')(connectionCheck);

      const updatedRecord = toUpdatedSettingsRecord(record, connectionCheck);

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.datasource.reconfigured',
        result: 'success',
        resourceType: 'waste_data_source',
        resourceId: instanceId,
      });
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: `waste-management.connection-check.${connectionCheck.checkStatus}`,
        result: connectionCheck.checkStatus === 'succeeded' ? 'success' : 'failure',
        reasonCode: connectionCheck.errorCode,
        resourceType: 'waste_data_source',
        resourceId: instanceId,
      });
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.settings.updated',
        result: 'success',
        resourceType: 'waste_data_source',
        resourceId: instanceId,
      });

      return new Response(JSON.stringify(asApiItem(sanitizeWasteSettings(updatedRecord), requestId)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.settings.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_data_source',
        resourceId: instanceId,
      });
      return createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht gespeichert werden.', requestId);
    }
  },
};
