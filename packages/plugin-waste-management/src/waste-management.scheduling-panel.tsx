import { useEffect } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { WasteSchedulingContent, WasteSchedulingEmptyState } from './waste-management.scheduling-content.js';
import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import { GlobalDateShiftDialog, TourDateShiftDialog } from './waste-management.scheduling.dialogs.js';
import { WasteSchedulingFormContent } from './waste-management.scheduling-form-content.js';
import {
  createDefaultGlobalDateShiftForm,
  createDefaultTourDateShiftForm,
} from './waste-management.scheduling.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteSchedulingPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const controller = useWasteSchedulingController(pt, search);
  const schedulingViewSuccess =
    search.schedulingView !== 'list' &&
    controller.message?.kind === 'success' &&
    [
      pt('scheduling.global.messages.createSuccess'),
      pt('scheduling.global.messages.updateSuccess'),
      pt('scheduling.tour.messages.createSuccess'),
      pt('scheduling.tour.messages.updateSuccess'),
    ].includes(controller.message.text);

  useEffect(() => {
    if (!schedulingViewSuccess) {
      return;
    }

    controller.setDialogOpen(false);
    controller.setGlobalDialogOpen(false);
    if (search.schedulingView === 'create-tour' || search.schedulingView === 'edit-tour') {
      controller.resetTourShiftForm();
    } else if (search.schedulingView === 'create-global' || search.schedulingView === 'edit-global') {
      controller.resetGlobalShiftForm();
    }
    void navigate({
      to: '/plugins/waste-management',
      search: {
        ...search,
        schedulingView: 'list',
      },
      replace: true,
    });
  }, [
    controller.resetGlobalShiftForm,
    controller.resetTourShiftForm,
    controller.setDialogOpen,
    controller.setGlobalDialogOpen,
    navigate,
    schedulingViewSuccess,
    search,
  ]);

  if (controller.loading) {
    return <StudioLoadingState>{pt('scheduling.messages.loading')}</StudioLoadingState>;
  }

  if (controller.error) {
    return <StudioErrorState>{controller.error}</StudioErrorState>;
  }

  const dialogs = (
    <>
      <TourDateShiftDialog
        open={controller.dialogOpen}
        mode={controller.dialogMode}
        form={controller.tourShiftForm}
        tours={controller.availableTours}
        saving={controller.saving}
        message={controller.dialogOpen ? controller.message : null}
        onOpenChange={(open) => {
          controller.setDialogOpen(open);
          if (!open) {
            controller.setTourShiftForm(createDefaultTourDateShiftForm());
          }
        }}
        onChange={(patch) => controller.setTourShiftForm((current) => ({ ...current, ...patch }))}
        onSubmit={controller.onSubmitTourShift}
      />
      <GlobalDateShiftDialog
        open={controller.globalDialogOpen}
        mode={controller.globalDialogMode}
        form={controller.globalShiftForm}
        tours={controller.availableTours}
        saving={controller.saving}
        message={controller.globalDialogOpen ? controller.message : null}
        onOpenChange={(open) => {
          controller.setGlobalDialogOpen(open);
          if (!open) {
            controller.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
          }
        }}
        onChange={(patch) => controller.setGlobalShiftForm((current) => ({ ...current, ...patch }))}
        onSubmit={controller.onSubmitGlobalShift}
      />
    </>
  );

  if (search.schedulingView === 'create-global' || search.schedulingView === 'edit-global') {
    return (
      <>
        <WasteSchedulingFormContent
          variant="global"
          mode={search.schedulingView === 'edit-global' ? 'edit' : 'create'}
          form={controller.globalShiftForm}
          tours={controller.availableTours}
          saving={controller.saving}
          onChange={(patch) => controller.setGlobalShiftForm((current) => ({ ...current, ...patch }))}
          onCancel={() => {
            controller.setGlobalDialogOpen(false);
            controller.resetGlobalShiftForm();
            controller.setMessage(null);
            void navigate({
              to: '/plugins/waste-management',
              search: {
                ...search,
                schedulingView: 'list',
              },
            });
          }}
          onSubmit={controller.onSubmitGlobalShift}
        />
        {dialogs}
      </>
    );
  }

  if (search.schedulingView === 'create-tour' || search.schedulingView === 'edit-tour') {
    return (
      <>
        <WasteSchedulingFormContent
          variant="tour"
          mode={search.schedulingView === 'edit-tour' ? 'edit' : 'create'}
          form={controller.tourShiftForm}
          tours={controller.availableTours}
          saving={controller.saving}
          onChange={(patch) => controller.setTourShiftForm((current) => ({ ...current, ...patch }))}
          onCancel={() => {
            controller.setDialogOpen(false);
            controller.resetTourShiftForm();
            controller.setMessage(null);
            void navigate({
              to: '/plugins/waste-management',
              search: {
                ...search,
                schedulingView: 'list',
              },
            });
          }}
          onSubmit={controller.onSubmitTourShift}
        />
        {dialogs}
      </>
    );
  }

  if (!controller.tourDateShifts.length && !controller.globalDateShifts.length) {
    return (
      <>
        <WasteSchedulingEmptyState
          onOpenCreateGlobalShiftDialog={() => {
            controller.setGlobalDialogMode('create');
            controller.setGlobalDialogOpen(false);
            controller.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
            controller.setMessage(null);
            void navigate({
              to: '/plugins/waste-management',
              search: {
                ...search,
                schedulingView: 'create-global',
              },
            });
          }}
          onOpenCreateTourShiftDialog={() => {
            controller.setDialogMode('create');
            controller.setDialogOpen(false);
            controller.setTourShiftForm({
              ...createDefaultTourDateShiftForm(),
              tourId: controller.availableTours.length === 1 ? controller.availableTours[0]?.id ?? '' : '',
            });
            controller.setMessage(null);
            void navigate({
              to: '/plugins/waste-management',
              search: {
                ...search,
                schedulingView: 'create-tour',
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
      <WasteSchedulingContent
        message={controller.message}
        globalDateShifts={controller.globalDateShifts}
        tourDateShifts={controller.tourDateShifts}
        onOpenCreateGlobalShiftDialog={() => {
          controller.setGlobalDialogMode('create');
          controller.setGlobalDialogOpen(false);
          controller.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
          controller.setMessage(null);
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              schedulingView: 'create-global',
            },
          });
        }}
        onOpenCreateTourShiftDialog={() => {
          controller.setDialogMode('create');
          controller.setDialogOpen(false);
          controller.setTourShiftForm({
            ...createDefaultTourDateShiftForm(),
            tourId: controller.availableTours.length === 1 ? controller.availableTours[0]?.id ?? '' : '',
          });
          controller.setMessage(null);
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              schedulingView: 'create-tour',
            },
          });
        }}
        onEditGlobalShiftDialog={(shift) => {
          controller.openEditGlobalShiftDialog(shift);
          controller.setGlobalDialogOpen(false);
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              schedulingView: 'edit-global',
            },
          });
        }}
        onEditTourShiftDialog={(shift) => {
          controller.openEditTourShiftDialog(shift);
          controller.setDialogOpen(false);
          void navigate({
            to: '/plugins/waste-management',
            search: {
              ...search,
              schedulingView: 'edit-tour',
            },
          });
        }}
        page={search.page}
        pageSize={search.pageSize}
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
      />
      {dialogs}
    </>
  );
};
