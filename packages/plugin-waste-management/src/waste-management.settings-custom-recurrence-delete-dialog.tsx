import { useEffect, useMemo, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Select, StudioDestructiveActionDialog, StudioField } from '@sva/studio-ui-react';

import {
  createDeletedPresetFallbackOptions,
  formatDeletedPresetFallback,
  parseDeletedPresetFallback,
} from './waste-management.settings-custom-recurrence.support.js';
import type {
  CustomRecurrencePresetInputState,
  DeletedPresetFallbackState,
} from './waste-management.settings.shared.js';

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

  const fallbackOptions = useMemo(
    () => createDeletedPresetFallbackOptions(availableFallbacks, pt),
    [availableFallbacks, pt]
  );
  const resetSelection = () => setSelection(initialSelection);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelection(initialSelection);
  }, [initialSelection, open, preset?.id]);

  return (
    <StudioDestructiveActionDialog
      open={open}
      title={pt('settings.messages.customRecurrenceDeleteTitle')}
      description={pt('settings.messages.customRecurrenceDeleteDescription', {
        name: preset?.name ?? '',
      })}
      confirmLabel={pt('settings.actions.deleteCustomRecurrence')}
      pendingLabel={pt('common.deleting')}
      cancelLabel={pt('tours.actions.cancel')}
      onCancel={() => {
        resetSelection();
        onOpenChange(false);
      }}
      onConfirm={() => onConfirm(parseDeletedPresetFallback(selection))}
    >
      <DeleteFallbackField
        selection={selection}
        options={fallbackOptions}
        pt={pt}
        onSelectionChange={setSelection}
      />
    </StudioDestructiveActionDialog>
  );
};
