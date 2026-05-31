export type CustomRecurrencePresetInputState = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly intervalDays: number;
};

export type DeletedPresetFallbackState = {
  readonly kind: 'preset' | 'default';
  readonly value: string;
};

export type SettingsFormState = {
  readonly provider: 'supabase';
  readonly projectUrl: string;
  readonly schemaName: string;
  readonly enabled: boolean;
  readonly holidayStateCode: string;
  readonly databaseUrl: string;
  readonly serviceRoleKey: string;
  readonly customRecurrencePresets: readonly CustomRecurrencePresetInputState[];
  readonly deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>;
};
