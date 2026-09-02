export {
  configureInstanceRegistryPluginActivationPolicies,
  configureInstanceRegistryPluginRuntimeSnapshot,
  readInstanceRegistryModuleIamRegistry,
  readInstanceRegistryPluginActivationPolicies,
  readInstanceRegistryPluginTenantLifecycleRegistry,
  type InstanceRegistryModuleIamSnapshotEntry,
} from './iam-instance-registry/plugin-activation-policy-snapshot.js';
export {
  readPluginActivationPolicyFleetReconcileReport,
  reconcileConfiguredPluginActivationPoliciesForAllInstances,
  type PluginActivationPolicyFleetReconcileFailure,
  type PluginActivationPolicyFleetReconcileReport,
} from './iam-instance-registry/plugin-activation-policy-reconcile.js';
export {
  readEffectiveSvaMainserverCredentials,
  readEffectiveSvaMainserverCredentialsWithStatus,
} from './mainserver-effective-credentials.js';
export type {
  EffectiveMainserverCredentialsInput,
  EffectiveMainserverCredentialSource,
  EffectiveSvaMainserverCredentialsResult,
} from './mainserver-effective-credentials.js';
export { resolveMutationPrincipalContext } from './mainserver-mutation-principal.js';
export type {
  MainserverActingPrincipalType,
  MutationPrincipalContext,
  ResolveMutationPrincipalContextResult,
} from './mainserver-mutation-principal.js';
export {
  readSvaMainserverCredentials,
  readSvaMainserverCredentialsWithStatus,
} from './mainserver-credentials.js';
export type {
  MainserverCredentialState,
  SvaMainserverCredentials,
} from './mainserver-credentials.js';
export {
  getAuthConfig,
  resolveAuthConfigForInstance,
  resolveAuthConfigForRequest,
  resolveAuthConfigFromSessionAuth,
  resolveBaseAuthConfig,
} from './config.js';
export { buildLogContext } from './log-context.js';
export {
  readPluginOperationArtifact,
  readPluginOperationInput,
  storePluginOperationArtifact,
  storePluginOperationInput,
} from './plugin-operation-artifacts.server.js';
export { buildRequestOriginFromHeaders, resolveEffectiveRequestHost } from './request-hosts.js';
export { resolveAuthRequestHost, sanitizeAuthReturnTo } from './auth-return-to.js';
export {
  normalizeDatabaseConnectionUrl,
  normalizeOutboundHttpUrl,
  normalizePublicUpstreamUrl,
} from './upstream-url-validation.js';
export { emitAuthAuditEvent } from './audit-events.js';
export type {
  AuthAuditEvent,
  AuthAuditEventType,
  PluginActionAuditPayload,
} from './audit-events.types.js';
export {
  ensureStudioJobWorkerStarted,
  ensurePrivilegedStudioJobWorkerStarted,
  queueStudioJob,
  registerStudioJobExecutionHandlers,
  stopStudioJobWorker,
  stopPrivilegedStudioJobWorker,
  ensurePluginOperationWorkerStarted,
  queuePluginOperationJob,
  registerPluginOperationExecutionHandlers,
  stopPluginOperationWorker,
} from './plugin-operations/runner.js';
export {
  createPluginTenantLifecycleOrchestrator,
  pluginTenantLifecycleHostErrorCodes,
} from './plugin-tenant-lifecycle/orchestrator.js';
export { startConfiguredPluginTenantLifecycle } from './plugin-tenant-lifecycle/runtime.js';
export { readConfiguredPluginTenantReadiness } from './plugin-tenant-lifecycle/read-model.js';
export {
  filterConfiguredPluginTenantAccessibleModules,
  readConfiguredPluginTenantAccess,
  resolveConfiguredPluginTenantModuleAccess,
} from './plugin-tenant-lifecycle/access.js';
export type {
  PluginTenantLifecycleOrchestratorDependencies,
  StartPluginTenantLifecycleInput,
  StartPluginTenantLifecycleResult,
} from './plugin-tenant-lifecycle/orchestrator.js';
export {
  createAndQueueDsrExportStudioJob,
  dsrExportStudioJobRegistration,
  dsrExportStudioJobTypeId,
} from './iam-data-subject-rights/export-worker.js';
export type {
  PluginOperationExecutionHandler,
  PluginOperationExecutionResult,
} from './plugin-operations/runner.js';
export type {
  PluginOperationExecutionHandlerContext,
  PluginOperationExecutionRegistration,
  PluginOperationProgressReporter,
  StudioJobExecutionHandler,
  StudioJobExecutionHandlerContext,
  StudioJobExecutionRegistration,
  StudioJobExecutionResult,
} from './plugin-operations/runner.js';
export {
  persistAuthAuditEventToDb,
  persistAuthAuditEventWithClient,
  type AuditSqlClient,
  type PersistAuthAuditResult,
} from './audit-db-sink.js';
export { withAuthenticatedUser, type AuthenticatedRequestContext } from './middleware.js';
export {
  assertPluginServerHandlerCoverage,
  createPluginServerHandlerDispatcher,
  type PluginServerHandlerDispatcherDependencies,
} from './plugin-server-handlers/dispatcher.js';
export { createSsfRuntimePluginServiceAccess } from './ssf-runtime-plugin-service.js';
export { ensureFeature, getFeatureFlags } from './iam-account-management/feature-flags.js';
export { withInstanceScopedDb } from './iam-account-management/shared.js';
export { resolveActorAccountId } from './iam-account-management/shared.js';
export { resolveEffectivePermissions } from './iam-authorization/permission-store.js';
export {
  readTenantPermissionProjectionSubjects,
  type TenantPermissionProjectionSubject,
} from './iam-authorization/tenant-permission-projection.js';
export { withMediaRepository, withMediaService } from './iam-media/index.js';
export { completeMediaUploadHandler } from './iam-media/core.js';
export {
  cleanupMediaContentSaveOperation,
  mediaContentSaveRecoveryStudioJobRegistration,
  scheduleMediaContentSaveRecovery,
} from './iam-media/content-save-recovery.js';
export {
  markMediaContentSaveFromMainserverMutation,
  type MarkMediaContentSaveFromMainserverResult,
} from './iam-media/content-save-correlation.js';
export {
  authorizeMediaPrimitiveForUser,
  type MediaPrimitiveAuthorizationResource,
  type MediaPrimitiveAuthorizationResult,
} from './iam-media/server-authorization.js';
export {
  authorizeContentPrimitiveForUser,
  type ContentPrimitiveAuthorizationResource,
  type ContentPrimitiveAuthorizationResult,
} from './iam-contents/server-authorization.js';
export {
  bindExternalContentReference,
  createExternalContentReference,
  loadExternalContentCore,
  loadExternalContentReferenceByContentId,
  loadExternalContentReferenceByOperation,
  loadExternalContentReferenceBySourceEntity,
  listExternalContentReferences,
  prepareExternalContent,
  updateExternalContentCore,
  updateExternalContentReconciliationStatus,
  withExternalContentMutationLock,
  type ExternalContentReconciliationStatus,
  type ExternalContentReference,
} from './iam-contents/external-content-references.js';
export {
  loadCurrentMainserverDataProviderBinding,
  recordMainserverDataProviderObservation,
  type MainserverDataProviderBinding,
  type MainserverDataProviderBindingStatus,
  type MainserverDataProviderEvidenceKind,
  type MainserverPrincipalType,
  type RecordMainserverDataProviderObservationResult,
} from './iam-contents/mainserver-data-provider-bindings.js';
export {
  listMainserverOwnershipTargets,
  resolveMainserverOwnershipSource,
  resolveMainserverOwnershipTarget,
  withMainserverContentOwnershipLock,
  type MainserverOwnershipVerificationCandidate,
  type MainserverOwnershipTargetErrorCode,
  type ResolvedMainserverOwnershipTarget,
  type ResolvedMainserverOwnershipSource,
  type ResolveMainserverOwnershipTargetResult,
} from './iam-contents/mainserver-content-ownership.js';
export { withMainserverOwnershipTargetBindingLock } from './iam-contents/mainserver-ownership-target-binding-lock.js';
export {
  reconcileDeletedUserDataProviderConflict,
  type DeletedUserDataProviderConflictReason,
  type ReconcileDeletedUserDataProviderConflictResult,
} from './iam-contents/mainserver-data-provider-conflict-reconciliation.js';
export {
  annotateMainserverMutationJournal,
  beginMainserverMutationJournal,
  finalizeMainserverMutationJournal,
  loadMainserverMutationJournal,
  type MainserverMutationJournalEntry,
  type MainserverMutationProviderOutcome,
  type MainserverMutationReconciliationStatus,
} from './iam-contents/mainserver-mutation-journal.js';
export {
  hasUnresolvedMainserverOwnershipTransfer,
  loadRecoverableMainserverOwnershipTransfers,
  markMainserverMutationReconciliationRequired,
  type RecoverableMainserverOwnershipTransfer,
} from './iam-contents/mainserver-ownership-transfer-reconciliation.js';
export {
  loadMainserverAuthoringDiagnostics,
  type MainserverAuthoringDiagnostics,
} from './iam-contents/mainserver-authoring-diagnostics.js';
export {
  authorizeMainserverCreatePrincipal,
  authorizeMainserverDataProviderAccess,
  readMainserverScopeResolverMode,
  type MainserverContentAuthorizationDecision,
  type MainserverContentAuthorizationMode,
  type MainserverScopeResolverMode,
} from './iam-contents/mainserver-content-authorization.js';
export {
  recordSuccessfulExternalContentDeletion,
  recordSuccessfulExternalContentMutation,
} from './iam-contents/external-content-mutations.js';
export {
  authorizeInstancePermissionForUser,
  type InstancePermissionAuthorizationResult,
} from './instance-permission-authorization.js';
export { validateCsrf } from './shared/request-security.js';
export {
  completeIdempotency,
  renewIdempotencyLease,
  reserveIdempotency,
} from './iam-account-management/shared.js';
export { protectField, revealField } from './iam-account-management/encryption.js';
export { resolveActorInfo, type ActorInfo } from './iam-account-management/shared.js';
export { getSessionUser } from './auth-server/session.js';
export {
  DEFAULT_WORKSPACE_ID,
  PLATFORM_WORKSPACE_ID,
  getRuntimeScopeRef,
  getScopeFromAuthConfig,
  getWorkspaceIdForScope,
  isPlatformScope,
} from './scope.js';
export { isRetryableTokenExchangeError, isTokenErrorLike } from './error-guards.js';
export { decryptToken, encryptToken, generateEncryptionKey, isEncrypted } from './crypto.js';
export {
  createMockSessionUser,
  DEV_AUTH_COOKIE_NAME,
  hasActiveMockAuthSession,
  isMockAuthEnabled,
} from './mock-auth.js';
export { resolveSessionUser, validateTenantHost } from './middleware-hosts.js';
export { shouldEnforceLegalTextCompliance } from './middleware-compliance.js';
export { withLegalTextCompliance } from './legal-text-enforcement.js';
export { jitProvisionAccount, jitProvisionAccountWithClient } from './jit-provisioning.js';
export type { JitProvisionInput, JitProvisionResult } from './jit-provisioning.js';
export {
  closeRedis,
  getLastRedisError,
  getRedisClient,
  getRedisHealthSnapshot,
  isRedisAvailable,
  type RedisHealthSnapshot,
} from './redis.js';
export {
  SessionStoreUnavailableError,
  SessionUserHydrationError,
  TenantAuthResolutionError,
  TenantScopeConflictError,
} from './runtime-errors.js';
export type {
  AuthConfig,
  ForceReauthInput,
  ForcedReauthMode,
  InstanceScopeRef,
  LoginState,
  PlatformScopeRef,
  RuntimeScopeRef,
  ScopeKind,
  Session,
  SessionAuthContext,
  SessionControlState,
  SessionUser,
} from './types.js';
