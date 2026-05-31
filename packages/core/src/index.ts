export const coreVersion = '0.0.1';
export {
  iamContentAccessReasonCodes,
  iamContentListSortDirections,
  iamContentListSortFields,
  iamContentAccessStates,
  iamContentCapabilityMappings,
  iamContentDomainCapabilities,
  iamContentPrimitiveActions,
  iamContentStatuses,
  iamContentValidationStates,
  isContentJsonValue,
  isIamContentDomainCapability,
  isIamContentPrimitiveAction,
  isIamContentStatus,
  isIamContentValidationState,
  resolveIamContentCapabilityMapping,
  resolveIamContentDomainCapabilityForPrimitiveAction,
  summarizeContentAccess,
  validateCreateIamContentInput,
  withServerDeniedContentAccess,
  GENERIC_CONTENT_TYPE,
  IAM_DELETED_CONTENT_AUTHOR_TOKEN,
  IAM_PSEUDONYMIZED_CONTENT_AUTHOR_TOKEN,
} from './content-management.js';
export type {
  ContentJsonPrimitive,
  ContentJsonValue,
  CreateIamContentInput,
  IamContentAccessReasonCode,
  IamContentAccessState,
  IamContentAccessSummary,
  IamContentCapabilityMapping,
  IamContentCapabilityMappingDiagnosticCode,
  IamContentDetail,
  IamContentDomainCapability,
  IamContentHistoryEntry,
  IamContentListItem,
  IamContentListQuery,
  IamContentListSortDirection,
  IamContentListSortField,
  IamContentPrimitiveAction,
  IamContentStatus,
  IamContentValidationState,
  ResolvedIamContentCapabilityMapping,
  UpdateIamContentInput,
} from './content-management.js';
export {
  studioImportContract,
  studioJobErrorContract,
  studioJobEventContract,
  studioJobListContract,
  studioJobContract,
  studioJobRuntimeContract,
  studioPluginOperationErrorContract,
} from './plugin-operations-contract.js';
export { externalInterfaceContract } from './external-interfaces-contract.js';
export { isUuid, readBoolean, readNumber, readNumberLike, readObject, readString } from './input-readers.js';
export type {
  ExternalInterfaceCategory, ExternalInterfaceConnectionCheckRecord, ExternalInterfaceOwnerKind, ExternalInterfaceRecord,
  ExternalInterfaceRuntimeErrorCode, ExternalInterfaceSettingsRecord, ExternalInterfaceStatusCheckKind,
  ExternalInterfaceTypeDefinition, ExternalInterfaceTypeKey, ExternalInterfaceVisibleStatus, ResolvedExternalInterface,
} from './external-interfaces-contract.js';
export type {
  StudioJobCancellationRequestInput, StudioJobCreateInput, StudioJobDetail, StudioJobDetailResponse, StudioJobError,
  StudioJobEventCreateInput, StudioJobEventDetails, StudioJobEventHostDetails, StudioJobEventPresentation,
  StudioJobEventRecord, StudioJobHeartbeatInput, StudioJobListItem, StudioJobListQuery, StudioJobListResponse,
  StudioJobProgressUpdateInput, StudioJobResponse, StudioJobProgress, StudioJobResult, StudioJobResultSummary,
  StudioJobRecord, StudioJobRuntimeDiagnostics, StudioJobStartRequest, StudioPluginOperationApiError,
  StudioPluginOperationApiErrorResponse, StudioJobUpdateInput,
} from './plugin-operations-contract.js';
export { wasteManagementDataSourceContract } from './waste-management-contract.js';
export type {
  WasteManagementAuditOverview,
  WasteManagementAuditOutcome,
  WasteManagementAuditQuery,
  WasteManagementAuditRecord,
  WasteManagementHistoryOverview,
  WasteManagementTechnicalHistoryOverview,
  WasteManagementTechnicalHistoryOutcome,
  WasteManagementTechnicalHistoryRecord,
} from './waste-management-audit.js';
export type {
  WasteManagementConnectionCheckRecord,
  WasteManagementConnectionCheckStatus,
  WasteManagementDataSourceProvider,
  WasteManagementDataSourceRecord,
  WasteManagementDataSourceStatus,
  WasteHolidaySyncStatus,
  WasteManagementSettingsRecord,
  WasteManagementTechnicalEventType,
} from './waste-management-contract.js';
export { wasteManagementOperationsContract } from './waste-management-operations-contract.js';
export { getWasteManagementImportCatalogEntry, wasteManagementImportCatalog } from './waste-management-import-catalog.js';
export {
  detectWasteImportCsvDelimiter,
  normalizeWasteImportPickupDate,
  parseWasteLocationTourPickupDateCsv,
  planWasteLocationTourPickupDateImport,
  wasteLocationTourPickupDateImportDefaults,
} from './waste-management-location-tour-pickup-date-import.js';
export type {
  WasteManagementImportColumnDefinition,
  WasteManagementImportMappingTemplate,
  WasteManagementImportProfileCatalogEntry,
} from './waste-management-import-catalog.js';
export type {
  WasteLocationTourPickupDateImportEntityPreview,
  WasteLocationTourPickupDateImportIssue,
  WasteLocationTourPickupDateImportPlan,
  WasteLocationTourPickupDateImportParseResult,
  WasteLocationTourPickupDateImportPlanningSnapshot,
  WasteLocationTourPickupDateImportPreview,
  WasteLocationTourPickupDateImportRow,
  WasteLocationTourPickupDateImportSummary,
  WasteLocationTourPickupDateImportUpserts,
} from './waste-management-location-tour-pickup-date-import.js';
export type {
  WasteManagementCsvDelimiter,
  WasteManagementApplyMigrationsJobInput,
  WasteManagementImportJobInput,
  WasteManagementImportProfileId,
  WasteManagementImportSourceFormat,
  WasteManagementInitializeJobInput,
  WasteManagementJobInput,
  WasteManagementJobTypeId,
  WasteManagementResetJobInput,
  WasteManagementSeedJobInput,
} from './waste-management-operations-contract.js';
export type {
  WasteDateShiftReasonType,
  WasteCollectionLocationListFilter,
  WasteCollectionLocationRecord,
  WasteHolidayRuleConflictStatus,
  WasteHolidayRuleConfigurationStatus,
  WasteHolidayRuleListFilter,
  WasteHolidayRuleRecord,
  WasteHolidayRuleScope,
  WasteHolidayRuleSourceStatus,
  WasteHolidayRuleStrategy,
  WasteHolidayStateCode,
  WasteCustomRecurrencePresetRecord,
  WasteCustomTourDate,
  WasteCityListFilter,
  WasteCityRecord,
  WasteFractionListFilter,
  WasteFractionRecord,
  WasteGlobalDateShiftListFilter,
  WasteGlobalDateShiftRecord,
  WasteHouseNumberListFilter,
  WasteHouseNumberRecord,
  WasteLocalizedTextRecord,
  WasteLocationTourLinkBulkCreateInput,
  WasteLocationTourLinkBulkCreateResult,
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteManagementToursOverview,
  WasteLocationTourPickupDateListFilter,
  WasteLocationTourPickupDateRecord,
  WasteLocationTourLinkListFilter,
  WasteLocationTourLinkRecord,
  WasteRegionListFilter,
  WasteRegionRecord,
  WasteStreetListFilter,
  WasteStreetRecord,
  WasteTourDateShiftFollowUpMode,
  WasteTourDateShiftListFilter,
  WasteTourDateShiftRecord,
  WasteTourListFilter,
  WasteTourRecurrence,
  WasteTourRecord,
} from './waste-management-master-data.js';
export { wasteManagementMasterDataContract } from './waste-management-master-data.js';
export { buildWasteCalendarPdfDocument, renderWasteCalendarPdf } from './waste-management-output.js';
export type {
  WasteCalendarPdfDocument, WasteManagementOutputOverview, WasteManagementOutputPdfResult,
  WasteOutputCollectionLocationArtifacts, WasteOutputPdfArtifactRecord, WasteOutputPickupEntry, WasteOutputFraction,
} from './waste-management-output.types.js';
export * from './routing/registry.js';
export * from './iam/index.js';
export {
  buildPrimaryHostname,
  canTransitionInstanceStatus,
  classifyHost,
  instanceStatuses,
  isInstanceStatus,
  isTrafficEnabledInstanceStatus,
  isValidHostname,
  isValidInstanceId,
  isValidParentDomain,
  normalizeHost,
  trafficEnabledInstanceStatuses,
} from './instances/registry.js';
export { areAllInstanceKeycloakRequirementsSatisfied, INSTANCE_KEYCLOAK_REQUIREMENTS, isInstanceKeycloakRequirementSatisfied } from './instances/keycloak-checklist.js';
export type {
  HostClassification,
  InstanceAuditEvent,
  InstanceKeycloakCheckStatus,
  InstanceKeycloakPreflightCheck,
  InstanceKeycloakProvisioningIntent,
  InstanceKeycloakProvisioningPlanStep,
  InstanceKeycloakProvisioningRun,
  InstanceKeycloakProvisioningRunStep,
  InstanceKeycloakProvisioningRunStatus,
  InstanceKeycloakProvisioningStepStatus,
  InstanceProvisioningOperation,
  InstanceProvisioningRun,
  InstanceRealmMode,
  InstanceRegistryRecord,
  InstanceStatus,
  TrafficEnabledInstanceStatus,
} from './instances/registry.js';
export type { InstanceKeycloakRequirement, InstanceKeycloakRequirementKey } from './instances/keycloak-checklist.js';
export { maskEmailAddresses } from './security/email-redaction.js';
export type {
  RuntimeProfile,
  RuntimeProfileAuthMode,
  RuntimeProfileDefinition,
  RuntimeProfileEnvValidationResult,
} from './runtime-profile.js';
export {
  mainserverListAllowedPageSizes,
  mainserverListDefaultPageSize,
  mainserverListMaxOffset,
  parseMainserverListQuery,
} from './mainserver-list-pagination.js';
export type { MainserverListQuery } from './mainserver-list-pagination.js';
export {
  RUNTIME_PROFILES,
  getRuntimeProfileDerivedEnvKeys,
  getRuntimeProfileDefinition,
  getRuntimeProfileFromEnv,
  getRuntimeProfileRequiredEnvKeys,
  isMockAuthRuntimeProfile,
  parseRuntimeProfile,
  validateRuntimeProfileEnv,
} from './runtime-profile.js';
