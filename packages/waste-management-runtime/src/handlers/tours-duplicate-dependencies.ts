import type { WasteManagementHandlerDeps } from './types.js';
import { requireDeps } from './utils.js';

type TourSourceRecords = {
  readonly sourceLinks: Awaited<
    ReturnType<NonNullable<WasteManagementHandlerDeps['listWasteLocationTourLinksByTourId']>>
  >;
  readonly sourcePickupDates: Awaited<
    ReturnType<NonNullable<WasteManagementHandlerDeps['listWasteLocationTourPickupDates']>>
  >;
  readonly sourceTourAssignments: Awaited<
    ReturnType<NonNullable<WasteManagementHandlerDeps['listWasteTourAssignments']>>
  >;
  readonly sourceShifts: Awaited<
    ReturnType<NonNullable<WasteManagementHandlerDeps['listWasteTourDateShiftsByTourId']>>
  >;
};

const copyWasteTourDependencies = async ({
  deps,
  instanceId,
  targetTourId,
  saveLink,
  sourceLinks,
  sourcePickupDates,
  sourceTourAssignments,
  sourceShifts,
}: TourSourceRecords & {
  readonly deps: WasteManagementHandlerDeps;
  readonly instanceId: string;
  readonly targetTourId: string;
  readonly saveLink: NonNullable<WasteManagementHandlerDeps['saveWasteLocationTourLink']>;
}): Promise<void> => {
  for (const sourceLink of sourceLinks) {
    await saveLink(instanceId, {
      id: crypto.randomUUID(),
      locationId: sourceLink.locationId,
      tourId: targetTourId,
    });
  }

  if (sourcePickupDates.length > 0) {
    const savePickupDate = requireDeps(
      deps.saveWasteLocationTourPickupDate,
      'saveWasteLocationTourPickupDate'
    );
    for (const sourcePickupDate of sourcePickupDates) {
      await savePickupDate(instanceId, {
        id: crypto.randomUUID(),
        locationId: sourcePickupDate.locationId,
        tourId: targetTourId,
        pickupDate: sourcePickupDate.pickupDate,
        note: sourcePickupDate.note,
      });
    }
  }

  if (sourceTourAssignments.length > 0) {
    const saveTourAssignment = requireDeps(deps.saveWasteTourAssignment, 'saveWasteTourAssignment');
    for (const sourceTourAssignment of sourceTourAssignments) {
      await saveTourAssignment(instanceId, {
        id: crypto.randomUUID(),
        tourId: targetTourId,
        pickupDate: sourceTourAssignment.pickupDate,
        note: sourceTourAssignment.note,
        locationIds: [...sourceTourAssignment.locationIds],
      });
    }
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
};

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
  const listLinks = requireDeps(
    deps.listWasteLocationTourLinksByTourId,
    'listWasteLocationTourLinksByTourId'
  );
  const listShifts = requireDeps(
    deps.listWasteTourDateShiftsByTourId,
    'listWasteTourDateShiftsByTourId'
  );
  const listPickupDates = requireDeps(
    deps.listWasteLocationTourPickupDates,
    'listWasteLocationTourPickupDates'
  );
  const listTourAssignments = requireDeps(
    deps.listWasteTourAssignments,
    'listWasteTourAssignments'
  );
  const saveLink = requireDeps(deps.saveWasteLocationTourLink, 'saveWasteLocationTourLink');
  const deleteTour = requireDeps(deps.deleteWasteTour, 'deleteWasteTour');

  try {
    const [sourceLinks, sourcePickupDates, sourceTourAssignments, sourceShifts] = await Promise.all(
      [
        listLinks(instanceId, sourceTourId),
        listPickupDates(instanceId, { tourId: sourceTourId }),
        listTourAssignments(instanceId, { tourId: sourceTourId }),
        listShifts(instanceId, sourceTourId),
      ]
    );

    await copyWasteTourDependencies({
      deps,
      instanceId,
      targetTourId,
      saveLink,
      sourceLinks,
      sourcePickupDates,
      sourceTourAssignments,
      sourceShifts,
    });
  } catch (error) {
    await deleteTour(instanceId, targetTourId);
    throw error;
  }
};
