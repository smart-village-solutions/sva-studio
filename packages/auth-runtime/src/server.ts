export {
  readSvaMainserverCredentialsWithStatus,
} from '@sva/auth/server';
export {
  getAuthConfig,
  resolveAuthConfigForInstance,
  resolveAuthConfigForRequest,
  resolveAuthConfigFromSessionAuth,
  resolveBaseAuthConfig,
} from './config.js';
export { buildLogContext } from './log-context.js';
export { buildRequestOriginFromHeaders, resolveEffectiveRequestHost } from './request-hosts.js';
export { withAuthenticatedUser, type AuthenticatedRequestContext } from './middleware.js';
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
export { createMockSessionUser, isMockAuthEnabled } from './mock-auth.js';
export {
  closeRedis,
  getLastRedisError,
  getRedisClient,
  getRedisHealthSnapshot,
  isRedisAvailable,
  type RedisHealthSnapshot,
} from './redis.js';
export { SessionStoreUnavailableError, TenantAuthResolutionError, TenantScopeConflictError } from './runtime-errors.js';
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
