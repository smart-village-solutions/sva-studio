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

export type WasteManagementDataFieldInput =
  | { readonly kind: 'required' }
  | { readonly kind: 'optional'; readonly nullable: boolean }
  | { readonly kind: 'defaultable'; readonly defaultValue: unknown };

export type WasteManagementIncludedFieldDefinition = {
  readonly key: string;
  readonly valueType: WasteManagementDataFieldValueType;
  readonly transfer: 'included';
  readonly input: WasteManagementDataFieldInput;
  readonly references?: Readonly<{
    entityType: string;
    many?: boolean;
  }>;
};

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

const required = (key: string, valueType: WasteManagementDataFieldValueType) =>
  ({ key, valueType, transfer: 'included', input: { kind: 'required' } }) as const;

const optional = (key: string, valueType: WasteManagementDataFieldValueType, nullable = true) =>
  ({ key, valueType, transfer: 'included', input: { kind: 'optional', nullable } }) as const;

const defaultable = (
  key: string,
  valueType: WasteManagementDataFieldValueType,
  defaultValue: unknown
) =>
  ({ key, valueType, transfer: 'included', input: { kind: 'defaultable', defaultValue } }) as const;

const reference = (
  field: WasteManagementIncludedFieldDefinition,
  entityType: string,
  many = false
): WasteManagementIncludedFieldDefinition => ({ ...field, references: { entityType, many } });

const excludedTargetTimestamps = [
  {
    key: 'createdAt',
    transfer: 'intentionally-excluded',
    reason: 'target-managed-timestamp',
  },
  {
    key: 'updatedAt',
    transfer: 'intentionally-excluded',
    reason: 'target-managed-timestamp',
  },
] as const satisfies readonly WasteManagementExcludedFieldDefinition[];

const entity = (
  entityType: string,
  fields: readonly WasteManagementDataFieldDefinition[]
): WasteManagementDataEntityDefinition => ({ entityType, fields });

export const wasteManagementDataProfiles = [
  {
    profileId: wasteManagementDataProfileIds.fractions,
    displayName: 'Fraktionen',
    description: 'Fraktionsstammdaten einschließlich fachlicher Reminder-Konfiguration.',
    formatVersion: '1.0.0',
    dependencies: [],
    formats: ['application/json'],
    entities: [
      entity('fraction', [
        required('id', 'string'),
        required('name', 'string'),
        optional('pdfShortLabel', 'string'),
        optional('translations', 'object'),
        optional('containerSize', 'string'),
        required('color', 'string'),
        optional('description', 'string'),
        defaultable('active', 'boolean', true),
        defaultable('reminderConfig', 'object', {
          reminderCount: 'none',
          channels: { push: false, email: false, calendar: false },
        }),
        ...excludedTargetTimestamps,
      ]),
    ],
  },
  {
    profileId: wasteManagementDataProfileIds.geographyCollectionLocations,
    displayName: 'Geografie und Abholorte',
    description: 'Regionen, Orte, Straßen, Hausnummern und Abholorte mit stabilen Referenzen.',
    formatVersion: '1.0.0',
    dependencies: [],
    formats: ['application/json'],
    entities: [
      entity('region', [
        required('id', 'string'),
        required('name', 'string'),
        ...excludedTargetTimestamps,
      ]),
      entity('city', [
        required('id', 'string'),
        required('name', 'string'),
        optional('postalCode', 'string'),
        reference(optional('regionId', 'string'), 'region'),
        ...excludedTargetTimestamps,
      ]),
      entity('street', [
        required('id', 'string'),
        required('name', 'string'),
        reference(required('cityId', 'string'), 'city'),
        ...excludedTargetTimestamps,
      ]),
      entity('houseNumber', [
        required('id', 'string'),
        required('number', 'string'),
        reference(required('streetId', 'string'), 'street'),
        ...excludedTargetTimestamps,
      ]),
      entity('collectionLocation', [
        required('id', 'string'),
        reference(required('cityId', 'string'), 'city'),
        reference(optional('regionId', 'string'), 'region'),
        reference(optional('streetId', 'string'), 'street'),
        reference(optional('houseNumberId', 'string'), 'houseNumber'),
        defaultable('active', 'boolean', true),
        ...excludedTargetTimestamps,
      ]),
    ],
  },
  {
    profileId: wasteManagementDataProfileIds.recurrencePresets,
    displayName: 'Abstandspresets',
    description: 'Benutzerdefinierte Wiederholungsabstände für Touren.',
    formatVersion: '1.0.0',
    dependencies: [],
    formats: ['application/json'],
    entities: [
      entity('recurrencePreset', [
        required('id', 'string'),
        required('name', 'string'),
        optional('description', 'string'),
        required('intervalDays', 'integer'),
        ...excludedTargetTimestamps,
      ]),
    ],
  },
  {
    profileId: wasteManagementDataProfileIds.tours,
    displayName: 'Touren',
    description: 'Tourstammdaten, Wiederholungen, Gültigkeit und individuelle Termine.',
    formatVersion: '1.0.0',
    dependencies: [
      wasteManagementDataProfileIds.fractions,
      wasteManagementDataProfileIds.recurrencePresets,
    ],
    formats: ['application/json'],
    entities: [
      entity('tour', [
        required('id', 'string'),
        required('name', 'string'),
        optional('description', 'string'),
        reference(required('wasteFractionIds', 'string-array'), 'fraction', true),
        optional('recurrence', 'string'),
        reference(optional('customRecurrenceId', 'string'), 'recurrencePreset'),
        optional('customRecurrenceName', 'string'),
        optional('customRecurrenceIntervalDays', 'integer'),
        optional('firstDate', 'date'),
        optional('endDate', 'date'),
        optional('customDates', 'object'),
        defaultable('active', 'boolean', true),
        {
          key: 'locationCount',
          transfer: 'intentionally-excluded',
          reason: 'derived-value',
        },
        ...excludedTargetTimestamps,
      ]),
    ],
  },
  {
    profileId: wasteManagementDataProfileIds.locationTourLinks,
    displayName: 'Abholort–Tour-Zuordnungen',
    description: 'Direkte Zuordnung von Abholorten zu Touren.',
    formatVersion: '1.0.0',
    dependencies: [
      wasteManagementDataProfileIds.geographyCollectionLocations,
      wasteManagementDataProfileIds.tours,
    ],
    formats: ['application/json'],
    entities: [
      entity('locationTourLink', [
        required('id', 'string'),
        reference(required('locationId', 'string'), 'collectionLocation'),
        reference(required('tourId', 'string'), 'tour'),
        ...excludedTargetTimestamps,
      ]),
    ],
  },
  {
    profileId: wasteManagementDataProfileIds.tourAssignments,
    displayName: 'Tour-Einsätze',
    description: 'Terminierte Tour-Einsätze mit einer oder mehreren Abholortreferenzen.',
    formatVersion: '1.0.0',
    dependencies: [
      wasteManagementDataProfileIds.geographyCollectionLocations,
      wasteManagementDataProfileIds.tours,
    ],
    formats: ['application/json'],
    entities: [
      entity('tourAssignment', [
        required('id', 'string'),
        reference(required('tourId', 'string'), 'tour'),
        required('pickupDate', 'date'),
        optional('note', 'string'),
        reference(required('locationIds', 'string-array'), 'collectionLocation', true),
        ...excludedTargetTimestamps,
      ]),
      entity('locationTourPickupDate', [
        { key: '*', transfer: 'intentionally-excluded', reason: 'legacy-source' },
      ]),
    ],
  },
  {
    profileId: wasteManagementDataProfileIds.dateShifts,
    displayName: 'Ausweichtermine',
    description: 'Globale und tourbezogene Terminverschiebungen.',
    formatVersion: '1.0.0',
    dependencies: [wasteManagementDataProfileIds.tours],
    formats: ['application/json'],
    entities: [
      entity('globalDateShift', [
        required('id', 'string'),
        required('originalDate', 'date'),
        required('actualDate', 'date'),
        defaultable('hasYear', 'boolean', true),
        optional('reasonType', 'string'),
        optional('reasonKey', 'string'),
        optional('description', 'string'),
        reference(optional('tourIds', 'string-array'), 'tour', true),
        ...excludedTargetTimestamps,
      ]),
      entity('tourDateShift', [
        required('id', 'string'),
        reference(required('tourId', 'string'), 'tour'),
        required('originalDate', 'date'),
        required('actualDate', 'date'),
        defaultable('hasYear', 'boolean', true),
        optional('reasonType', 'string'),
        optional('reasonKey', 'string'),
        optional('followUpMode', 'string'),
        optional('description', 'string'),
        ...excludedTargetTimestamps,
      ]),
    ],
  },
  {
    profileId: wasteManagementDataProfileIds.holidayRules,
    displayName: 'Feiertagsregeln',
    description: 'Mandantenspezifische fachliche Feiertagsregeln.',
    formatVersion: '1.0.0',
    dependencies: [],
    formats: ['application/json'],
    entities: [
      entity('holidayRule', [
        required('id', 'string'),
        required('holidayDate', 'date'),
        required('holidayName', 'string'),
        required('year', 'integer'),
        required('stateCode', 'string'),
        required('sourceStatus', 'string'),
        required('configurationStatus', 'string'),
        required('conflictStatus', 'string'),
        optional('scope', 'string'),
        optional('strategy', 'string'),
        ...excludedTargetTimestamps,
      ]),
    ],
  },
  {
    profileId: wasteManagementDataProfileIds.portableSettings,
    displayName: 'Portable Einstellungen',
    description: 'Statische Ausgabe- und fachliche Einstellungen ohne Instanz- oder Zugangsdaten.',
    formatVersion: '1.0.0',
    dependencies: [],
    formats: ['application/json'],
    entities: [
      entity('portableSettings', [
        optional('calendarWebUrl', 'string'),
        optional('pdfBrandingAssetUrl', 'string'),
        optional('pdfContactBlock', 'string'),
        optional('holidayStateCode', 'string'),
        { key: 'instanceId', transfer: 'intentionally-excluded', reason: 'instance-identity' },
        { key: 'provider', transfer: 'intentionally-excluded', reason: 'credential' },
        { key: 'schemaName', transfer: 'intentionally-excluded', reason: 'credential' },
        { key: 'databaseUrlConfigured', transfer: 'intentionally-excluded', reason: 'credential' },
        {
          key: 'selectedInterfaceId',
          transfer: 'intentionally-excluded',
          reason: 'instance-identity',
        },
        {
          key: 'selectedInterfaceName',
          transfer: 'intentionally-excluded',
          reason: 'instance-identity',
        },
        {
          key: 'selectedInterfaceTypeKey',
          transfer: 'intentionally-excluded',
          reason: 'instance-identity',
        },
        {
          key: 'availableInterfaces',
          transfer: 'intentionally-excluded',
          reason: 'instance-identity',
        },
        { key: 'enabled', transfer: 'intentionally-excluded', reason: 'instance-identity' },
        { key: 'emailReminderConfig', transfer: 'intentionally-excluded', reason: 'credential' },
        { key: 'visibleStatus', transfer: 'intentionally-excluded', reason: 'instance-identity' },
        { key: 'provisioningStatus', transfer: 'intentionally-excluded', reason: 'job-data' },
        { key: 'provisioningErrorCode', transfer: 'intentionally-excluded', reason: 'job-data' },
        { key: 'provisioningUpdatedAt', transfer: 'intentionally-excluded', reason: 'job-data' },
        { key: 'lastCheckedAt', transfer: 'intentionally-excluded', reason: 'audit-data' },
        { key: 'lastCheckStatus', transfer: 'intentionally-excluded', reason: 'audit-data' },
        { key: 'lastCheckErrorCode', transfer: 'intentionally-excluded', reason: 'audit-data' },
        { key: 'lastCheckErrorMessage', transfer: 'intentionally-excluded', reason: 'audit-data' },
        { key: 'lastHolidaySyncStatus', transfer: 'intentionally-excluded', reason: 'audit-data' },
        {
          key: 'lastSuccessfulHolidaySyncAt',
          transfer: 'intentionally-excluded',
          reason: 'audit-data',
        },
        {
          key: 'updatedAt',
          transfer: 'intentionally-excluded',
          reason: 'target-managed-timestamp',
        },
        {
          key: 'customRecurrencePresets',
          transfer: 'intentionally-excluded',
          reason: 'legacy-source',
        },
      ]),
    ],
  },
] as const satisfies readonly WasteManagementDataProfileDefinition[];

export const wasteManagementExcludedDataDomains = [
  {
    entityType: 'emailReminderSubscription',
    fields: ['*'],
    reason: 'email-subscription-data',
  },
  {
    entityType: 'emailReminderSubscriptionItem',
    fields: ['*'],
    reason: 'email-subscription-data',
  },
  {
    entityType: 'emailReminderOutbox',
    fields: ['*'],
    reason: 'email-subscription-data',
  },
] as const;

export const getWasteManagementDataProfile = (
  profileId: WasteManagementDataProfileId
): WasteManagementDataProfileDefinition | undefined =>
  wasteManagementDataProfiles.find((profile) => profile.profileId === profileId);
