import type { CustomRecurrencePresetInputState, DeletedPresetFallbackState } from './waste-management.settings.shared.js';

export const defaultRecurrenceFallbacks = ['weekly', 'biweekly', 'fourweekly', 'yearly', 'on-demand', 'custom'] as const;
export const customRecurrenceIntervalDayOptions = [
  ...Array.from({ length: 31 }, (_, index) => index + 1),
  35,
  42,
  49,
  56,
  63,
  70,
  77,
  84,
  91,
  98,
  112,
  182,
  365,
] as const;

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createEmptyCustomRecurrencePreset = (): CustomRecurrencePresetInputState => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  intervalDays: 1,
});

export const normalizeCustomRecurrencePresetDraft = (
  value: CustomRecurrencePresetInputState
): CustomRecurrencePresetInputState => ({
  ...value,
  name: value.name.trim(),
  description: value.description.trim(),
});

export const parseDeletedPresetFallback = (
  selection: string
): DeletedPresetFallbackState | undefined => {
  const [kind, value] = selection.split(':', 2);
  return kind && value ? ({ kind: kind as 'preset' | 'default', value } satisfies DeletedPresetFallbackState) : undefined;
};

export const formatDeletedPresetFallback = (fallback?: DeletedPresetFallbackState): string =>
  fallback ? `${fallback.kind}:${fallback.value}` : '';

export const createDeletedPresetFallbackOptions = (
  availableFallbacks: readonly CustomRecurrencePresetInputState[],
  pt: Translate
): readonly { readonly key: string; readonly label: string }[] => [
  ...availableFallbacks.map((candidate) => ({
    key: `preset:${candidate.id}`,
    label: pt('tours.meta.customRecurrenceOption', { name: candidate.name, days: candidate.intervalDays }),
  })),
  ...defaultRecurrenceFallbacks.map((candidate) => ({
    key: `default:${candidate}`,
    label: pt(`tours.recurrence.${candidate === 'on-demand' ? 'onDemand' : candidate}`),
  })),
];
