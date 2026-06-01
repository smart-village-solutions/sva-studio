import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioEmptyState } from '@sva/studio-ui-react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { WasteSchedulingShiftsTable } from './waste-management.scheduling-shifts-table.js';
import type { WasteSchedulingTableEntry } from './waste-management.scheduling.shared.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';

export const WasteSchedulingEmptyState = ({
  onOpenCreateShiftDialog,
}: {
  readonly onOpenCreateShiftDialog: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioEmptyState>
      <div className="space-y-2 text-left">
        <p className="font-medium">{pt('scheduling.messages.emptyTitle')}</p>
        <p>{pt('scheduling.messages.emptyBody')}</p>
        <div className="flex gap-2 pt-2">
          <Button type="button" onClick={onOpenCreateShiftDialog}>
            {pt('scheduling.actions.openCreate')}
          </Button>
        </div>
      </div>
    </StudioEmptyState>
  );
};

export const WasteSchedulingContent = ({
  message,
  schedulingEntries,
  onOpenCreateShiftDialog,
  onEditHolidayRule,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
  onDeleteSchedulingRows,
  saving,
  page,
  pageSize,
  onPageChange,
  onSyncPageChange,
  onPageSizeChange,
}: {
  readonly message: StatusMessage | null;
  readonly schedulingEntries: readonly WasteSchedulingTableEntry[];
  readonly onOpenCreateShiftDialog: () => void;
  readonly onEditHolidayRule: (rule: import('@sva/plugin-sdk').WasteHolidayRuleRecord) => void;
  readonly onEditGlobalShiftDialog: (shift: import('@sva/plugin-sdk').WasteGlobalDateShiftRecord) => void;
  readonly onEditTourShiftDialog: (shift: import('@sva/plugin-sdk').WasteTourDateShiftRecord) => void;
  readonly onDeleteSchedulingRows: (rows: readonly WasteSchedulingTableEntry[]) => Promise<void>;
  readonly saving: boolean;
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
      <WasteSchedulingShiftsTable
        entries={schedulingEntries}
        onOpenCreateShiftDialog={onOpenCreateShiftDialog}
        onEditHolidayRule={onEditHolidayRule}
        onEditGlobalShiftDialog={onEditGlobalShiftDialog}
        onEditTourShiftDialog={onEditTourShiftDialog}
        onDeleteSchedulingRows={onDeleteSchedulingRows}
        saving={saving}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onSyncPageChange={onSyncPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
};
