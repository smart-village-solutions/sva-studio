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
  readonly provider: 'postgresql';
  readonly schemaName: string;
  readonly enabled: boolean;
  readonly selectedInterfaceId: string;
  readonly calendarWebUrl: string;
  readonly pdfBrandingAssetUrl: string;
  readonly pdfContactBlock: string;
  readonly holidayStateCode: string;
  readonly customRecurrencePresets: readonly CustomRecurrencePresetInputState[];
  readonly deletedPresetFallbacks: Readonly<Record<string, DeletedPresetFallbackState>>;
};
