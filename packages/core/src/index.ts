export const coreVersion = '0.0.1';
export {
  composePermissionCatalog,
  corePermissionCatalog,
  resolvesSystemAdminGrant,
  rootPermissionCatalog,
  tenantCorePermissionCatalog,
  tenantCoreSystemAdminPermissionKeys,
  validatePermissionCatalog,
  type CorePermissionKey,
  type ModulePermissionCatalogContribution,
  type PermissionAvailability,
  type PermissionDefinition,
  type PermissionLifecycle,
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
  type PermissionDenialDetails,
  type PermissionDenialReason,
  type PermissionRequirementMode,
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
  type ContentJsonPrimitive,
  type ContentJsonValue,
  type CreateIamContentInput,
  type IamContentAccessReasonCode,
  type IamContentAccessState,
  type IamContentAccessSummary,
  type IamContentAuthorDisplayMode,
  type IamContentAuthorizationMode,
  type IamContentCapabilityMapping,
  type IamContentCapabilityMappingDiagnosticCode,
  type IamContentDetail,
  type IamContentDomainCapability,
  type IamContentHistoryEntry,
  type IamContentListItem,
  type IamContentListQuery,
  type IamContentListSortDirection,
  type IamContentListSortField,
  type IamContentOwnerPrincipal,
  type IamContentOwnerPrincipalType,
  type IamContentOwnershipTransferResult,
  type IamContentOwnershipTarget,
  type IamContentOwnershipTargetList,
  type IamContentPrimitiveAction,
  type IamContentStatus,
  type IamContentValidationState,
  type ResolvedIamContentCapabilityMapping,
  type TransferIamContentOwnershipInput,
  type UpdateIamContentInput,
} from './content-management.js';

export {
  buildMainserverProjectionScopeKey,
  type MainserverProjectionScope,
} from './mainserver-projection-scope.js';

export {
  studioImportContract,
  studioJobErrorContract,
  studioJobEventContract,
  studioJobListContract,
  studioJobContract,
  studioJobRuntimeContract,
  studioPluginOperationErrorContract,
  type StudioJobCancellationRequestInput,
  type StudioJobCreateInput,
  type StudioJobDetail,
  type StudioJobDetailResponse,
  type StudioJobError,
  type StudioJobEventCreateInput,
  type StudioJobEventDetails,
  type StudioJobEventHostDetails,
  type StudioJobEventPresentation,
  type StudioJobEventRecord,
  type StudioJobHeartbeatInput,
  type StudioJobListItem,
  type StudioJobListQuery,
  type StudioJobListResponse,
  type StudioJobProgressUpdateInput,
  type StudioJobResponse,
  type StudioJobProgress,
  type StudioJobResult,
  type StudioJobResultArtifact,
  type StudioJobResultSummary,
  type StudioJobRecord,
  type StudioJobRuntimeDiagnostics,
  type StudioJobSource,
  type StudioJobStatus,
  type StudioJobStartRequest,
  type StudioPluginOperationApiError,
  type StudioPluginOperationStartRequest,
  type StudioPluginOperationApiErrorResponse,
  type StudioJobUpdateInput,
} from './plugin-operations-contract.js';
export { PLUGIN_ROUTE_SCOPE_HEADER_NAME } from './plugin-platform-contract.js';
export {
  externalInterfaceContract,
  mailDispatchContract,
  mailTransportContract,
  type ExternalInterfaceCategory,
  type ExternalInterfaceCheckStatus,
  type ExternalInterfaceConnectionCheckRecord,
  type ExternalInterfaceOwnerKind,
  type ExternalInterfaceRecord,
  type ExternalInterfaceRuntimeErrorCode,
  type ExternalInterfaceSettingsRecord,
  type ExternalInterfaceStatusCheckKind,
  type ExternalInterfaceTypeDefinition,
  type ExternalInterfaceTypeKey,
  type ExternalInterfaceVisibleStatus,
  type MailDispatchAddress,
  type MailDispatchAddressKind,
  type MailDispatchMessageKind,
  type MailDispatchPayload,
  type MailTransportAuthMode,
  type MailTransportConfig,
  type MailTransportHealth,
  type MailTransportProviderApiConfig,
  type MailTransportSecurityMode,
  type MailTransportSmtpConfig,
  type MailTransportType,
  type ResolvedExternalInterface,
} from './external-interfaces-contract.js';
export {
  isUuid,
  readBoolean,
  readNumber,
  readNumberLike,
  readObject,
  readString,
} from './input-readers.js';

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
  type AccountInvitationTemplate,
  type AccountInvitationTemplateSource,
  type CompiledAccountInvitationTemplate,
  type ServerAccountInvitationTemplateState,
  type ServerAccountInvitationTemplateView,
} from './instances/account-invitation-template.js';

export type { TenantAccountInvitationTemplateView } from './iam/account-management.js';
export {
  canDisableTenantModule,
  resolveTenantModuleEffectiveActivation,
  tenantModuleActivationOrigins,
  tenantModuleActivationPolicies,
  tenantModuleManualOverrides,
  type TenantModuleActivationOrigin,
  type TenantModuleActivationPolicy,
  type TenantModuleActivationPolicyDescriptor,
  type TenantModuleActivationPolicySnapshot,
  type TenantModuleActivationRecord,
  type TenantModuleManualOverride,
} from './instances/module-activation.js';

export {
  areAllInstanceKeycloakRequirementsSatisfied,
  getApplicableInstanceKeycloakRequirements,
  INSTANCE_KEYCLOAK_REQUIREMENTS,
  isInstanceTenantAdminRequired,
  isInstanceKeycloakRequirementSatisfied,
  type InstanceKeycloakRequirement,
  type InstanceKeycloakRequirementKey,
} from './instances/keycloak-checklist.js';

export { maskEmailAddresses } from './security/email-redaction.js';
export {
  type RuntimeProfile,
  type RuntimeProfileAuthMode,
  type RuntimeProfileDefinition,
  type RuntimeProfileEnvValidationResult,
  RUNTIME_PROFILES,
  getRuntimeProfileDerivedEnvKeys,
  getRuntimeProfileDefinition,
  getRuntimeProfileFromEnv,
  getRuntimeProfileRequiredEnvKeys,
  isMockAuthRuntimeProfile,
  parseRuntimeProfile,
  validateRuntimeProfileEnv,
} from './runtime-profile.js';
export {
  mainserverListAllowedPageSizes,
  mainserverListDefaultPageSize,
  mainserverListMaxOffset,
  parseMainserverListQuery,
  type MainserverListQuery,
} from './mainserver-list-pagination.js';

export {
  instanceBusKeyExpiresAt,
  type InstanceBusKey,
  type CreateInstanceBusKey,
  type InstanceBusKeyCreated,
} from './iam/account-instance-contract.js';

export * from './app-translations.js';

export {
  exportCatalogTextsJs,
  CATALOG_TEXTS_EXPORT_MAX_BYTES,
} from './app-translations-texts-export.js';
