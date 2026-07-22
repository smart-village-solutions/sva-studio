import type {
  WasteHolidayRuleRecord,
  WasteTourAssignmentRecord,
  WasteTourRecord,
  WasteGlobalDateShiftRecord,
  WasteTourDateShiftRecord,
} from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioEmptyState } from '@sva/studio-ui-react';
import { type FormEvent, useState } from 'react';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { WasteTourExplicitAssignmentDialog } from './waste-management.scheduling-assignment-dialog.js';
import type { WasteTourExplicitAssignmentFormState } from './waste-management.scheduling-assignment-form.js';
import { WasteTourExplicitAssignmentsList } from './waste-management.scheduling-assignment-list.js';
import { WasteSchedulingShiftsTable } from './waste-management.scheduling-shifts-table.js';
import type { WasteSchedulingTableEntry } from './waste-management.scheduling.shared.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';

const createAssignmentForm = (
  entry?: WasteTourAssignmentRecord
): WasteTourExplicitAssignmentFormState => {
  if (!entry) {
    return {
      id: crypto.randomUUID(),
      tourId: '',
      pickupDate: '',
      locationIds: [],
      note: '',
    };
  }

  return {
    id: entry.id,
    tourId: entry.tourId,
    pickupDate: entry.pickupDate,
    locationIds: entry.locationIds,
    note: entry.note ?? '',
  };
};

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
  tours,
  tourAssignments,
  assignmentLocationOptions,
  onOpenCreateShiftDialog,
  onEditHolidayRule,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
  onDeleteSchedulingRows,
  onSaveTourAssignment,
  onDeleteTourAssignment,
  saving,
  page,
  pageSize,
  onPageChange,
  onSyncPageChange,
  onPageSizeChange,
}: {
  readonly message: StatusMessage | null;
  readonly schedulingEntries: readonly WasteSchedulingTableEntry[];
  readonly tours: readonly WasteTourRecord[];
  readonly tourAssignments: readonly WasteTourAssignmentRecord[];
  readonly assignmentLocationOptions: readonly { readonly id: string; readonly label: string }[];
  readonly onOpenCreateShiftDialog: () => void;
  readonly onEditHolidayRule: (rule: WasteHolidayRuleRecord) => void;
  readonly onEditGlobalShiftDialog: (shift: WasteGlobalDateShiftRecord) => void;
  readonly onEditTourShiftDialog: (shift: WasteTourDateShiftRecord) => void;
  readonly onDeleteSchedulingRows: (rows: readonly WasteSchedulingTableEntry[]) => Promise<void>;
  readonly onSaveTourAssignment: (
    input: {
      readonly id: string;
      readonly tourId: string;
      readonly pickupDate: string;
      readonly locationIds: readonly string[];
      readonly note: string;
    },
    mode: 'create' | 'edit'
  ) => Promise<void>;
  readonly onDeleteTourAssignment: (id: string) => Promise<void>;
  readonly saving: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (size: number) => void;
}) => {
  useWasteTabPanelActions(null);
  const pt = usePluginTranslation('wasteManagement');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState(createAssignmentForm);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const locationLabels = new Map(
    assignmentLocationOptions.map((option) => [option.id, option.label] as const)
  );
  const tourLabels = new Map(tours.map((tour) => [tour.id, tour.name] as const));
  const close = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setForm(createAssignmentForm());
      setValidationMessage(null);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.tourId || !form.pickupDate || form.locationIds.length === 0) {
      setValidationMessage(pt('scheduling.assignments.validation.required'));
      return;
    }
    try {
      await onSaveTourAssignment({ ...form, note: form.note.trim() }, dialogMode);
      close(false);
    } catch {
      // The mutation handler has already recorded a translated error message.
    }
  };
  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <WasteTourExplicitAssignmentsList
        entries={tourAssignments}
        tourLabels={tourLabels}
        locationLabels={locationLabels}
        onCreate={() => {
          setDialogMode('create');
          setForm(createAssignmentForm());
          setDialogOpen(true);
        }}
        onEdit={(entry) => {
          setDialogMode('edit');
          setForm(createAssignmentForm(entry));
          setDialogOpen(true);
        }}
        onDelete={(entry) => onDeleteTourAssignment(entry.id)}
      />
      <WasteTourExplicitAssignmentDialog
        open={dialogOpen}
        mode={dialogMode}
        form={form}
        tours={tours}
        locationOptions={assignmentLocationOptions}
        saving={saving}
        message={dialogOpen ? message : null}
        validationMessage={validationMessage}
        onOpenChange={close}
        onChange={(patch) => {
          setValidationMessage(null);
          setForm((current) => ({ ...current, ...patch }));
        }}
        onSubmit={submit}
      />
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
