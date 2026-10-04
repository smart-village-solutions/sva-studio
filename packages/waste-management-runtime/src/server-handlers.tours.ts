import type { WasteServerHandlerDeps } from './server-handler-deps.js';
export const createWasteTourHandlers = (deps: WasteServerHandlerDeps) => {
  const {
    bindWasteAuditActor,
    createWasteManagementTourAssignmentInternal,
    createWasteManagementTourInternal,
    deleteWasteManagementTourAssignmentInternal,
    deleteWasteTour,
    deleteWasteTourAssignment,
    listWasteLocationTourLinksByTourId,
    listWasteLocationTourPickupDates,
    listWasteTourAssignments,
    listWasteTourDateShiftsByTourId,
    loadWasteTourAssignmentById,
    loadWasteTourById,
    saveWasteLocationTourLink,
    saveWasteLocationTourPickupDate,
    saveWasteTour,
    saveWasteTourAssignment,
    saveWasteTourDateShift,
    updateWasteManagementTourAssignmentInternal,
    updateWasteManagementTourInternal,
    withAuthenticatedWasteManagementHandler,
  } = deps;
  return {
    createTourAssignment: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementTourAssignmentInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteTourAssignment,
          loadWasteTourAssignmentById,
        })
      ),
    updateTourAssignment: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementTourAssignmentInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteTourAssignment,
          loadWasteTourAssignmentById,
        })
      ),
    deleteTourAssignment: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementTourAssignmentInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteTourAssignment,
          loadWasteTourAssignmentById,
        })
      ),
    createTour: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementTourInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteTour,
          loadWasteTourById,
          listWasteLocationTourLinksByTourId,
          saveWasteLocationTourLink,
          listWasteLocationTourPickupDates,
          saveWasteLocationTourPickupDate,
          listWasteTourAssignments,
          saveWasteTourAssignment,
          listWasteTourDateShiftsByTourId,
          saveWasteTourDateShift,
          deleteWasteTour,
        })
      ),
    updateTour: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementTourInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteTour,
          loadWasteTourById,
        })
      ),
  };
};
export const createWasteTourBulkHandlers = (deps: WasteServerHandlerDeps) => {
  const {
    bindWasteAuditActor,
    deleteWasteLocationTourLink,
    deleteWasteLocationTourPickupDate,
    deleteWasteManagementTourInternal,
    deleteWasteTour,
    deleteWasteTourDateShift,
    listWasteLocationTourLinksByTourId,
    listWasteLocationTourPickupDates,
    listWasteTourDateShiftsByTourId,
    loadWasteTourById,
    updateWasteManagementTourStatusBulkInternal,
    updateWasteManagementTourValidityBulkInternal,
    updateWasteTourStatusBulk,
    updateWasteTourValidityBulk,
    withAuthenticatedWasteManagementHandler,
  } = deps;
  return {
    updateTourValidityBulk: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementTourValidityBulkInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          updateWasteTourValidityBulk,
        })
      ),
    updateTourStatusBulk: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementTourStatusBulkInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          updateWasteTourStatusBulk,
        })
      ),
    deleteTour: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementTourInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteTour,
          listWasteLocationTourLinksByTourId,
          deleteWasteLocationTourLink,
          listWasteLocationTourPickupDates,
          deleteWasteLocationTourPickupDate,
          listWasteTourDateShiftsByTourId,
          deleteWasteTourDateShift,
          loadWasteTourById,
        })
      ),
  };
};
export const createWasteTourDateShiftHandlers = (deps: WasteServerHandlerDeps) => {
  const {
    bindWasteAuditActor,
    createWasteManagementTourDateShiftInternal,
    createWasteTourDateShift,
    deleteWasteManagementTourDateShiftInternal,
    deleteWasteTourDateShift,
    loadWasteTourDateShiftById,
    saveWasteTourDateShift,
    updateWasteManagementTourDateShiftInternal,
    withAuthenticatedWasteManagementHandler,
  } = deps;
  return {
    createTourDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementTourDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          createWasteTourDateShift,
          loadWasteTourDateShiftById,
        })
      ),
    deleteTourDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementTourDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteTourDateShift,
          loadWasteTourDateShiftById,
        })
      ),
    updateTourDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementTourDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteTourDateShift,
          loadWasteTourDateShiftById,
        })
      ),
  };
};
export const createWasteGlobalDateShiftHandlers = (deps: WasteServerHandlerDeps) => {
  const {
    bindWasteAuditActor,
    createWasteManagementGlobalDateShiftInternal,
    deleteWasteGlobalDateShift,
    deleteWasteHolidayRule,
    deleteWasteManagementGlobalDateShiftInternal,
    deleteWasteManagementHolidayRuleInternal,
    loadWasteGlobalDateShiftById,
    loadWasteHolidayRuleById,
    saveWasteGlobalDateShift,
    saveWasteHolidayRule,
    updateWasteManagementGlobalDateShiftInternal,
    updateWasteManagementHolidayRuleInternal,
    withAuthenticatedWasteManagementHandler,
  } = deps;
  return {
    createGlobalDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        createWasteManagementGlobalDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteGlobalDateShift,
          loadWasteGlobalDateShiftById,
        })
      ),
    deleteGlobalDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementGlobalDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteGlobalDateShift,
          loadWasteGlobalDateShiftById,
        })
      ),
    updateGlobalDateShift: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementGlobalDateShiftInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteGlobalDateShift,
          loadWasteGlobalDateShiftById,
        })
      ),
    deleteHolidayRule: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        deleteWasteManagementHolidayRuleInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          deleteWasteHolidayRule,
          loadWasteHolidayRuleById,
        })
      ),
    updateHolidayRule: (request: Request): Promise<Response> =>
      withAuthenticatedWasteManagementHandler(request, (nextRequest, ctx) =>
        updateWasteManagementHolidayRuleInternal(nextRequest, ctx, {
          ...bindWasteAuditActor(ctx),
          saveWasteHolidayRule,
          loadWasteHolidayRuleById,
        })
      ),
  };
};
