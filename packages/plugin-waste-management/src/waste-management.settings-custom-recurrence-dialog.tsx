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
  StudioField,
  StudioFieldGroup,
  Textarea,
} from '@sva/studio-ui-react';

import type { CustomRecurrencePresetInputState } from './waste-management.settings-form.js';

const createEmptyPreset = (): CustomRecurrencePresetInputState => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  intervalDays: 1,
});

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
  const [draft, setDraft] = useState<CustomRecurrencePresetInputState>(value ?? createEmptyPreset());

  useEffect(() => {
    setDraft(value ?? createEmptyPreset());
  }, [value]);

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

        <div className="space-y-4">
          <StudioFieldGroup>
            <StudioField id="waste-settings-custom-recurrence-name" label={pt('settings.fields.customRecurrenceName')}>
              <Input
                id="waste-settings-custom-recurrence-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </StudioField>
            <StudioField
              id="waste-settings-custom-recurrence-interval-days"
              label={pt('settings.fields.customRecurrenceIntervalDays')}
            >
              <Input
                id="waste-settings-custom-recurrence-interval-days"
                type="number"
                min={1}
                value={String(draft.intervalDays)}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    intervalDays: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
              />
            </StudioField>
            <StudioField
              id="waste-settings-custom-recurrence-description"
              label={pt('settings.fields.customRecurrenceDescription')}
            >
              <Textarea
                id="waste-settings-custom-recurrence-description"
                rows={3}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              />
            </StudioField>
          </StudioFieldGroup>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {pt('tours.actions.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!draft.name.trim() || draft.intervalDays <= 0}
            onClick={() =>
              onSave({
                ...draft,
                name: draft.name.trim(),
                description: draft.description.trim(),
              })
            }
          >
            {pt('settings.actions.saveCustomRecurrence')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
