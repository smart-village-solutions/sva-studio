import { useMemo, useState } from 'react';
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

import type { CustomRecurrencePresetInputState, DeletedPresetFallbackState } from './waste-management.settings-form.js';

const defaultRecurrenceFallbacks = ['weekly', 'biweekly', 'fourweekly', 'yearly', 'on-demand', 'custom'] as const;

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
  const [selection, setSelection] = useState<string>(
    initialFallback ? `${initialFallback.kind}:${initialFallback.value}` : ''
  );

  const fallbackOptions = useMemo(
    () => [
      ...availableFallbacks.map((candidate) => ({
        key: `preset:${candidate.id}`,
        label: pt('tours.meta.customRecurrenceOption', { name: candidate.name, days: candidate.intervalDays }),
      })),
      ...defaultRecurrenceFallbacks.map((candidate) => ({
        key: `default:${candidate}`,
        label: pt(`tours.recurrence.${candidate === 'on-demand' ? 'onDemand' : candidate}`),
      })),
    ],
    [availableFallbacks, pt]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelection(initialFallback ? `${initialFallback.kind}:${initialFallback.value}` : '');
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

        <StudioField
          id="waste-settings-custom-recurrence-fallback"
          label={pt('settings.fields.customRecurrenceFallback')}
          description={pt('settings.messages.customRecurrenceFallbackHint')}
        >
          <Select
            id="waste-settings-custom-recurrence-fallback"
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
          >
            <option value="">{pt('settings.messages.customRecurrenceFallbackPlaceholder')}</option>
            {fallbackOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </Select>
        </StudioField>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {pt('tours.actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              const [kind, value] = selection.split(':', 2);
              onConfirm(kind && value ? ({ kind: kind as 'preset' | 'default', value } satisfies DeletedPresetFallbackState) : undefined);
            }}
          >
            {pt('settings.actions.deleteCustomRecurrence')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
