export const wasteManagementDataProfileIds = {
  fractions: 'waste-management.fraktionen',
  geographyCollectionLocations: 'waste-management.geografie-abholorte',
  recurrencePresets: 'waste-management.abstandspresets',
  tours: 'waste-management.touren',
  locationTourLinks: 'waste-management.abholort-tour-zuordnungen',
  tourAssignments: 'waste-management.tour-einsaetze',
  dateShifts: 'waste-management.ausweichtermine',
  holidayRules: 'waste-management.feiertagsregeln',
  portableSettings: 'waste-management.portable-einstellungen',
} as const;

export type WasteManagementDataProfileId =
  (typeof wasteManagementDataProfileIds)[keyof typeof wasteManagementDataProfileIds];

export type WasteManagementDataFieldValueType =
  'boolean' | 'date' | 'integer' | 'number' | 'object' | 'string' | 'string-array';

export type WasteManagementStructuredFieldShape =
  | 'custom-tour-dates'
  | 'fraction-reminder-config'
  | 'localized-text';

export type WasteManagementDataFieldInput =
  | { readonly kind: 'required' }
  | { readonly kind: 'optional'; readonly nullable: boolean }
  | { readonly kind: 'defaultable'; readonly defaultValue: unknown };

type WasteManagementIncludedFieldDefinitionBase = {
  readonly key: string;
  readonly transfer: 'included';
  readonly input: WasteManagementDataFieldInput;
  readonly references?: Readonly<{ entityType: string; many?: boolean }>;
};

export type WasteManagementIncludedFieldDefinition =
  WasteManagementIncludedFieldDefinitionBase &
    (
      | {
          readonly valueType: 'object';
          readonly structuredShape: WasteManagementStructuredFieldShape;
          readonly allowedValues?: never;
        }
      | {
          readonly valueType: 'string';
          readonly allowedValues?: readonly string[];
          readonly structuredShape?: never;
        }
      | {
          readonly valueType: 'string-array';
          readonly allowedValues?: never;
          readonly structuredShape?: never;
          readonly minItems?: number;
          readonly minItemLength?: number;
        }
      | {
          readonly valueType: Exclude<WasteManagementDataFieldValueType, 'object' | 'string' | 'string-array'>;
          readonly allowedValues?: never;
          readonly structuredShape?: never;
          readonly minItems?: never;
          readonly minItemLength?: never;
        }
    );

export type WasteManagementExcludedFieldDefinition = {
  readonly key: string;
  readonly transfer: 'intentionally-excluded';
  readonly reason:
    | 'audit-data'
    | 'credential'
    | 'derived-value'
    | 'email-subscription-data'
    | 'instance-identity'
    | 'job-data'
    | 'legacy-source'
    | 'target-managed-timestamp';
};

export type WasteManagementDataFieldDefinition =
  WasteManagementIncludedFieldDefinition | WasteManagementExcludedFieldDefinition;

export type WasteManagementDataEntityDefinition = {
  readonly entityType: string;
  readonly fields: readonly WasteManagementDataFieldDefinition[];
};

export type WasteManagementDataProfileDefinition = {
  readonly profileId: WasteManagementDataProfileId;
  readonly displayName: string;
  readonly description: string;
  readonly formatVersion: '1.0.0';
  readonly dependencies: readonly WasteManagementDataProfileId[];
  readonly formats: readonly ['application/json'];
  readonly entities: readonly WasteManagementDataEntityDefinition[];
};

export type WasteManagementDataExchangeRecord = Readonly<{
  entityType: string;
  [field: string]: unknown;
}>;

export type WasteManagementDataExchangeEnvelope = Readonly<{
  formatVersion: '1.0.0';
  pluginId: 'waste-management';
  profileId: WasteManagementDataProfileId;
  exportedAt: string;
  records: readonly WasteManagementDataExchangeRecord[];
}>;
