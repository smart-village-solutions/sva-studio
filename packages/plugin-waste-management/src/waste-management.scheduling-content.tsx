import type { WasteGlobalDateShiftRecord, WasteHolidayRuleRecord, WasteTourDateShiftRecord, WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioEmptyState } from '@sva/studio-ui-react';

import { WasteHolidayRulesList } from './waste-management.holiday-rules-list.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { WasteSchedulingShiftsTable } from './waste-management.scheduling-shifts-table.js';
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
  globalDateShifts,
  tourDateShifts,
  holidayRules,
  availableTours,
  onOpenCreateShiftDialog,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
  onDeleteSchedulingRows,
  onSaveHolidayRule,
  onRunHolidaySync,
  saving,
  page,
  pageSize,
  onPageChange,
  onSyncPageChange,
  onPageSizeChange,
}: {
  readonly message: StatusMessage | null;
  readonly globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  readonly tourDateShifts: readonly WasteTourDateShiftRecord[];
  readonly holidayRules: readonly WasteHolidayRuleRecord[];
  readonly availableTours: readonly WasteTourRecord[];
  readonly onOpenCreateShiftDialog: () => void;
  readonly onEditGlobalShiftDialog: (shift: WasteGlobalDateShiftRecord) => void;
  readonly onEditTourShiftDialog: (shift: WasteTourDateShiftRecord) => void;
  readonly onDeleteSchedulingRows: (rows: readonly import('./waste-management.scheduling.shared.js').WasteSchedulingTableRow[]) => Promise<void>;
  readonly onSaveHolidayRule: (
    rule: WasteHolidayRuleRecord,
    input: {
      readonly scope?: WasteHolidayRuleRecord['scope'];
      readonly strategy?: WasteHolidayRuleRecord['strategy'];
    }
  ) => Promise<void>;
  readonly onRunHolidaySync: () => Promise<void>;
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
      <WasteHolidayRulesList
        rules={holidayRules}
        saving={saving}
        onRunSync={onRunHolidaySync}
        onSaveRule={onSaveHolidayRule}
      />
      <WasteSchedulingShiftsTable
        globalDateShifts={globalDateShifts}
        tourDateShifts={tourDateShifts}
        availableTours={availableTours}
        onOpenCreateShiftDialog={onOpenCreateShiftDialog}
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
