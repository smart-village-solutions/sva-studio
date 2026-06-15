import type { WasteHolidayRuleRecord } from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { createApiError, parseRequestBody, readPathSegment } from '../../shared/request-helpers.js';
import { validateCsrf } from '../../shared/request-security.js';
import { authorizeWasteManagementAction } from './auth.js';
import { deriveHolidayRuleConfigurationStatus } from './holiday-sync.js';
import { runWasteDeleteMutation, runWasteUpdateMutation } from './mutation-helpers.js';
import { wasteManagementTourSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';
import { getRequestId, requireActorInstanceId, requireDeps } from './utils.js';

const { updateWasteHolidayRuleSchema } = wasteManagementTourSchemas;

const mergeHolidayRule = (
  rule: WasteHolidayRuleRecord,
  data: {
    readonly scope?: WasteHolidayRuleRecord['scope'];
    readonly strategy?: WasteHolidayRuleRecord['strategy'];
  }
): Omit<WasteHolidayRuleRecord, 'createdAt' | 'updatedAt'> => ({
  id: rule.id,
  holidayDate: rule.holidayDate,
  holidayName: rule.holidayName,
  year: rule.year,
  stateCode: rule.stateCode,
  sourceStatus: rule.sourceStatus,
  configurationStatus: deriveHolidayRuleConfigurationStatus({
    scope: data.scope,
    strategy: data.strategy,
  }),
  conflictStatus: rule.conflictStatus,
  scope: data.scope,
  strategy: data.strategy,
});

export const wasteManagementHolidayRuleHandlers = {
  updateWasteManagementHolidayRuleInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const ruleId = readPathSegment(request, 4)?.trim();
    if (!ruleId) {
      return createApiError(400, 'invalid_request', 'holidayRuleId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    const parsed = await parseRequestBody(request, updateWasteHolidayRuleSchema);
    if (!parsed.ok) {
      return createApiError(400, 'invalid_request', parsed.message, requestId);
    }

    const loadWasteHolidayRuleById = requireDeps(deps.loadWasteHolidayRuleById, 'loadWasteHolidayRuleById');
    const saveWasteHolidayRule = requireDeps(deps.saveWasteHolidayRule, 'saveWasteHolidayRule');
    let loadedRule: WasteHolidayRuleRecord | null = null;

    return runWasteUpdateMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: ruleId,
      audit: {
        actionId: 'waste-management.holiday-rule.updated',
        resourceType: 'waste_holiday_rule',
      },
      messages: {
        notFound: 'Der Feiertags-Regelentwurf wurde nicht gefunden.',
        verificationFailed: 'Der Feiertags-Regelentwurf konnte nicht verifiziert werden.',
        persistenceFailed: 'Der Feiertags-Regelentwurf konnte nicht gespeichert werden.',
      },
      loadExisting: async () => {
        loadedRule = await loadWasteHolidayRuleById(instanceId, ruleId);
        return loadedRule;
      },
      save: async () => {
        if (!loadedRule) {
          throw new Error('holiday_rule_missing_during_save');
        }
        await saveWasteHolidayRule(instanceId, mergeHolidayRule(loadedRule, parsed.data));
      },
      loadSaved: () => loadWasteHolidayRuleById(instanceId, ruleId),
    });
  },
  deleteWasteManagementHolidayRuleInternal: async (
    request: Request,
    ctx: AuthenticatedRequestContext,
    deps: WasteManagementHandlerDeps = {}
  ): Promise<Response> => {
    const requestId = getRequestId(deps);
    const authError = await authorizeWasteManagementAction(ctx, 'waste-management.scheduling.manage', deps, requestId);
    if (authError) {
      return authError;
    }

    const instanceId = requireActorInstanceId(ctx, requestId);
    if (instanceId instanceof Response) {
      return instanceId;
    }

    const ruleId = readPathSegment(request, 4)?.trim();
    if (!ruleId) {
      return createApiError(400, 'invalid_request', 'holidayRuleId fehlt im Pfad.', requestId);
    }

    const csrfError = validateCsrf(request, requestId);
    if (csrfError) {
      return csrfError;
    }

    return runWasteDeleteMutation({
      deps,
      ctx,
      instanceId,
      requestId,
      resourceId: ruleId,
      audit: {
        actionId: 'waste-management.holiday-rule.deleted',
        resourceType: 'waste_holiday_rule',
      },
      messages: {
        notFound: 'Der Feiertags-Regelentwurf wurde nicht gefunden.',
        deleteFailed: 'Der Feiertags-Regelentwurf konnte nicht gelöscht werden.',
      },
      loadExisting: () => requireDeps(deps.loadWasteHolidayRuleById, 'loadWasteHolidayRuleById')(instanceId, ruleId),
      remove: () => requireDeps(deps.deleteWasteHolidayRule, 'deleteWasteHolidayRule')(instanceId, ruleId),
    });
  },
};
