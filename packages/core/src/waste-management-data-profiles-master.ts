import { wasteManagementDataProfileIds } from './waste-management-data-exchange.js';
import type { WasteManagementDataProfileDefinition } from './waste-management-data-exchange.js';
import {
  defaultable,
  entity,
  excludedTargetTimestamps,
  optional,
  reference,
  required,
} from './waste-management-data-profile-builders.js';

export const wasteManagementMasterDataProfiles = [
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
      entity('region', [required('id', 'string'), required('name', 'string'), ...excludedTargetTimestamps]),
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
] as const satisfies readonly WasteManagementDataProfileDefinition[];
