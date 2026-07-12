import type { WasteCustomRecurrencePresetRecord } from '@sva/plugin-sdk';

import type { TourFormState } from './waste-management.tours.types.js';

const recurringTourRecurrences = new Set<NonNullable<TourFormState['recurrence']>>([
  'weekly',
  'biweekly',
  'fourweekly',
  'yearly',
]);

export const createTourRecurrenceSelectValue = (form: TourFormState): string =>
  form.customRecurrenceId ? `preset:${form.customRecurrenceId}` : form.recurrence;

export const shouldShowTourDateRangeFields = (form: TourFormState): boolean =>
  Boolean(form.customRecurrenceId) || recurringTourRecurrences.has(form.recurrence);

export const shouldShowTourCustomDates = (form: TourFormState): boolean =>
  !form.customRecurrenceId && form.recurrence === 'custom';

export const createTourRecurrencePatch = (
  rawValue: string,
  form: TourFormState
): Partial<TourFormState> => {
  const customRecurrenceId = rawValue.startsWith('preset:') ? rawValue.slice('preset:'.length) : '';
  const recurrence = customRecurrenceId ? '' : (rawValue as TourFormState['recurrence']);
  const keepsDateRange = Boolean(customRecurrenceId) || recurringTourRecurrences.has(recurrence);

  return {
    recurrence,
    customRecurrenceId,
    firstDate: keepsDateRange ? form.firstDate : '',
    endDate: keepsDateRange ? form.endDate : '',
    customDates: recurrence === 'custom' && !customRecurrenceId ? form.customDates : [],
  };
};

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createCustomRecurrenceOptions = (
  presets: readonly WasteCustomRecurrencePresetRecord[],
  pt: Translate
): readonly { readonly value: string; readonly label: string }[] =>
  presets.map((preset) => ({
    value: `preset:${preset.id}`,
    label: pt('tours.meta.customRecurrenceOption', {
      name: preset.name,
      days: preset.intervalDays,
    }),
  }));
