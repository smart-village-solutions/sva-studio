import { useNavigate } from '@tanstack/react-router';

import { useWasteToursController } from './waste-management.tours.controller.js';
import { WasteToursContent, WasteToursEmptyState } from './waste-management.tours.content.js';
import { createDefaultTourForm, mapTourToForm } from './waste-management.tours.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteToursController = ReturnType<typeof useWasteToursController>;

export const WasteToursListView = ({
  controller,
  search,
}: {
  readonly controller: WasteToursController;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigate = useNavigate();

  if (!controller.tours.length) {
    return (
      <WasteToursEmptyState
        onOpenCreateDialog={() => {
          controller.setDialogMode('create');
          controller.setDialogOpen(false);
          controller.setTourForm(createDefaultTourForm());
          controller.setMessage(null);
          void navigate({ to: '/plugins/waste-management', search: { ...search, toursView: 'create' } });
        }}
      />
    );
  }

  return (
    <WasteToursContent
      assignmentContextLoading={controller.assignmentContextLoading}
      message={controller.message}
      tours={controller.tours}
      fractions={controller.availableFractions}
      masterDataOverview={controller.masterDataOverview}
      schedulingOverview={controller.schedulingOverview}
      onOpenCreateDialog={() => {
        controller.setDialogMode('create');
        controller.setDialogOpen(false);
        controller.setTourForm(createDefaultTourForm());
        controller.setMessage(null);
        void navigate({ to: '/plugins/waste-management', search: { ...search, toursView: 'create' } });
      }}
      onOpenEditDialog={(tour) => {
        controller.setDialogMode('edit');
        controller.setDialogOpen(false);
        controller.setTourForm(mapTourToForm(tour));
        controller.setMessage(null);
        void navigate({ to: '/plugins/waste-management', search: { ...search, toursView: 'edit' } });
      }}
      onOpenCreateAssignmentsDialog={controller.openCreateAssignmentsDialog}
      onOpenEditAssignmentsDialog={controller.openEditAssignmentsDialog}
      onOpenCalendar={controller.openCalendar}
      onToggleTourStatus={controller.onToggleTourStatus}
      onDeleteTour={controller.onDeleteTour}
      onDeleteTours={controller.onDeleteTours}
      saving={controller.saving}
      page={search.page}
      pageSize={search.pageSize}
      query={search.q}
      status={search.status}
      onPageChange={(page) => {
        void navigate({ to: '/plugins/waste-management', search: { ...search, page } });
      }}
      onPageSizeChange={(pageSize) => {
        void navigate({ to: '/plugins/waste-management', search: { ...search, page: 1, pageSize } });
      }}
      onQueryChange={(q) => {
        void navigate({ to: '/plugins/waste-management', search: { ...search, q, page: 1 } });
      }}
      onStatusChange={(status) => {
        void navigate({ to: '/plugins/waste-management', search: { ...search, status, page: 1 } });
      }}
    />
  );
};
