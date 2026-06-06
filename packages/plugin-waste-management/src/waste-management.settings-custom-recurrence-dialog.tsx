import { useEffect, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
  Textarea,
} from '@sva/studio-ui-react';

import {
  createEmptyCustomRecurrencePreset,
  customRecurrenceIntervalDayOptions,
  normalizeCustomRecurrencePresetDraft,
} from './waste-management.settings-custom-recurrence.support.js';
import type { CustomRecurrencePresetInputState } from './waste-management.settings.shared.js';

const CustomRecurrenceDialogFields = ({
  draft,
  onChange,
  pt,
}: {
  readonly draft: CustomRecurrencePresetInputState;
  readonly onChange: (next: CustomRecurrencePresetInputState) => void;
  readonly pt: (key: string, variables?: Record<string, string | number>) => string;
}) => (
  <div className="space-y-4">
    <StudioFieldGroup>
      <StudioField id="waste-settings-custom-recurrence-name" label={pt('settings.fields.customRecurrenceName')}>
        <Input
          id="waste-settings-custom-recurrence-name"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </StudioField>
      <StudioField
        id="waste-settings-custom-recurrence-interval-days"
        label={pt('settings.fields.customRecurrenceIntervalDays')}
      >
        <Select
          id="waste-settings-custom-recurrence-interval-days"
          value={String(draft.intervalDays)}
          onChange={(event) =>
            onChange({
              ...draft,
              intervalDays: Math.max(1, Number(event.currentTarget.value) || 1),
            })
          }
        >
          {customRecurrenceIntervalDayOptions.map((value) => (
            <option key={value} value={value}>
              {pt('settings.meta.customRecurrenceIntervalDays', { value })}
            </option>
          ))}
        </Select>
      </StudioField>
      <StudioField
        id="waste-settings-custom-recurrence-description"
        label={pt('settings.fields.customRecurrenceDescription')}
      >
        <Textarea
          id="waste-settings-custom-recurrence-description"
          rows={3}
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </StudioField>
    </StudioFieldGroup>
  </div>
);

export const WasteSettingsCustomRecurrenceDialog = ({
  open,
  mode,
  value,
  onOpenChange,
  onSave,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly value: CustomRecurrencePresetInputState | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (value: CustomRecurrencePresetInputState) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [draft, setDraft] = useState<CustomRecurrencePresetInputState>(value ?? createEmptyCustomRecurrencePreset());

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(value ?? createEmptyCustomRecurrencePreset());
  }, [open, value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? pt('settings.messages.customRecurrenceCreateTitle')
              : pt('settings.messages.customRecurrenceEditTitle')}
          </DialogTitle>
          <DialogDescription>{pt('settings.messages.customRecurrencesDescription')}</DialogDescription>
        </DialogHeader>

        <CustomRecurrenceDialogFields draft={draft} onChange={setDraft} pt={pt} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {pt('tours.actions.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!draft.name.trim() || draft.intervalDays <= 0}
            onClick={() => onSave(normalizeCustomRecurrencePresetDraft(draft))}
          >
            {pt('settings.actions.saveCustomRecurrence')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
