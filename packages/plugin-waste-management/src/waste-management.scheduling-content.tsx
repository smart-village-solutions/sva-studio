import type { WasteLocationTourPickupDateRecord, WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioEmptyState } from '@sva/studio-ui-react';
import { type FormEvent, useState } from 'react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import {
  WasteSchadstoffmobilAssignmentDialog,
} from './waste-management.scheduling-schadstoffmobil-dialog.js';
import type { WasteSchadstoffmobilAssignmentFormState } from './waste-management.scheduling-schadstoffmobil-form.js';
import { WasteSchadstoffmobilAssignmentsList } from './waste-management.scheduling-schadstoffmobil-list.js';
import { WasteSchedulingShiftsTable } from './waste-management.scheduling-shifts-table.js';
import type { WasteSchedulingTableEntry } from './waste-management.scheduling.shared.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';

const createSchadstoffmobilForm = (
  entry?: Pick<WasteLocationTourPickupDateRecord, 'id' | 'pickupDate' | 'locationId' | 'note'>
): WasteSchadstoffmobilAssignmentFormState => ({
  id: entry?.id ?? crypto.randomUUID(),
  pickupDate: entry?.pickupDate ?? '',
  locationId: entry?.locationId ?? '',
  note: entry?.note ?? '',
});

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
  schadstoffmobilTour,
  schadstoffmobilAssignments,
  schadstoffmobilLocationOptions,
  onOpenCreateShiftDialog,
  onEditHolidayRule,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
  onDeleteSchedulingRows,
  onSaveLocationTourPickupDate,
  onDeleteLocationTourPickupDate,
  saving,
  page,
  pageSize,
  onPageChange,
  onSyncPageChange,
  onPageSizeChange,
}: {
  readonly message: StatusMessage | null;
  readonly schedulingEntries: readonly WasteSchedulingTableEntry[];
  readonly schadstoffmobilTour: WasteTourRecord | null;
  readonly schadstoffmobilAssignments: readonly WasteLocationTourPickupDateRecord[];
  readonly schadstoffmobilLocationOptions: readonly { readonly id: string; readonly label: string }[];
  readonly onOpenCreateShiftDialog: () => void;
  readonly onEditHolidayRule: (rule: import('@sva/plugin-sdk').WasteHolidayRuleRecord) => void;
  readonly onEditGlobalShiftDialog: (shift: import('@sva/plugin-sdk').WasteGlobalDateShiftRecord) => void;
  readonly onEditTourShiftDialog: (shift: import('@sva/plugin-sdk').WasteTourDateShiftRecord) => void;
  readonly onDeleteSchedulingRows: (rows: readonly WasteSchedulingTableEntry[]) => Promise<void>;
  readonly onSaveLocationTourPickupDate: (
    input: {
      readonly id: string;
      readonly locationId: string;
      readonly tourId: string;
      readonly pickupDate: string;
      readonly note: string;
    },
    mode: 'create' | 'edit'
  ) => Promise<void>;
  readonly onDeleteLocationTourPickupDate: (pickupDateId: string) => Promise<void>;
  readonly saving: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
}) => {
  useWasteTabPanelActions(null);
  const pt = usePluginTranslation('wasteManagement');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogForm, setDialogForm] = useState<WasteSchadstoffmobilAssignmentFormState>(() => createSchadstoffmobilForm());
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const schadstoffmobilLocationLabels = new Map(
    schadstoffmobilLocationOptions.map((option) => [option.id, option.label] as const)
  );

  const openCreateSchadstoffmobilDialog = () => {
    setDialogMode('create');
    setDialogForm(createSchadstoffmobilForm());
    setValidationMessage(null);
    setDialogOpen(true);
  };

  const openEditSchadstoffmobilDialog = (entry: WasteLocationTourPickupDateRecord) => {
    setDialogMode('edit');
    setDialogForm(createSchadstoffmobilForm(entry));
    setValidationMessage(null);
    setDialogOpen(true);
  };

  const closeSchadstoffmobilDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setValidationMessage(null);
      setDialogForm(createSchadstoffmobilForm());
    }
  };

  const handleSubmitSchadstoffmobilAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!schadstoffmobilTour) {
      return;
    }
    const trimmedNote = dialogForm.note.trim();
    if (trimmedNote.length === 0) {
      setValidationMessage(pt('scheduling.schadstoffmobil.validation.noteRequired'));
      return;
    }
    setValidationMessage(null);
    await onSaveLocationTourPickupDate(
      {
        id: dialogForm.id,
        locationId: dialogForm.locationId,
        tourId: schadstoffmobilTour.id,
        pickupDate: dialogForm.pickupDate,
        note: trimmedNote,
      },
      dialogMode
    );
    setDialogOpen(false);
    setDialogForm(createSchadstoffmobilForm());
  };

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      {schadstoffmobilTour ? (
        <>
          <WasteSchadstoffmobilAssignmentsList
            entries={schadstoffmobilAssignments}
            locationLabels={schadstoffmobilLocationLabels}
            onCreate={openCreateSchadstoffmobilDialog}
            onEdit={openEditSchadstoffmobilDialog}
            onDelete={(entry) => onDeleteLocationTourPickupDate(entry.id)}
          />
          <WasteSchadstoffmobilAssignmentDialog
            open={dialogOpen}
            mode={dialogMode}
            form={dialogForm}
            locationOptions={schadstoffmobilLocationOptions}
            saving={saving}
            message={dialogOpen ? message : null}
            validationMessage={validationMessage}
            onOpenChange={closeSchadstoffmobilDialog}
            onChange={(patch) => {
              setValidationMessage(null);
              setDialogForm((current) => ({ ...current, ...patch }));
            }}
            onSubmit={handleSubmitSchadstoffmobilAssignment}
          />
        </>
      ) : null}
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
