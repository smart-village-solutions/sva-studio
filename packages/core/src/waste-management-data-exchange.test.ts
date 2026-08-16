import { describe, expect, it } from 'vitest';

import {
  wasteManagementDataProfileIds,
} from './waste-management-data-exchange.js';
import {
  wasteManagementDataProfiles,
  wasteManagementExcludedDataDomains,
} from './waste-management-data-profiles.js';

const modelFields = {
  fraction: [
    'id',
    'name',
    'pdfShortLabel',
    'translations',
    'containerSize',
    'color',
    'description',
    'active',
    'reminderConfig',
    'createdAt',
    'updatedAt',
  ],
  region: ['id', 'name', 'createdAt', 'updatedAt'],
  city: ['id', 'name', 'postalCode', 'regionId', 'createdAt', 'updatedAt'],
  street: ['id', 'name', 'cityId', 'createdAt', 'updatedAt'],
  houseNumber: ['id', 'number', 'streetId', 'createdAt', 'updatedAt'],
  collectionLocation: [
    'id',
    'cityId',
    'regionId',
    'streetId',
    'houseNumberId',
    'active',
    'createdAt',
    'updatedAt',
  ],
  recurrencePreset: ['id', 'name', 'description', 'intervalDays', 'createdAt', 'updatedAt'],
  tour: [
    'id',
    'name',
    'description',
    'wasteFractionIds',
    'recurrence',
    'customRecurrenceId',
    'customRecurrenceName',
    'customRecurrenceIntervalDays',
    'firstDate',
    'endDate',
    'customDates',
    'active',
    'locationCount',
    'createdAt',
    'updatedAt',
  ],
  locationTourLink: ['id', 'locationId', 'tourId', 'createdAt', 'updatedAt'],
  tourAssignment: ['id', 'tourId', 'pickupDate', 'note', 'locationIds', 'createdAt', 'updatedAt'],
  locationTourPickupDate: ['*'],
  globalDateShift: [
    'id',
    'originalDate',
    'actualDate',
    'hasYear',
    'reasonType',
    'reasonKey',
    'description',
    'tourIds',
    'createdAt',
    'updatedAt',
  ],
  tourDateShift: [
    'id',
    'tourId',
    'originalDate',
    'actualDate',
    'hasYear',
    'reasonType',
    'reasonKey',
    'followUpMode',
    'description',
    'createdAt',
    'updatedAt',
  ],
  holidayRule: [
    'id',
    'holidayDate',
    'holidayName',
    'year',
    'stateCode',
    'sourceStatus',
    'configurationStatus',
    'conflictStatus',
    'scope',
    'strategy',
    'createdAt',
    'updatedAt',
  ],
  portableSettings: [
    'instanceId',
    'provider',
    'schemaName',
    'enabled',
    'selectedInterfaceId',
    'selectedInterfaceName',
    'selectedInterfaceTypeKey',
    'availableInterfaces',
    'calendarWebUrl',
    'pdfBrandingAssetUrl',
    'pdfContactBlock',
    'emailReminderConfig',
    'databaseUrlConfigured',
    'visibleStatus',
    'provisioningStatus',
    'provisioningErrorCode',
    'provisioningUpdatedAt',
    'lastCheckedAt',
    'lastCheckStatus',
    'lastCheckErrorCode',
    'lastCheckErrorMessage',
    'holidayStateCode',
    'lastHolidaySyncStatus',
    'lastSuccessfulHolidaySyncAt',
    'updatedAt',
    'customRecurrencePresets',
  ],
} as const;

describe('wasteManagementDataProfiles', () => {
  it('classifies every field in the transferable Waste model', () => {
    const entities = new Map(
      wasteManagementDataProfiles.flatMap((profile) =>
        profile.entities.map((definition) => [definition.entityType, definition] as const)
      )
    );

    for (const [entityType, fields] of Object.entries(modelFields)) {
      expect(
        entities
          .get(entityType)
          ?.fields.map((field) => field.key)
          .toSorted(),
        `unclassified fields for ${entityType}`
      ).toEqual([...fields].sort());
    }
  });

  it('offers canonical JSON for every individual profile', () => {
    expect(wasteManagementDataProfiles.map((profile) => profile.profileId)).toEqual(
      Object.values(wasteManagementDataProfileIds)
    );
    expect(
      wasteManagementDataProfiles.every((profile) => profile.formats.includes('application/json'))
    ).toBe(true);
  });

  it('keeps all e-mail subscription and outbox domains explicitly excluded', () => {
    expect(wasteManagementExcludedDataDomains).toEqual([
      expect.objectContaining({ entityType: 'emailReminderSubscription', fields: ['*'] }),
      expect.objectContaining({ entityType: 'emailReminderSubscriptionItem', fields: ['*'] }),
      expect.objectContaining({ entityType: 'emailReminderOutbox', fields: ['*'] }),
    ]);
  });
});
