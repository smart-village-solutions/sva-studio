import { appendWasteManagementDebugLog } from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

type WasteTourDebugTarget = {
  readonly id: string;
  readonly name?: string;
};

export const logWasteTourDeleteStart = (tour: WasteTourDebugTarget) => {
  appendWasteManagementDebugLog({
    scope: 'tour-delete',
    phase: 'start',
    tourId: tour.id,
    tourName: tour.name,
  });
};

export const logWasteTourDeleteSuccess = (tour: WasteTourDebugTarget) => {
  appendWasteManagementDebugLog({
    scope: 'tour-delete',
    phase: 'success',
    tourId: tour.id,
    tourName: tour.name,
  });
};

export const logWasteTourDeleteError = (tour: WasteTourDebugTarget, error: unknown) => {
  appendWasteManagementDebugLog({
    scope: 'tour-delete',
    phase: 'error',
    tourId: tour.id,
    tourName: tour.name,
    errorCode: resolveApiErrorCode(error) ?? undefined,
    errorMessage: error instanceof Error ? error.message : String(error),
  });
};
