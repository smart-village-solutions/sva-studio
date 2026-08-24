import type { WasteCustomRecurrencePresetRecord } from '@sva/core';

export type WasteCustomRecurrencePresetFallback = {
  readonly kind: 'preset' | 'default';
  readonly value: string;
};

export type SaveWasteCustomRecurrencePresetsInput = {
  readonly nextItems: readonly Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>[];
  readonly deletedPresetFallbacks: Readonly<Record<string, WasteCustomRecurrencePresetFallback>>;
};
