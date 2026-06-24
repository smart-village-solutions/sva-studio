export {
  readEffectiveSvaMainserverCredentials,
  readEffectiveSvaMainserverCredentialsWithStatus,
} from './mainserver-effective-credentials.js';
export type {
  EffectiveMainserverCredentialSource,
  EffectiveSvaMainserverCredentialsResult,
} from './mainserver-effective-credentials.js';
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
export { buildRequestOriginFromHeaders, resolveEffectiveRequestHost } from './request-hosts.js';
export { resolveAuthRequestHost, sanitizeAuthReturnTo } from './auth-return-to.js';
export { normalizePublicUpstreamUrl } from './upstream-url-validation.js';
export { emitAuthAuditEvent } from './audit-events.js';
export type { AuthAuditEvent, AuthAuditEventType, PluginActionAuditPayload } from './audit-events.types.js';
export {
  ensureStudioJobWorkerStarted,
  queueStudioJob,
  registerStudioJobExecutionHandlers,
  stopStudioJobWorker,
  ensurePluginOperationWorkerStarted,
  queuePluginOperationJob,
  registerPluginOperationExecutionHandlers,
  stopPluginOperationWorker,
} from './plugin-operations/runner.js';
export {
  createAndQueueDsrExportStudioJob,
  dsrExportStudioJobRegistration,
  dsrExportStudioJobTypeId,
} from './iam-data-subject-rights/export-worker.js';
export type { PluginOperationExecutionHandler, PluginOperationExecutionResult } from './plugin-operations/runner.js';
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
export { withInstanceScopedDb } from './iam-account-management/shared.js';
export { resolveActorAccountId } from './iam-account-management/shared.js';
export { withMediaRepository, withMediaService } from './iam-media/index.js';
export { completeMediaUploadHandler } from './iam-media/core.js';
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
  authorizeInstancePermissionForUser,
  type InstancePermissionAuthorizationResult,
} from './instance-permission-authorization.js';
export { validateCsrf } from './shared/request-security.js';
export { completeIdempotency, reserveIdempotency } from './iam-account-management/shared.js';
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
