import type { WasteGlobalDateShiftRecord, WasteTourDateShiftRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioEmptyState } from '@sva/studio-ui-react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';
import { WasteSchedulingGlobalShiftList } from './waste-management.scheduling-global-list.js';
import { WasteSchedulingTourShiftList } from './waste-management.scheduling-tour-list.js';

export const WasteSchedulingEmptyState = ({
  onOpenCreateGlobalShiftDialog,
  onOpenCreateTourShiftDialog,
}: {
  readonly onOpenCreateGlobalShiftDialog: () => void;
  readonly onOpenCreateTourShiftDialog: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioEmptyState>
      <div className="space-y-2 text-left">
        <p className="font-medium">{pt('scheduling.messages.emptyTitle')}</p>
        <p>{pt('scheduling.messages.emptyBody')}</p>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onOpenCreateGlobalShiftDialog}>
            {pt('scheduling.global.actions.openCreate')}
          </Button>
          <Button type="button" onClick={onOpenCreateTourShiftDialog}>
            {pt('scheduling.tour.actions.openCreate')}
          </Button>
        </div>
      </div>
    </StudioEmptyState>
  );
};

export const WasteSchedulingContent = ({
  message,
  globalDateShifts,
  tourDateShifts,
  onOpenCreateGlobalShiftDialog,
  onOpenCreateTourShiftDialog,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
  page,
  pageSize,
  onPageChange,
  onSyncPageChange,
  onPageSizeChange,
}: {
  readonly message: StatusMessage | null;
  readonly globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  readonly tourDateShifts: readonly WasteTourDateShiftRecord[];
  readonly onOpenCreateGlobalShiftDialog: () => void;
  readonly onOpenCreateTourShiftDialog: () => void;
  readonly onEditGlobalShiftDialog: (shift: WasteGlobalDateShiftRecord) => void;
  readonly onEditTourShiftDialog: (shift: WasteTourDateShiftRecord) => void;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
}) => {
  useWasteTabPanelActions(null);

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <div className="grid gap-4 xl:grid-cols-2">
        <WasteSchedulingGlobalShiftList
          shifts={globalDateShifts}
          onEdit={onEditGlobalShiftDialog}
          onOpenCreate={onOpenCreateGlobalShiftDialog}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
        <WasteSchedulingTourShiftList
          shifts={tourDateShifts}
          onEdit={onEditTourShiftDialog}
          onOpenCreate={onOpenCreateTourShiftDialog}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onSyncPageChange={onSyncPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
};
