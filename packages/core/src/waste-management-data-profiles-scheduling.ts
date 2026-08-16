import { wasteManagementDataProfileIds } from './waste-management-data-exchange.js';
import type { WasteManagementDataProfileDefinition } from './waste-management-data-exchange.js';
import {
  defaultable,
  entity,
  excludedTargetTimestamps,
  optional,
  optionalEnum,
  optionalStructured,
  reference,
  required,
  requiredEnum,
  requiredNonEmptyStringArray,
} from './waste-management-data-profile-builders.js';
import { wasteManagementMasterDataContract } from './waste-management/master-data-contract.js';
import {
  wasteHolidayRuleConfigurationStatuses,
  wasteHolidayRuleConflictStatuses,
  wasteHolidayRuleSourceStatuses,
} from './waste-management/master-data-holiday-rule-status.js';
import { wasteTourRecurrences } from './waste-management/master-data-tours.js';

export const wasteManagementSchedulingDataProfiles = [
  {
    profileId: wasteManagementDataProfileIds.tours,
    displayName: 'Touren',
    description: 'Tourstammdaten, Wiederholungen, Gültigkeit und individuelle Termine.',
    formatVersion: '1.0.0',
    dependencies: [wasteManagementDataProfileIds.fractions, wasteManagementDataProfileIds.recurrencePresets],
    formats: ['application/json'],
    entities: [entity('tour', [
      required('id', 'string'), required('name', 'string'), optional('description', 'string'),
      reference(requiredNonEmptyStringArray('wasteFractionIds'), 'fraction', true),
      optionalEnum('recurrence', wasteTourRecurrences), reference(optional('customRecurrenceId', 'string'), 'recurrencePreset'),
      optional('customRecurrenceName', 'string'), optional('customRecurrenceIntervalDays', 'integer'),
      optional('firstDate', 'date'), optional('endDate', 'date'),
      optionalStructured('customDates', 'custom-tour-dates'),
      defaultable('active', 'boolean', true),
      { key: 'locationCount', transfer: 'intentionally-excluded', reason: 'derived-value' },
      ...excludedTargetTimestamps,
    ])],
  },
  {
    profileId: wasteManagementDataProfileIds.locationTourLinks,
    displayName: 'Abholort–Tour-Zuordnungen',
    description: 'Direkte Zuordnung von Abholorten zu Touren.',
    formatVersion: '1.0.0',
    dependencies: [wasteManagementDataProfileIds.geographyCollectionLocations, wasteManagementDataProfileIds.tours],
    formats: ['application/json'],
    entities: [entity('locationTourLink', [
      required('id', 'string'), reference(required('locationId', 'string'), 'collectionLocation'),
      reference(required('tourId', 'string'), 'tour'), ...excludedTargetTimestamps,
    ])],
  },
  {
    profileId: wasteManagementDataProfileIds.tourAssignments,
    displayName: 'Tour-Einsätze',
    description: 'Terminierte Tour-Einsätze mit einer oder mehreren Abholortreferenzen.',
    formatVersion: '1.0.0',
    dependencies: [wasteManagementDataProfileIds.geographyCollectionLocations, wasteManagementDataProfileIds.tours],
    formats: ['application/json'],
    entities: [
      entity('tourAssignment', [
        required('id', 'string'), reference(required('tourId', 'string'), 'tour'),
        required('pickupDate', 'date'), optional('note', 'string'),
        reference(requiredNonEmptyStringArray('locationIds'), 'collectionLocation', true),
        ...excludedTargetTimestamps,
      ]),
      entity('locationTourPickupDate', [{ key: '*', transfer: 'intentionally-excluded', reason: 'legacy-source' }]),
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
        required('id', 'string'), required('originalDate', 'date'), required('actualDate', 'date'),
        defaultable('hasYear', 'boolean', true), optionalEnum('reasonType', wasteManagementMasterDataContract.dateShiftReasonTypes), optional('reasonKey', 'string'),
        optional('description', 'string'), reference(optional('tourIds', 'string-array'), 'tour', true),
        ...excludedTargetTimestamps,
      ]),
      entity('tourDateShift', [
        required('id', 'string'), reference(required('tourId', 'string'), 'tour'),
        required('originalDate', 'date'), required('actualDate', 'date'), defaultable('hasYear', 'boolean', true),
        optionalEnum('reasonType', wasteManagementMasterDataContract.dateShiftReasonTypes), optional('reasonKey', 'string'), optionalEnum('followUpMode', wasteManagementMasterDataContract.followUpModes),
        optional('description', 'string'), ...excludedTargetTimestamps,
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
    entities: [entity('holidayRule', [
      required('id', 'string'), required('holidayDate', 'date'), required('holidayName', 'string'),
      required('year', 'integer'), requiredEnum('stateCode', wasteManagementMasterDataContract.holidayStateCodes),
      requiredEnum('sourceStatus', wasteHolidayRuleSourceStatuses),
      requiredEnum('configurationStatus', wasteHolidayRuleConfigurationStatuses),
      requiredEnum('conflictStatus', wasteHolidayRuleConflictStatuses),
      optionalEnum('scope', wasteManagementMasterDataContract.holidayRuleScopes),
      optionalEnum('strategy', wasteManagementMasterDataContract.holidayRuleStrategies), ...excludedTargetTimestamps,
    ])],
  },
] as const satisfies readonly WasteManagementDataProfileDefinition[];
