import { asApiItem, createApiError, createSdkLogger } from '@sva/server-runtime';

import { emitWasteAuditEvent } from './auth.js';
import { buildLogContext } from './log-context.js';
import { updateWasteVisibleStatus } from './settings-shared.js';
import { duplicateWasteTourDependencies } from './tours-duplicate-dependencies.js';
import type { AuthenticatedRequestContext, WasteManagementHandlerDeps } from './types.js';
import { normalizeCustomTourDates, normalizeOptionalString, requireDeps } from './utils.js';

export { duplicateWasteTourDependencies } from './tours-duplicate-dependencies.js';

type SaveWasteTourInput = Parameters<NonNullable<WasteManagementHandlerDeps['saveWasteTour']>>[1];

const logger = createSdkLogger({ component: 'waste-management-auth-runtime', level: 'info' });

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
  status,
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
  readonly status: SaveWasteTourInput['status'];
  readonly locationCount: number | undefined;
}): SaveWasteTourInput => ({
  id,
  name: name.trim(),
  description: normalizeOptionalString(description),
  wasteFractionIds: wasteFractionIds.map((value) => value.trim()),
  recurrence: customRecurrenceId ? null : (recurrence ?? undefined),
  customRecurrenceId,
  firstDate,
  endDate,
  customDates: normalizeCustomTourDates(customDates),
  status,
  locationCount,
});

export const deleteWasteTourDependencies = async ({
  deps,
  instanceId,
  tourId,
}: {
  readonly deps: WasteManagementHandlerDeps;
  readonly instanceId: string;
  readonly tourId: string;
}): Promise<void> => {
  const listLinks = requireDeps(
    deps.listWasteLocationTourLinksByTourId,
    'listWasteLocationTourLinksByTourId'
  );
  const listPickupDates = requireDeps(
    deps.listWasteLocationTourPickupDates,
    'listWasteLocationTourPickupDates'
  );
  const listShifts = requireDeps(
    deps.listWasteTourDateShiftsByTourId,
    'listWasteTourDateShiftsByTourId'
  );
  const deleteLink = requireDeps(deps.deleteWasteLocationTourLink, 'deleteWasteLocationTourLink');
  const deletePickupDate = requireDeps(
    deps.deleteWasteLocationTourPickupDate,
    'deleteWasteLocationTourPickupDate'
  );
  const deleteShift = requireDeps(deps.deleteWasteTourDateShift, 'deleteWasteTourDateShift');

  const [links, pickupDates, shifts] = await Promise.all([
    listLinks(instanceId, tourId),
    listPickupDates(instanceId, { tourId }),
    listShifts(instanceId, tourId),
  ]);

  logger.info('waste_tour_delete_dependencies_loaded', {
    operation: 'delete_waste_tour',
    tour_id: tourId,
    links_count: links.length,
    pickup_dates_count: pickupDates.length,
    shifts_count: shifts.length,
    link_ids: links.map((link) => link.id),
    pickup_date_ids: pickupDates.map((pickupDate) => pickupDate.id),
    shift_ids: shifts.map((shift) => shift.id),
    ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
  });

  await Promise.all([
    ...links.map(async (link) => await deleteLink(instanceId, link.id)),
    ...pickupDates.map(async (pickupDate) => await deletePickupDate(instanceId, pickupDate.id)),
    ...shifts.map(async (shift) => await deleteShift(instanceId, shift.id)),
  ]);

  logger.info('waste_tour_delete_dependencies_completed', {
    operation: 'delete_waste_tour',
    tour_id: tourId,
    deleted_links_count: links.length,
    deleted_pickup_dates_count: pickupDates.length,
    deleted_shifts_count: shifts.length,
    ...buildLogContext({ kind: 'instance', instanceId }, { includeTraceId: true }),
  });
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
  await requireDeps(deps.saveWasteTour, 'saveWasteTour')(
    instanceId,
    createWasteTourWriteInput(input)
  );

  if (input.duplicateFromTourId) {
    await duplicateWasteTourDependencies({
      deps,
      instanceId,
      sourceTourId: input.duplicateFromTourId,
      targetTourId: input.id,
    });
  }

  const saved = await requireDeps(deps.loadWasteTourById, 'loadWasteTourById')(
    instanceId,
    input.id
  );
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
    return createApiError(
      503,
      'database_unavailable',
      'Die Waste-Tour konnte nicht verifiziert werden.',
      requestId
    );
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
