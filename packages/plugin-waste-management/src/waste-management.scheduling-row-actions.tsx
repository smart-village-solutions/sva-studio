import type {
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteTourDateShiftRecord,
} from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

import type { WasteManagementSearchParams } from './search-params.js';
import { toEditSchedulingEntrySearch } from './waste-management.scheduling-list-view.navigation.js';
import type { WasteSchedulingTableEntry } from './waste-management.scheduling.shared.js';

const resolveEditLabel = (
  pt: ReturnType<typeof usePluginTranslation>,
  row: WasteSchedulingTableEntry
) => {
  switch (row.kind) {
    case 'holiday':
      return pt('scheduling.holidayRules.editAction');
    case 'global':
      return pt('scheduling.global.actions.edit');
    case 'tour':
      return pt('scheduling.tour.actions.edit');
  }
};

const handleEditRow = (
  row: WasteSchedulingTableEntry,
  onEditHolidayRule: (rule: WasteHolidayRuleRecord) => void,
  onEditGlobalShiftDialog: (shift: WasteGlobalDateShiftRecord) => void,
  onEditTourShiftDialog: (shift: WasteTourDateShiftRecord) => void
) => {
  if (row.kind === 'holiday') {
    onEditHolidayRule(row.rule);
  } else if (row.kind === 'global') {
    onEditGlobalShiftDialog(row.shift);
  } else {
    onEditTourShiftDialog(row.shift);
  }
};

export const WasteSchedulingRowActions = ({
  row,
  search,
  onEditHolidayRule,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
  onRequestDeleteRows,
}: {
  readonly row: WasteSchedulingTableEntry;
  readonly search?: WasteManagementSearchParams;
  readonly onEditHolidayRule: (rule: WasteHolidayRuleRecord) => void;
  readonly onEditGlobalShiftDialog: (shift: WasteGlobalDateShiftRecord) => void;
  readonly onEditTourShiftDialog: (shift: WasteTourDateShiftRecord) => void;
  readonly onRequestDeleteRows: (rows: readonly WasteSchedulingTableEntry[]) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const editLabel = resolveEditLabel(pt, row);
  const deleteLabel = pt('scheduling.actions.delete');
  const schedulingEntryType =
    row.kind === 'holiday'
      ? 'holiday-rule'
      : row.kind === 'global'
        ? 'global-shift'
        : 'tour-shift';

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        asChild={Boolean(search)}
        variant="tertiary"
        size="sm"
        className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
        aria-label={editLabel}
        tooltip={editLabel}
        {...(!search
          ? {
              onClick: () =>
                handleEditRow(
                  row,
                  onEditHolidayRule,
                  onEditGlobalShiftDialog,
                  onEditTourShiftDialog
                ),
            }
          : {})}
      >
        {search ? (
          <Link
            to="/plugins/waste-management"
            search={toEditSchedulingEntrySearch(search, schedulingEntryType, row.id)}
          >
            <IconEdit aria-hidden="true" className="h-4 w-4" />
          </Link>
        ) : (
          <IconEdit aria-hidden="true" className="h-4 w-4" />
        )}
      </Button>
      {row.canDelete ? (
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
          aria-label={deleteLabel}
          tooltip={deleteLabel}
          onClick={() => onRequestDeleteRows([row])}
        >
          <IconTrash aria-hidden="true" className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
};
