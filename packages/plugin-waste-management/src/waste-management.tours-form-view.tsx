import { useNavigate } from '@tanstack/react-router';

import { useWasteToursViewModel } from './use-waste-tours-view-model.js';
import { WasteToursFormContent } from './waste-management.tours-form-content.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteViewModel = ReturnType<typeof useWasteToursViewModel>;

export const WasteToursFormView = ({
  controller,
  search,
  canManageScheduling = false,
}: {
  readonly controller: WasteViewModel;
  readonly search: WasteManagementSearchParams;
  readonly canManageScheduling?: boolean;
}) => {
  const navigate = useNavigate();
  const duplicateSourceTour =
    search.duplicateFromTourId && search.toursView !== 'edit'
      ? controller.overview?.tours.find((tour) => tour.id === search.duplicateFromTourId)
      : undefined;

  return (
    <WasteToursFormContent
      mode={search.toursView === 'edit' ? 'edit' : 'create'}
      form={controller.tourForm}
      fractions={controller.availableFractions}
      locations={controller.locationOptions}
      customRecurrencePresets={controller.customRecurrencePresets}
      showDuplicationHint={search.toursView !== 'edit' && Boolean(search.duplicateFromTourId)}
      duplicateFromTourName={duplicateSourceTour?.name}
      saving={controller.saving}
      persistedTour={controller.selectedTour ?? undefined}
      assignmentContextLoading={controller.assignmentContextLoading}
      onOpenAssignments={() => {
        const tour = controller.selectedTour;
        if (!tour) return;
        const linkId = controller.masterDataOverview?.locationTourLinks.find(
          (link) => link.tourId === tour.id
        )?.id;
        if (linkId) controller.openEditAssignmentsDialog(tour, linkId);
        else controller.openCreateAssignmentsDialog(tour);
      }}
      onOpenCalendar={() => {
        if (controller.selectedTour) void controller.openCalendar(controller.selectedTour);
      }}
      search={search}
      canManageScheduling={canManageScheduling}
      onChange={(patch) => controller.setTourForm((current) => ({ ...current, ...patch }))}
      onCancel={() => {
        controller.setDialogOpen(false);
        controller.resetTourForm();
        controller.setSelectedTour(null);
        controller.setMessage(null);
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            toursView: 'list',
            tourId: undefined,
            duplicateFromTourId: undefined,
          },
        });
      }}
      onSubmit={(event) =>
        controller.onSubmitTour(
          event,
          search.toursView === 'edit' ? 'edit' : 'create',
          search.toursView === 'edit' ? undefined : search.duplicateFromTourId
        )
      }
    />
  );
};
