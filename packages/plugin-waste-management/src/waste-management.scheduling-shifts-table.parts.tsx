import type {
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteTourDateShiftRecord,
} from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import {
  Badge,
  Button,
  StudioConfirmDialog,
  type StudioColumnDef,
  type StudioDataTableLabels,
} from '@sva/studio-ui-react';
import { useMemo } from 'react';
import type { WasteSchedulingTableEntry } from './waste-management.scheduling.shared.js';
import { WasteSchedulingMissingValue } from './waste-management.scheduling-list.parts.js';

const formatDisplayDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        timeZone: 'UTC',
      }).format(parsed);
};

const WasteSchedulingTableMeta = ({ children }: { readonly children: string }) => (
  <span className="text-xs leading-5 text-muted-foreground">{children}</span>
);

const joinMetaItems = (values: readonly string[]) => values.filter((value) => value.length > 0).join(' · ');

export const useSchedulingTableLabels = () => {
  const pt = usePluginTranslation('wasteManagement');

  return {
    selectionColumn: pt('scheduling.table.selection'),
    actionsColumn: pt('scheduling.table.actions'),
    loading: pt('masterData.messages.loading'),
    selectAllRows: (label: string) => `${label}: alle Zeilen auswählen`,
    selectRow: ({ rowId }: { label: string; rowId: string }) => `${rowId}: Zeile auswählen`,
  } satisfies StudioDataTableLabels;
};

const renderScopeCell = (row: WasteSchedulingTableEntry, pt: ReturnType<typeof usePluginTranslation>) => (
  <Badge variant="outline" className="rounded-full border-border/70 bg-transparent px-2 py-0.5 text-[11px] font-medium">
    {pt(
      row.kind === 'holiday'
        ? 'scheduling.table.scopeHoliday'
        : row.kind === 'global'
          ? 'scheduling.table.scopeGlobal'
          : 'scheduling.table.scopeTour',
    )}
  </Badge>
);

const resolveContextMeta = (row: WasteSchedulingTableEntry, pt: ReturnType<typeof usePluginTranslation>) =>
  row.kind === 'holiday'
    ? joinMetaItems([
        `${pt('scheduling.table.stateCode')}: ${row.rule.stateCode}`,
        `${pt('scheduling.table.year')}: ${String(row.rule.year)}`,
        pt(`scheduling.holidayRules.sourceStatus.${row.rule.sourceStatus}`),
      ])
    : joinMetaItems([
        `${pt('scheduling.table.hasYear')}: ${row.shift.hasYear ? pt('common.yes') : pt('common.no')}`,
        row.kind === 'tour' && row.shift.followUpMode
          ? `${pt('scheduling.table.followUpMode')}: ${pt(`scheduling.followUpModes.${row.shift.followUpMode}`)}`
          : '',
      ]);

const renderDescriptionCell = (row: WasteSchedulingTableEntry, pt: ReturnType<typeof usePluginTranslation>) => {
  if (row.kind === 'holiday') {
    const summary = joinMetaItems([
      row.rule.scope
        ? `${pt('scheduling.holidayRules.scopeLabel')}: ${pt(`scheduling.holidayRules.scopeOptions.${row.rule.scope === 'holiday-only' ? 'holidayOnly' : 'fullWeek'}`)}`
        : '',
      row.rule.strategy
        ? `${pt('scheduling.holidayRules.strategyLabel')}: ${pt(`scheduling.holidayRules.strategyOptions.${row.rule.strategy === 'advance' ? 'advance' : 'postpone'}`)}`
        : '',
      pt(`scheduling.holidayRules.conflictStatus.${row.rule.conflictStatus}`),
    ]);

    return summary ? <WasteSchedulingTableMeta>{summary}</WasteSchedulingTableMeta> : <WasteSchedulingMissingValue />;
  }

  const reasonLabel = row.shift.reasonType ? pt(`scheduling.reasonTypes.${row.shift.reasonType}`) : '';
  const meta = joinMetaItems([
    reasonLabel ? `${pt('scheduling.table.reason')}: ${reasonLabel}` : '',
    row.shift.reasonKey ? `${pt('scheduling.table.reasonKey')}: ${row.shift.reasonKey}` : '',
  ]);

  return (
    <div className="space-y-1">
      {row.shift.description ? <p className="text-sm">{row.shift.description}</p> : <WasteSchedulingMissingValue />}
      {meta ? <WasteSchedulingTableMeta>{meta}</WasteSchedulingTableMeta> : null}
    </div>
  );
};

export const useSchedulingColumns = () => {
  const pt = usePluginTranslation('wasteManagement');

  return useMemo(
    () =>
      [
        {
          id: 'originalDate',
          header: pt('scheduling.table.originalDate'),
          className: 'whitespace-nowrap',
          headerClassName: 'whitespace-nowrap',
          cell: (row) => <span className="font-medium tabular-nums">{formatDisplayDate(row.originalDate)}</span>,
        },
        {
          id: 'actualDate',
          header: pt('scheduling.table.actualDate'),
          className: 'whitespace-nowrap',
          headerClassName: 'whitespace-nowrap',
          cell: (row) =>
            row.actualDate ? (
              <span className="font-medium tabular-nums">{formatDisplayDate(row.actualDate)}</span>
            ) : (
              <WasteSchedulingMissingValue />
            ),
        },
        {
          id: 'scope',
          header: pt('scheduling.table.scope'),
          className: 'w-[150px]',
          headerClassName: 'w-[150px]',
          cell: (row) => renderScopeCell(row, pt),
        },
        {
          id: 'context',
          header: pt('scheduling.table.context'),
          className: 'min-w-[220px]',
          headerClassName: 'min-w-[220px]',
          cell: (row) => {
            const meta = resolveContextMeta(row, pt);

            return (
              <div className="space-y-1">
                <p className="text-sm font-medium">{row.contextLabel}</p>
                {meta ? <WasteSchedulingTableMeta>{meta}</WasteSchedulingTableMeta> : null}
              </div>
            );
          },
        },
        {
          id: 'description',
          header: pt('scheduling.table.descriptionColumn'),
          className: 'min-w-[280px]',
          headerClassName: 'min-w-[280px]',
          cell: (row) => renderDescriptionCell(row, pt),
        },
      ] satisfies readonly StudioColumnDef<WasteSchedulingTableEntry>[],
    [pt],
  );
};

const resolveEditLabel = (
  pt: ReturnType<typeof usePluginTranslation>,
  row: WasteSchedulingTableEntry,
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
  onEditTourShiftDialog: (shift: WasteTourDateShiftRecord) => void,
) => {
  if (row.kind === 'holiday') {
    onEditHolidayRule(row.rule);
    return;
  }
  if (row.kind === 'global') {
    onEditGlobalShiftDialog(row.shift);
    return;
  }
  onEditTourShiftDialog(row.shift);
};

export const WasteSchedulingRowActions = ({
  row,
  onEditHolidayRule,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
  onRequestDeleteRows,
}: {
  readonly row: WasteSchedulingTableEntry;
  readonly onEditHolidayRule: (rule: WasteHolidayRuleRecord) => void;
  readonly onEditGlobalShiftDialog: (shift: WasteGlobalDateShiftRecord) => void;
  readonly onEditTourShiftDialog: (shift: WasteTourDateShiftRecord) => void;
  readonly onRequestDeleteRows: (rows: readonly WasteSchedulingTableEntry[]) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
        aria-label={resolveEditLabel(pt, row)}
        onClick={() => handleEditRow(row, onEditHolidayRule, onEditGlobalShiftDialog, onEditTourShiftDialog)}
      >
        <IconEdit aria-hidden="true" className="h-4 w-4" />
      </Button>
      {row.canDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
          aria-label={pt('scheduling.actions.delete')}
          onClick={() => onRequestDeleteRows([row])}
        >
          <IconTrash aria-hidden="true" className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
};

export const WasteSchedulingDeleteDialog = ({
  pendingDeleteRows,
  onCancel,
  onConfirm,
}: {
  readonly pendingDeleteRows: readonly WasteSchedulingTableEntry[];
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <StudioConfirmDialog
      open={pendingDeleteRows.length > 0}
      title={pt('scheduling.bulkDeleteDialog.title')}
      description={pt('scheduling.bulkDeleteDialog.description', { value: pendingDeleteRows.length })}
      confirmLabel={pt('scheduling.bulkDeleteDialog.confirm')}
      cancelLabel={pt('scheduling.bulkDeleteDialog.cancel')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};
