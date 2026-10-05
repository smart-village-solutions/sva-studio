export const coreVersion = '0.0.1';
export {
  composePermissionCatalog,
  corePermissionCatalog,
  resolvesSystemAdminGrant,
  rootPermissionCatalog,
  tenantCorePermissionCatalog,
  tenantCoreSystemAdminPermissionKeys,
  validatePermissionCatalog,
} from './iam/permission-catalog.js';
export type {
  CorePermissionKey,
  ModulePermissionCatalogContribution,
  PermissionAvailability,
  PermissionDefinition,
  PermissionLifecycle,
} from './iam/permission-catalog.js';
export {
  createPermissionDenialDetails,
  createPermissionDenialDetailsForAction,
  isMissingPermissionDenial,
  isPermissionActionId,
  isPermissionDenialReason,
  parsePermissionDenialDetails,
  permissionDenialReasons,
  permissionRequirementModes,
} from './iam/permission-denial.js';
export type {
  PermissionDenialDetails,
  PermissionDenialReason,
  PermissionRequirementMode,
} from './iam/permission-denial.js';
export { isPlausibleEmailAddress } from './email-address.js';
export {
  inspectManualMediaUrl,
  isPersistableManualMediaUrl,
  isPersistableMediaAssetUrl,
  type ManualMediaUrlInspection,
} from './media-url.js';
export { convertRichTextHtmlToPlainText } from './rich-text-plain-text.js';
export {
  iamContentAccessReasonCodes,
  iamContentListSortDirections,
  iamContentListSortFields,
  iamContentOwnerPrincipalTypes,
  iamContentAccessStates,
  iamContentAuthorDisplayModes,
  iamContentCapabilityMappings,
  iamContentAuthorizationModes,
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
  IamContentAuthorDisplayMode,
  IamContentAuthorizationMode,
  IamContentCapabilityMapping,
  IamContentCapabilityMappingDiagnosticCode,
  IamContentDetail,
  IamContentDomainCapability,
  IamContentHistoryEntry,
  IamContentListItem,
  IamContentListQuery,
  IamContentListSortDirection,
  IamContentListSortField,
  IamContentOwnerPrincipal,
  IamContentOwnerPrincipalType,
  IamContentOwnershipTransferResult,
  IamContentOwnershipTarget,
  IamContentOwnershipTargetList,
  IamContentPrimitiveAction,
  IamContentStatus,
  IamContentValidationState,
  ResolvedIamContentCapabilityMapping,
  TransferIamContentOwnershipInput,
  UpdateIamContentInput,
} from './content-management.js';
export { buildMainserverProjectionScopeKey } from './mainserver-projection-scope.js';
export type { MainserverProjectionScope } from './mainserver-projection-scope.js';
export {
  studioImportContract,
  studioJobErrorContract,
  studioJobEventContract,
  studioJobListContract,
  studioJobContract,
  studioJobRuntimeContract,
  studioPluginOperationErrorContract,
} from './plugin-operations-contract.js';
export { PLUGIN_ROUTE_SCOPE_HEADER_NAME } from './plugin-platform-contract.js';
export {
  externalInterfaceContract,
  mailDispatchContract,
  mailTransportContract,
} from './external-interfaces-contract.js';
export {
  isUuid,
  readBoolean,
  readNumber,
  readNumberLike,
  readObject,
  readString,
} from './input-readers.js';
export type {
  ExternalInterfaceCategory,
  ExternalInterfaceCheckStatus,
  ExternalInterfaceConnectionCheckRecord,
  ExternalInterfaceOwnerKind,
  ExternalInterfaceRecord,
  ExternalInterfaceRuntimeErrorCode,
  ExternalInterfaceSettingsRecord,
  ExternalInterfaceStatusCheckKind,
  ExternalInterfaceTypeDefinition,
  ExternalInterfaceTypeKey,
  ExternalInterfaceVisibleStatus,
  MailDispatchAddress,
  MailDispatchAddressKind,
  MailDispatchMessageKind,
  MailDispatchPayload,
  MailTransportAuthMode,
  MailTransportConfig,
  MailTransportHealth,
  MailTransportProviderApiConfig,
  MailTransportSecurityMode,
  MailTransportSmtpConfig,
  MailTransportType,
  ResolvedExternalInterface,
} from './external-interfaces-contract.js';
export type {
  StudioJobCancellationRequestInput,
  StudioJobCreateInput,
  StudioJobDetail,
  StudioJobDetailResponse,
  StudioJobError,
  StudioJobEventCreateInput,
  StudioJobEventDetails,
  StudioJobEventHostDetails,
  StudioJobEventPresentation,
  StudioJobEventRecord,
  StudioJobHeartbeatInput,
  StudioJobListItem,
  StudioJobListQuery,
  StudioJobListResponse,
  StudioJobProgressUpdateInput,
  StudioJobResponse,
  StudioJobProgress,
  StudioJobResult,
  StudioJobResultArtifact,
  StudioJobResultSummary,
  StudioJobRecord,
  StudioJobRuntimeDiagnostics,
  StudioJobSource,
  StudioJobStatus,
  StudioJobStartRequest,
  StudioPluginOperationApiError,
  StudioPluginOperationStartRequest,
  StudioPluginOperationApiErrorResponse,
  StudioJobUpdateInput,
} from './plugin-operations-contract.js';
export * from './routing/registry.js';
export * from './iam/index.js';
export * from './instances/registry.js';
export type { InstanceStatus } from './instances/registry.js';
export {
  ACCOUNT_INVITATION_TEMPLATE_KEY,
  compileAccountInvitationTemplate,
  DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
  resolveEffectiveAccountInvitationTemplate,
  toServerAccountInvitationTemplateView,
  validateAccountInvitationTemplate,
  AccountInvitationTemplateValidationError,
} from './instances/account-invitation-template.js';
export type {
  AccountInvitationTemplate,
  AccountInvitationPurpose,
  AccountInvitationTemplateSource,
  CompiledAccountInvitationTemplate,
  ServerAccountInvitationTemplateState,
  ServerAccountInvitationTemplateView,
} from './instances/account-invitation-template.js';
export type { TenantAccountInvitationTemplateView } from './iam/account-management.js';
export {
  canDisableTenantModule,
  resolveTenantModuleEffectiveActivation,
  tenantModuleActivationOrigins,
  tenantModuleActivationPolicies,
  tenantModuleManualOverrides,
} from './instances/module-activation.js';
export type {
  TenantModuleActivationOrigin,
  TenantModuleActivationPolicy,
  TenantModuleActivationPolicyDescriptor,
  TenantModuleActivationPolicySnapshot,
  TenantModuleActivationRecord,
  TenantModuleManualOverride,
} from './instances/module-activation.js';
export {
  areAllInstanceKeycloakRequirementsSatisfied,
  getApplicableInstanceKeycloakRequirements,
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  isInstanceTenantAdminRequired,
  isInstanceKeycloakRequirementSatisfied,
} from './instances/keycloak-checklist.js';

export type {
  InstanceKeycloakRequirement,
  InstanceKeycloakRequirementKey,
} from './instances/keycloak-checklist.js';
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
