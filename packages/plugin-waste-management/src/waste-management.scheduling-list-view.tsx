import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import { WasteSchedulingContent, WasteSchedulingEmptyState } from './waste-management.scheduling-content.js';
import {
  createDefaultGlobalDateShiftForm,
  createDefaultTourDateShiftForm,
} from './waste-management.scheduling.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;

const resolveSingleTourId = (controller: WasteSchedulingController) =>
  controller.availableTours.length === 1 ? controller.availableTours[0]?.id ?? '' : '';

export const WasteSchedulingListView = ({
  controller,
  search,
}: {
  readonly controller: WasteSchedulingController;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigate = useNavigate();

  if (!controller.tourDateShifts.length && !controller.globalDateShifts.length) {
    return (
      <WasteSchedulingEmptyState
        onOpenCreateGlobalShiftDialog={() => {
          controller.setGlobalDialogMode('create');
          controller.setGlobalDialogOpen(false);
          controller.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
          controller.setMessage(null);
          void navigate({ to: '/plugins/waste-management', search: { ...search, schedulingView: 'create-global' } });
        }}
        onOpenCreateTourShiftDialog={() => {
          controller.setDialogMode('create');
          controller.setDialogOpen(false);
          controller.setTourShiftForm({ ...createDefaultTourDateShiftForm(), tourId: resolveSingleTourId(controller) });
          controller.setMessage(null);
          void navigate({ to: '/plugins/waste-management', search: { ...search, schedulingView: 'create-tour' } });
        }}
      />
    );
  }

  return (
    <WasteSchedulingContent
      message={controller.message}
      globalDateShifts={controller.globalDateShifts}
      tourDateShifts={controller.tourDateShifts}
      onOpenCreateGlobalShiftDialog={() => {
        controller.setGlobalDialogMode('create');
        controller.setGlobalDialogOpen(false);
        controller.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
        controller.setMessage(null);
        void navigate({ to: '/plugins/waste-management', search: { ...search, schedulingView: 'create-global' } });
      }}
      onOpenCreateTourShiftDialog={() => {
        controller.setDialogMode('create');
        controller.setDialogOpen(false);
        controller.setTourShiftForm({ ...createDefaultTourDateShiftForm(), tourId: resolveSingleTourId(controller) });
        controller.setMessage(null);
        void navigate({ to: '/plugins/waste-management', search: { ...search, schedulingView: 'create-tour' } });
      }}
      onEditGlobalShiftDialog={(shift) => {
        controller.openEditGlobalShiftDialog(shift);
        controller.setGlobalDialogOpen(false);
        void navigate({ to: '/plugins/waste-management', search: { ...search, schedulingView: 'edit-global' } });
      }}
      onEditTourShiftDialog={(shift) => {
        controller.openEditTourShiftDialog(shift);
        controller.setDialogOpen(false);
        void navigate({ to: '/plugins/waste-management', search: { ...search, schedulingView: 'edit-tour' } });
      }}
      page={search.page}
      pageSize={search.pageSize}
      onPageChange={(page) => {
        void navigate({ to: '/plugins/waste-management', search: { ...search, page } });
      }}
      onPageSizeChange={(pageSize) => {
        void navigate({ to: '/plugins/waste-management', search: { ...search, page: 1, pageSize } });
      }}
    />
  );
};
