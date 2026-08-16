import { wasteManagementDataProfileIds } from './waste-management-data-exchange.js';
import type { WasteManagementDataProfileDefinition } from './waste-management-data-exchange.js';
import { entity, optional } from './waste-management-data-profile-builders.js';

export const wasteManagementSettingsDataProfiles = [{
  profileId: wasteManagementDataProfileIds.portableSettings,
  displayName: 'Portable Einstellungen',
  description: 'Statische Ausgabe- und fachliche Einstellungen ohne Instanz- oder Zugangsdaten.',
  formatVersion: '1.0.0',
  dependencies: [],
  formats: ['application/json'],
  entities: [entity('portableSettings', [
    optional('calendarWebUrl', 'string'), optional('pdfBrandingAssetUrl', 'string'),
    optional('pdfContactBlock', 'string'), optional('holidayStateCode', 'string'),
    { key: 'instanceId', transfer: 'intentionally-excluded', reason: 'instance-identity' },
    { key: 'provider', transfer: 'intentionally-excluded', reason: 'credential' },
    { key: 'schemaName', transfer: 'intentionally-excluded', reason: 'credential' },
    { key: 'databaseUrlConfigured', transfer: 'intentionally-excluded', reason: 'credential' },
    { key: 'selectedInterfaceId', transfer: 'intentionally-excluded', reason: 'instance-identity' },
    { key: 'selectedInterfaceName', transfer: 'intentionally-excluded', reason: 'instance-identity' },
    { key: 'selectedInterfaceTypeKey', transfer: 'intentionally-excluded', reason: 'instance-identity' },
    { key: 'availableInterfaces', transfer: 'intentionally-excluded', reason: 'instance-identity' },
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
    { key: 'lastSuccessfulHolidaySyncAt', transfer: 'intentionally-excluded', reason: 'audit-data' },
    { key: 'updatedAt', transfer: 'intentionally-excluded', reason: 'target-managed-timestamp' },
    { key: 'customRecurrencePresets', transfer: 'intentionally-excluded', reason: 'legacy-source' },
  ])],
}] as const satisfies readonly WasteManagementDataProfileDefinition[];

export const wasteManagementExcludedDataDomains = [
  { entityType: 'emailReminderSubscription', fields: ['*'], reason: 'email-subscription-data' },
  { entityType: 'emailReminderSubscriptionItem', fields: ['*'], reason: 'email-subscription-data' },
  { entityType: 'emailReminderOutbox', fields: ['*'], reason: 'email-subscription-data' },
] as const;
