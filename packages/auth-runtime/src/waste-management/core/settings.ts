import type { AuthenticatedRequestContext } from '../../middleware.js';
import { validateCsrf } from '../../shared/request-security.js';
import { asApiItem, createApiError, parseRequestBody } from '../../shared/request-helpers.js';
import { authorizeWasteManagementAction, emitWasteAuditEvent } from './auth.js';
import { wasteManagementSettingsSchemas } from './schemas.js';
import { loadConfiguredWasteSettings, updateWasteVisibleStatus } from './settings-shared.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const { updateWasteSettingsSchema } = wasteManagementSettingsSchemas;

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

    const parsed = await parseRequestBody(request, updateWasteSettingsSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    try {
      const current = await loadConfiguredWasteSettings(deps, instanceId);
      const interfaceRecord = await requireDeps(deps.loadDefaultInterfaceRecord, 'loadDefaultInterfaceRecord')(instanceId, 'supabase');
      if (!current || !interfaceRecord) {
        return createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht geladen werden.', requestId);
      }
      const currentSchemaName = current?.schemaName ?? 'public';
      const nextSchemaName = parsed.data.schemaName?.trim() || 'public';

      if (
        current?.projectUrl !== parsed.data.projectUrl ||
        currentSchemaName !== nextSchemaName ||
        current?.enabled !== parsed.data.enabled
      ) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.settings.updated',
          result: 'failure',
          reasonCode: 'managed_via_interfaces',
          resourceType: 'waste_data_source',
          resourceId: instanceId,
        });
        return createApiError(
          409,
          'invalid_request',
          'Die Waste-Supabase wird ausschließlich über /interfaces verwaltet.',
          requestId
        );
      }

      let lastHolidaySyncStatus = current.lastHolidaySyncStatus;
      if (parsed.data.holidayStateCode) {
        try {
          lastHolidaySyncStatus = await requireDeps(deps.syncWasteHolidayRules, 'syncWasteHolidayRules')(
            instanceId,
            parsed.data.holidayStateCode
          );
        } catch {
          lastHolidaySyncStatus = 'failed';
        }
      } else {
        lastHolidaySyncStatus = undefined;
      }

      const nextPublicConfig: Record<string, unknown> = {
        ...interfaceRecord.publicConfig,
        holidayStateCode: parsed.data.holidayStateCode,
      };
      if (lastHolidaySyncStatus) {
        nextPublicConfig.lastHolidaySyncStatus = lastHolidaySyncStatus;
      } else {
        delete nextPublicConfig.lastHolidaySyncStatus;
      }

      await requireDeps(deps.saveExternalInterfaceRecord, 'saveExternalInterfaceRecord')({
        ...interfaceRecord,
        publicConfig: nextPublicConfig,
      });

      await requireDeps(deps.saveWasteCustomRecurrencePresets, 'saveWasteCustomRecurrencePresets')(instanceId, {
        nextItems: parsed.data.customRecurrencePresets,
        deletedPresetFallbacks: parsed.data.deletedPresetFallbacks,
      });

      const saved = await loadConfiguredWasteSettings(deps, instanceId);
      if (!saved) {
        await emitWasteAuditEvent({
          deps,
          ctx,
          instanceId,
          actionId: 'waste-management.settings.updated',
          result: 'failure',
          reasonCode: 'verification_failed',
          resourceType: 'waste_data_source',
          resourceId: instanceId,
        });
        return createApiError(
          503,
          'database_unavailable',
          'Die Waste-Einstellungen konnten nicht verifiziert werden.',
          requestId
        );
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.settings.updated',
        result: 'success',
        resourceType: 'waste_data_source',
        resourceId: instanceId,
      });
      await updateWasteVisibleStatus(deps, instanceId, 'success');

      const responseSettings = {
        ...saved,
        holidayStateCode: parsed.data.holidayStateCode,
        lastHolidaySyncStatus,
      };

      return new Response(JSON.stringify(asApiItem(responseSettings, requestId)), {
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
      await updateWasteVisibleStatus(deps, instanceId, 'revalidate');
      return createApiError(
        503,
        'database_unavailable',
        'Die Waste-Einstellungen konnten nicht gespeichert werden.',
        requestId
      );
    }
  },
  runWasteManagementHolidaySyncInternal: async (
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

    try {
      const current = await loadConfiguredWasteSettings(deps, instanceId);
      const interfaceRecord = await requireDeps(deps.loadDefaultInterfaceRecord, 'loadDefaultInterfaceRecord')(instanceId, 'supabase');
      if (!current || !interfaceRecord) {
        return createApiError(503, 'database_unavailable', 'Die Waste-Einstellungen konnten nicht geladen werden.', requestId);
      }
      if (!current.holidayStateCode) {
        return createApiError(
          400,
          'invalid_request',
          'Für den Feiertagssync muss zuerst ein Bundesland in den Waste-Einstellungen gespeichert werden.',
          requestId
        );
      }

      let lastHolidaySyncStatus: NonNullable<typeof current.lastHolidaySyncStatus>;
      try {
        lastHolidaySyncStatus = await requireDeps(deps.syncWasteHolidayRules, 'syncWasteHolidayRules')(
          instanceId,
          current.holidayStateCode
        );
      } catch {
        lastHolidaySyncStatus = 'failed';
      }

      await requireDeps(deps.saveExternalInterfaceRecord, 'saveExternalInterfaceRecord')({
        ...interfaceRecord,
        publicConfig: {
          ...interfaceRecord.publicConfig,
          holidayStateCode: current.holidayStateCode,
          lastHolidaySyncStatus,
        },
      });

      const saved = await loadConfiguredWasteSettings(deps, instanceId);
      if (!saved) {
        return createApiError(
          503,
          'database_unavailable',
          'Die Waste-Einstellungen konnten nicht verifiziert werden.',
          requestId
        );
      }

      await emitWasteAuditEvent({
        deps,
        ctx,
        instanceId,
        actionId: 'waste-management.settings.holiday-sync.triggered',
        result: 'success',
        resourceType: 'waste_data_source',
        resourceId: instanceId,
      });

      return new Response(
        JSON.stringify(
          asApiItem(
            {
              ...saved,
              holidayStateCode: current.holidayStateCode,
              lastHolidaySyncStatus,
            },
            requestId
          )
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('missing_dependency:')) {
        throw error;
      }
      return createApiError(
        503,
        'database_unavailable',
        'Der Waste-Feiertagssync konnte nicht ausgeführt werden.',
        requestId
      );
    }
  },
};
