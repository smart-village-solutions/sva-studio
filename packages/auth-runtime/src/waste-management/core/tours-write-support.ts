import { asApiItem, createApiError } from '../../shared/request-helpers.js';
import type { AuthenticatedRequestContext } from '../../middleware.js';
import { emitWasteAuditEvent } from './auth.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import { normalizeCustomTourDates, normalizeOptionalString, requireDeps } from './utils.js';
import type { WasteManagementHandlerDeps } from './types.js';

type SaveWasteTourInput = Parameters<NonNullable<WasteManagementHandlerDeps['saveWasteTour']>>[1];

export const createWasteTourWriteInput = ({
  id,
  name,
  description,
  wasteFractionIds,
  recurrence,
  customRecurrenceId,
  firstDate,
  endDate,
  customDates,
  active,
  locationCount,
}: {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly wasteFractionIds: readonly string[];
  readonly recurrence?: SaveWasteTourInput['recurrence'];
  readonly customRecurrenceId?: string;
  readonly firstDate?: string;
  readonly endDate?: string;
  readonly customDates?: Parameters<typeof normalizeCustomTourDates>[0];
  readonly active: boolean;
  readonly locationCount: number | undefined;
}): SaveWasteTourInput => ({
  id,
  name: name.trim(),
  description: normalizeOptionalString(description),
  wasteFractionIds: wasteFractionIds.map((value) => value.trim()),
  recurrence: customRecurrenceId ? null : recurrence ?? undefined,
  customRecurrenceId,
  firstDate,
  endDate,
  customDates: normalizeCustomTourDates(customDates),
  active,
  locationCount,
});

export const duplicateWasteTourDependencies = async ({
  deps,
  instanceId,
  sourceTourId,
  targetTourId,
}: {
  readonly deps: WasteManagementHandlerDeps;
  readonly instanceId: string;
  readonly sourceTourId: string;
  readonly targetTourId: string;
}): Promise<void> => {
  const listLinks = requireDeps(deps.listWasteLocationTourLinksByTourId, 'listWasteLocationTourLinksByTourId');
  const listShifts = requireDeps(deps.listWasteTourDateShiftsByTourId, 'listWasteTourDateShiftsByTourId');
  const saveLink = requireDeps(deps.saveWasteLocationTourLink, 'saveWasteLocationTourLink');
  const deleteTour = requireDeps(deps.deleteWasteTour, 'deleteWasteTour');

  try {
    const [sourceLinks, sourceShifts] = await Promise.all([
      listLinks(instanceId, sourceTourId),
      listShifts(instanceId, sourceTourId),
    ]);

    for (const sourceLink of sourceLinks) {
      await saveLink(instanceId, {
        id: crypto.randomUUID(),
        locationId: sourceLink.locationId,
        tourId: targetTourId,
        startDate: sourceLink.startDate,
        endDate: sourceLink.endDate,
      });
    }

    if (sourceShifts.length > 0) {
      const saveShift = requireDeps(deps.saveWasteTourDateShift, 'saveWasteTourDateShift');
      for (const sourceShift of sourceShifts) {
        await saveShift(instanceId, {
          id: crypto.randomUUID(),
          tourId: targetTourId,
          originalDate: sourceShift.originalDate,
          actualDate: sourceShift.actualDate,
          hasYear: sourceShift.hasYear,
          reasonType: sourceShift.reasonType,
          reasonKey: sourceShift.reasonKey,
          followUpMode: sourceShift.followUpMode,
          description: sourceShift.description,
        });
      }
    }
  } catch (error) {
    await deleteTour(instanceId, targetTourId);
    throw error;
  }
};

export const createWasteManagementTourAfterValidation = async ({
  deps,
  ctx,
  instanceId,
  requestId,
  input,
}: {
  readonly deps: WasteManagementHandlerDeps;
  readonly ctx: AuthenticatedRequestContext;
  readonly instanceId: string;
  readonly requestId: string | undefined;
  readonly input: Parameters<typeof createWasteTourWriteInput>[0] & {
    readonly duplicateFromTourId?: string;
  };
}): Promise<Response> => {
  await requireDeps(deps.saveWasteTour, 'saveWasteTour')(instanceId, createWasteTourWriteInput(input));

  if (input.duplicateFromTourId) {
    await duplicateWasteTourDependencies({
      deps,
      instanceId,
      sourceTourId: input.duplicateFromTourId,
      targetTourId: input.id,
    });
  }

  const saved = await requireDeps(deps.loadWasteTourById, 'loadWasteTourById')(instanceId, input.id);
  if (!saved) {
    await emitWasteAuditEvent({
      deps,
      ctx,
      instanceId,
      actionId: 'waste-management.tour.created',
      result: 'failure',
      reasonCode: 'verification_failed',
      resourceType: 'waste_tour',
      resourceId: input.id,
    });
    return createApiError(503, 'database_unavailable', 'Die Waste-Tour konnte nicht verifiziert werden.', requestId);
  }

  await emitWasteAuditEvent({
    deps,
    ctx,
    instanceId,
    actionId: 'waste-management.tour.created',
    result: 'success',
    resourceType: 'waste_tour',
    resourceId: saved.id,
  });
  await updateWasteVisibleStatus(deps, instanceId, 'success');

  return new Response(JSON.stringify(asApiItem(saved, requestId)), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
