import { useEffect } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteToursController } from './waste-management.tours.controller.js';
import { WasteToursContent, WasteToursEmptyState } from './waste-management.tours.content.js';
import { WasteToursDialogs } from './waste-management.tours-dialogs-panel.js';
import { WasteToursFormContent } from './waste-management.tours-form-content.js';
import { mapTourToForm, createDefaultTourForm } from './waste-management.tours.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteToursPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const controller = useWasteToursController(pt, search);
  const toursViewSuccess =
    search.toursView !== 'list' &&
    controller.message?.kind === 'success' &&
    (controller.message.text === pt('tours.messages.createSuccess') ||
      controller.message.text === pt('tours.messages.updateSuccess'));

  useEffect(() => {
    if (!toursViewSuccess) {
      return;
    }

    controller.setDialogOpen(false);
    controller.resetTourForm();
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        toursView: 'list',
      },
      replace: true,
    });
  }, [controller.resetTourForm, controller.setDialogOpen, navigate, search, toursViewSuccess]);

  if (controller.loading) {
    return <StudioLoadingState>{pt('tours.messages.loading')}</StudioLoadingState>;
  }

  if (controller.error) {
    return <StudioErrorState>{controller.error}</StudioErrorState>;
  }

  const dialogs = <WasteToursDialogs controller={controller} />;

  if (search.toursView !== 'list') {
    return (
      <>
        <WasteToursFormContent
          mode={search.toursView === 'edit' ? 'edit' : 'create'}
          form={controller.tourForm}
          fractions={controller.availableFractions}
          saving={controller.saving}
          onChange={(patch) => controller.setTourForm((current) => ({ ...current, ...patch }))}
          onCancel={() => {
            controller.setDialogOpen(false);
            controller.resetTourForm();
            controller.setMessage(null);
            void navigate({
              to: '/plugins/waste-management',
              search: {
                ...search,
                toursView: 'list',
              },
            });
          }}
          onSubmit={controller.onSubmitTour}
        />
        {dialogs}
      </>
    );
  }

  if (!controller.tours.length) {
    return (
      <>
        <WasteToursEmptyState
          onOpenCreateDialog={() => {
            controller.setDialogMode('create');
            controller.setDialogOpen(false);
            controller.setTourForm(createDefaultTourForm());
            controller.setMessage(null);
            void navigate({
              to: '/plugins/waste-management',
              search: {
                ...search,
                toursView: 'create',
              },
            });
          }}
        />
        {dialogs}
      </>
    );
  }

  return (
    <>
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
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              toursView: 'create',
            },
          });
        }}
        onOpenEditDialog={(tour) => {
          controller.setDialogMode('edit');
          controller.setDialogOpen(false);
          controller.setTourForm(mapTourToForm(tour));
          controller.setMessage(null);
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              toursView: 'edit',
            },
          });
        }}
        onOpenCreateAssignmentsDialog={controller.openCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={controller.openEditAssignmentsDialog}
        onOpenCalendar={controller.openCalendar}
        onToggleTourStatus={controller.onToggleTourStatus}
        onDeleteTour={controller.onDeleteTour}
        onDeleteTours={controller.onDeleteTours}
        page={search.page}
        pageSize={search.pageSize}
        query={search.q}
        status={search.status}
        onPageChange={(page) => {
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              page,
            },
          });
        }}
        onPageSizeChange={(pageSize) => {
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              page: 1,
              pageSize,
            },
          });
        }}
        onQueryChange={(q) => {
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              q,
              page: 1,
            },
          });
        }}
        onStatusChange={(status) => {
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              status,
              page: 1,
            },
          });
        }}
      />
      {dialogs}
    </>
  );
};
