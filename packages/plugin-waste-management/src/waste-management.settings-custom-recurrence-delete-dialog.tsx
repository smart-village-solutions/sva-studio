import { useEffect, useMemo, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  StudioField,
} from '@sva/studio-ui-react';

import {
  createDeletedPresetFallbackOptions,
  formatDeletedPresetFallback,
  parseDeletedPresetFallback,
} from './waste-management.settings-custom-recurrence.support.js';
import type { CustomRecurrencePresetInputState, DeletedPresetFallbackState } from './waste-management.settings.shared.js';

const DeleteFallbackField = ({
  selection,
  options,
  pt,
  onSelectionChange,
}: {
  readonly selection: string;
  readonly options: readonly { readonly key: string; readonly label: string }[];
  readonly pt: (key: string) => string;
  readonly onSelectionChange: (value: string) => void;
}) => (
  <StudioField
    id="waste-settings-custom-recurrence-fallback"
    label={pt('settings.fields.customRecurrenceFallback')}
    description={pt('settings.messages.customRecurrenceFallbackHint')}
  >
    <Select
      id="waste-settings-custom-recurrence-fallback"
      value={selection}
      onChange={(event) => onSelectionChange(event.target.value)}
    >
      <option value="">{pt('settings.messages.customRecurrenceFallbackPlaceholder')}</option>
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </Select>
  </StudioField>
);

export const WasteSettingsCustomRecurrenceDeleteDialog = ({
  open,
  preset,
  availableFallbacks,
  initialFallback,
  onOpenChange,
  onConfirm,
}: {
  readonly open: boolean;
  readonly preset: CustomRecurrencePresetInputState | null;
  readonly availableFallbacks: readonly CustomRecurrencePresetInputState[];
  readonly initialFallback?: DeletedPresetFallbackState;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (fallback: DeletedPresetFallbackState | undefined) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const initialSelection = formatDeletedPresetFallback(initialFallback);
  const [selection, setSelection] = useState<string>(initialSelection);

  const fallbackOptions = useMemo(() => createDeletedPresetFallbackOptions(availableFallbacks, pt), [availableFallbacks, pt]);
  const resetSelection = () => setSelection(initialSelection);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelection(initialSelection);
  }, [initialSelection, open, preset?.id]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetSelection();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt('settings.messages.customRecurrenceDeleteTitle')}</DialogTitle>
          <DialogDescription>
            {pt('settings.messages.customRecurrenceDeleteDescription', { name: preset?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <DeleteFallbackField selection={selection} options={fallbackOptions} pt={pt} onSelectionChange={setSelection} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {pt('tours.actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirm(parseDeletedPresetFallback(selection))}
          >
            {pt('settings.actions.deleteCustomRecurrence')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
