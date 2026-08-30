export * from './public-api-contracts.js';
export {
  isWasteTourValidityApplicable,
  resolveEffectiveWasteTourDateShiftsForYear,
  resolveWasteTourValidityDates,
  wasteManagementImportCatalog,
  wasteManagementMasterDataContract,
  wasteManagementOperationsContract,
} from '@sva/core';
export type {
  ApiItemResponse,
  IamContentHistoryEntry,
  IamContentStatus,
  StudioJobDetail,
  StudioJobResponse,
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteCustomRecurrencePresetRecord,
  WasteCustomTourDate,
  WasteDateShiftReasonType,
  WasteFractionReminderChannel,
  WasteFractionReminderChannelConfig,
  WasteFractionReminderChannels,
  WasteFractionReminderCount,
  WasteFractionReminderConfig,
  WasteFractionReminderSlot,
  WasteFractionRecord,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteHolidayRuleScope,
  WasteHolidayRuleStrategy,
  WasteHolidayStateCode,
  WasteHolidaySyncStatus,
  WasteHouseNumberRecord,
  WasteLocalizedTextRecord,
  WasteLocationTourPickupDateImportPreview,
  WasteLocationTourPickupDateRecord,
  WasteLocationTourLinkBulkCreateResult,
  WasteLocationTourLinkRecord,
  WasteManagementCsvDelimiter,
  WasteManagementApplyMigrationsJobInput,
  WasteManagementHistoryOverview,
  WasteManagementImportJobInput,
  WasteManagementImportProfileCatalogEntry,
  WasteManagementImportSourceFormat,
  WasteManagementInitializeJobInput,
  WasteManagementJobInput,
  WasteManagementMaterializeEmailRemindersJobInput,
  WasteManagementMasterDataOverview,
  WasteManagementProcessEmailReminderOutboxJobInput,
  WasteManagementProvisionTenantDatabaseJobInput,
  WasteManagementResetJobInput,
  WasteManagementSeedJobInput,
  WasteManagementSyncMainserverJobInput,
  WasteManagementSyncWasteTypesJobInput,
  WasteManagementEmailReminderConfig,
  WasteManagementSettingsInterfaceOption,
  WasteManagementSettingsRecord,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourDateShiftFollowUpMode,
  WasteTourDateShiftRecord,
  WasteTourAssignmentRecord,
  WasteTourRecord,
  WasteTourRecurrence,
  WasteTourValidityBulkUpdateInput,
  WasteTourValidityBulkUpdateResult,
  WasteTourValidityDateOperation,
} from '@sva/core';
export type * from './waste-annual-tour-transfer.js';
export type { BuildTimeRegistry, BuildTimeRegistryInput } from './build-time-registry.js';
export { createBuildTimeRegistry } from './build-time-registry.js';
export type { PluginGuardrailViolationCode, PluginGuardrailViolationInput } from './guardrails.js';
export {
  assertPluginContributionAllowedKeys,
  assertPluginRoutePathAllowed,
  createPluginContributionGuardrailError,
  createPluginGuardrailError,
  pluginGuardrailViolationCodes,
} from './guardrails.js';
export type {
  AdminResourceDefinition,
  AdminResourceBulkActionSelectionMode,
  AdminResourceCapabilities,
  AdminResourceDetailCapabilities,
  AdminResourceGuard,
  AdminResourceListBulkActionCapability,
  AdminResourceListCapabilities,
  AdminResourceListFilterCapability,
  AdminResourceListFilterOption,
  AdminResourceListPaginationCapability,
  AdminResourceListSearchCapability,
  AdminResourceListSortingCapability,
  AdminResourceViewDefinition,
  AdminResourceViewAccessRequirements,
  AdminResourceViews,
} from './admin-resources.js';
export {
  createAdminResourceRegistry,
  definePluginAdminResources,
  mergeAdminResourceDefinitions,
} from './admin-resources.js';
export type { MediaPickerDefinition, MediaPickerSelectionMode } from './media-picker.js';
export { defineMediaPickerDefinition } from './media-picker.js';
export type { ContentMediaUploadPhase, HostMediaFieldOption } from './content-ui-utils.js';
// prettier-ignore
export {
  compactOptionalString, contentMediaUploadPhaseMessageKey, formatDateTimeInEditorTimeZone,
  formatTechnicalDateTimeInEditorTimeZone, findHostMediaReferenceAssetId, fromDatetimeLocalValue,
  getHostMediaAssetPersistentUrl, isSupportedContentMediaUploadFile, readHostMediaAssetCopyright,
  readHostMediaAssetFileName, readHostMediaAssetTitle, resolveEditorLocale, toDatetimeLocalValue, toHostMediaFieldOptions,
} from './content-ui-utils.js';
export { readFieldError } from './form-errors.js';
export type {
  MapGeocodingAddressInput,
  MapGeocodingCoordinates,
  MapGeocodingFeature,
  MapGeocodingProvider,
  MapGeocodingRuntimeConfig,
} from './map-geocoding.js';
export {
  MapGeocodingClientError,
  geocodeHostMapAddress,
  getHostMapGeocodingConfig,
  reverseGeocodeHostCoordinates,
  suggestHostMapAddresses,
} from './map-geocoding-client.js';
export type {
  MainserverCrudClientOptions,
  MainserverActingPrincipalType,
  MainserverErrorFactory,
  MainserverListQuery,
  MainserverMutationOptions,
} from './mainserver-client.js';
export {
  omitDeviatedMainserverFields,
  type MainserverDataDeviation,
  type MainserverDetailResult,
} from './mainserver-detail.js';
export {
  buildMainserverListUrl,
  createMainserverCrudClient,
  createMainserverJsonRequestHeaders,
  createMainserverMutationHeaders,
  createMainserverReadHeaders,
  CONTENT_MEDIA_SAVE_OPERATION_ID_HEADER,
  MainserverApiError,
  requestMainserverJson,
} from './mainserver-client.js';
export { fetchIamContentHistory } from './content-history-client.js';
export type {
  ContentTypeActionDefinition,
  ContentTypeDefinition,
  ContentTypeEditorFieldDefinition,
  ContentTypeEditorFieldKind,
  ContentTypeListColumnDefinition,
  RegisteredStudioContentType,
  StudioContentTypeDefinition,
} from './content-types.js';
export {
  collectRegisteredStudioContentTypes,
  createContentTypeRegistry,
  definePluginContentTypes,
  genericContentTypeDefinition,
  getContentTypeDefinition,
  resolveStudioContentDetailPath,
} from './content-types.js';
export {
  createMainserverGenericTypeRegistry,
  defineMainserverGenericItemOwnership,
  resolveMainserverGenericItemContentType,
} from './mainserver-generic-type-registry.js';
export type { MainserverGenericItemOwnershipDefinition } from './mainserver-generic-type-registry.js';
export type {
  PluginActionDefinition,
  PluginActionRegistryEntry,
  PluginAccessTransitionDiagnostic,
  PluginAdminResourceDefinition,
  PluginAuditEventDefinition,
  PluginAuditEventRegistryEntry,
  PluginContentHistoryContract,
  PluginDefinition,
  PluginModuleIamContract,
  PluginModuleIamRegistryEntry,
  PluginModuleIamSystemRoleDefinition,
  PluginNavigationItem,
  PluginNavigationSection,
  PluginPermissionDefinition,
  PluginPermissionRegistryEntry,
  PluginRouteDefinition,
  PluginRouteGuard,
  PluginServerHandlerDefinition,
  PluginServerHandlerRegistryEntry,
  PluginTranslations,
} from './plugins.js';
export {
  createPluginActionRegistry,
  collectPluginAccessTransitionDiagnostics,
  createPluginAuditEventRegistry,
  createPluginModuleIamRegistry,
  createPluginPermissionRegistry,
  createPluginRegistry,
  createPluginServerHandlerRegistry,
  definePluginActions,
  definePluginAuditEvents,
  definePluginModuleIamContract,
  definePluginPermissions,
  mergePluginActions,
  mergePluginAdminResourceDefinitions,
  mergePluginAuditEventDefinitions,
  mergePluginContentTypes,
  mergePluginModuleIamContracts,
  mergePluginNavigationItems,
  mergePluginPermissions,
  mergePluginRouteDefinitions,
  mergePluginTranslations,
} from './plugins.js';
export type {
  // fallow-ignore-next-line unused-type
  LoadedPluginEntry,
  PluginCatalogEntry,
  PluginCatalogSourceType,
  PluginExecutionAuditReporter,
  PluginExecutionBaseContext,
  PluginExecutionContextCapabilities,
  PluginExecutionLogger,
  PluginExecutionProgressReporter,
  PluginExtensionTier,
  PluginIntegrationExecutionContext,
  PluginJobExecutionHandler,
  PluginJobExecutionResult,
  PluginJobHandlerContext,
  PluginJobExecutionContext,
  PluginJobProgressReporter,
  PluginManifest,
  PluginManifestCapability,
  PluginTenantActivationPolicy,
  PluginRequestExecutionContext,
  PluginSnapshot,
} from './plugin-platform-contracts.js';
export {
  PLUGIN_ROUTE_SCOPE_HEADER_NAME,
  createPluginSnapshot,
  definePluginCatalogEntry,
  definePluginExecutionContextCapabilities,
  definePluginManifest,
} from './plugin-platform-contracts.js';
export { resolvePluginCatalog, resolvePluginCatalogAsync } from './plugin-platform-resolution.js';
export type {
  PluginCatalogIssue,
  PluginCatalogIssueCode,
  PluginCatalogIssueSeverity,
  PluginPlatformHost,
  ResolvedPluginCatalog,
} from './plugin-platform-resolution.js';
export type {
  PluginImportProfileDefinition,
  PluginImportProfileRegistryEntry,
  PluginImportProfileValidationMode,
  PluginJobTypeDefinition,
  PluginJobTypeRegistryEntry,
} from './plugin-operations.js';
export * from './plugin-tenant-lifecycle.js';
export {
  createPluginImportProfileRegistry,
  createPluginJobTypeRegistry,
  definePluginImportProfiles,
  definePluginJobTypes,
  mergePluginImportProfiles,
  mergePluginJobTypes,
} from './plugin-operations.js';
export type {
  PluginExternalInterfaceTypeDefinition,
  PluginExternalInterfaceTypeRegistryEntry,
} from './external-interfaces.js';
export {
  createPluginExternalInterfaceTypeRegistry,
  definePluginExternalInterfaceTypes,
  mergePluginExternalInterfaceTypes,
} from './external-interfaces.js';
export type {
  StandardContentAdminResourceOptions,
  StandardContentPluginActionIds,
  StandardContentPluginActionName,
  StandardContentPluginActionOptions,
  StandardContentAccessCapabilities,
  // fallow-ignore-next-line unused-type
  StandardContentPluginContribution,
  StandardContentPluginContributionOptions,
  // fallow-ignore-next-line unused-type
  StandardContentPluginDefinitionOptions,
} from './standard-content-plugin.js';
export {
  createStandardContentAdminResource,
  createStandardContentPluginDefinition,
  createStandardContentModuleIamContract,
  createStandardContentPluginActionIds,
  createStandardContentPluginActions,
  createStandardContentPluginContribution,
  createStandardContentPluginPermissions,
  createStandardContentPluginSystemRoles,
  createStandardContentTypeDefinition,
  resolveStandardContentAccessCapabilities,
} from './standard-content-plugin.js';
// prettier-ignore
export type { EffectiveAccessSnapshot, UiAccessDecision, UiAccessRequirement, UiAccessScope, UiResourceCapability } from '@sva/iam-core';
export type * from './plugin-translations.js';
export {
  registerPluginTranslationResolver,
  translatePluginKey,
  usePluginTranslation,
} from './plugin-translations.js';
export type { SessionAccessSnapshot } from './session-access.js';
export {
  publishSessionAccessSnapshot,
  readSessionAccessSnapshot,
  resetSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
} from './session-access.js';
