export const authRuntimeVersion = '0.0.1';

export type AuthRuntimePackageRole = 'login' | 'logout' | 'oidc' | 'session' | 'auth-middleware';

export const authRuntimePackageRoles = [
  'login',
  'logout',
  'oidc',
  'session',
  'auth-middleware',
] as const satisfies readonly AuthRuntimePackageRole[];

export { authRoutePaths } from './routes.js';
export type { AuthRoutePath } from './routes.js';
export {
  getAuthConfig,
  resolveAuthConfigForInstance,
  resolveAuthConfigForRequest,
  resolveAuthConfigFromSessionAuth,
  resolveBaseAuthConfig,
} from './config.js';
export { buildLogContext } from './log-context.js';
export { buildRequestOriginFromHeaders, resolveEffectiveRequestHost } from './request-hosts.js';
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
export { resolveSessionUser, validateTenantHost } from './middleware-hosts.js';
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
