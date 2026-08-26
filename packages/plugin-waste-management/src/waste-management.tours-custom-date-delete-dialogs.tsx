import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioDestructiveActionDialog } from '@sva/studio-ui-react';
import type { RefObject } from 'react';

import type { TourDateLocationAssignmentFormState } from './waste-management.tours.types.js';

export type TourCustomDatePendingDelete =
  Readonly<{ kind: 'date'; date: string }> | Readonly<{ kind: 'assignment'; assignmentId: string }>;

export const WasteToursCustomDateDeleteDialog = ({
  pendingDelete,
  assignments,
  locationLabels,
  fallbackFocusRef,
  onCancel,
  onConfirm,
}: {
  readonly pendingDelete: TourCustomDatePendingDelete | null;
  readonly assignments: readonly TourDateLocationAssignmentFormState[];
  readonly locationLabels: ReadonlyMap<string, string>;
  readonly fallbackFocusRef: RefObject<HTMLElement | null>;
  readonly onCancel: () => void;
  readonly onConfirm: (pendingDelete: TourCustomDatePendingDelete) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const assignment =
    pendingDelete?.kind === 'assignment'
      ? assignments.find((entry) => entry.id === pendingDelete.assignmentId)
      : undefined;
  const assignmentLocation = assignment
    ? (locationLabels.get(assignment.locationId) ??
      pt('tours.customDates.dialog.removeAssignmentUnknownLocation'))
    : '';
  const deletingDate = pendingDelete?.kind === 'date';

  return (
    <StudioDestructiveActionDialog
      open={pendingDelete !== null}
      title={pt(
        deletingDate
          ? 'tours.customDates.dialog.removeTitle'
          : 'tours.customDates.dialog.removeAssignmentTitle'
      )}
      description={pt(
        deletingDate
          ? 'tours.customDates.dialog.removeDescription'
          : 'tours.customDates.dialog.removeAssignmentDescription',
        deletingDate
          ? { value: pendingDelete.date }
          : {
              location: assignmentLocation,
              date: assignment?.pickupDate ?? '',
            }
      )}
      confirmLabel={pt('tours.customDates.dialog.removeConfirm')}
      pendingLabel={pt('common.deleting')}
      cancelLabel={pt('tours.customDates.dialog.removeCancel')}
      fallbackFocusRef={fallbackFocusRef}
      onCancel={onCancel}
      onConfirm={() => {
        if (pendingDelete) onConfirm(pendingDelete);
      }}
    />
  );
};
