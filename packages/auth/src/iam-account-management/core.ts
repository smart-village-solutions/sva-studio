import { createHash } from 'node:crypto';
import {
  decryptFieldValue,
  encryptFieldValue,
  parseFieldEncryptionConfigFromEnv,
  type FieldEncryptionConfig,
} from '@sva/core/security';
import type {
  ApiErrorCode,
  ApiErrorResponse,
  ApiItemResponse,
  ApiListResponse,
  IamRoleListItem,
  IamRoleSyncState,
  IamUserDetail,
  IamUserListItem,
  IamUserRoleAssignment,
} from '@sva/core';
import { createSdkLogger, getWorkspaceContext, redactObject, withRequestContext } from '@sva/sdk/server';
import { metrics } from '@opentelemetry/api';
import { z } from 'zod';

import type { IdentityProviderPort } from '../identity-provider-port';
import { jitProvisionAccountWithClient } from '../jit-provisioning.server';
import {
  KeycloakAdminClient,
  KeycloakAdminRequestError,
  KeycloakAdminUnavailableError,
  getKeycloakAdminClientConfigFromEnv,
} from '../keycloak-admin-client';
import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.server';
import { isRedisAvailable } from '../redis.server';
import { createPoolResolver, jsonResponse, type QueryClient, withInstanceDb } from '../shared/db-helpers';
import { isUuid, readNumber, readString } from '../shared/input-readers';
import { resolveInstanceId } from '../shared/instance-id-resolution';

const logger = createSdkLogger({ component: 'iam-service', level: 'info' });
const meter = metrics.getMeter('sva.iam.service');
const iamUserOperationsCounter = meter.createCounter('iam_user_operations_total', {
  description: 'Counter for IAM user and role operations.',
});
const iamKeycloakRequestLatency = meter.createHistogram('iam_keycloak_request_duration_seconds', {
  description: 'Latency for outbound Keycloak admin operations.',
  unit: 's',
});
const iamCircuitBreakerGauge = meter.createObservableGauge('iam_circuit_breaker_state', {
  description: 'Circuit breaker state for Keycloak admin integration (0=closed, 2=open).',
});
const iamRoleSyncCounter = meter.createCounter('iam_role_sync_operations_total', {
  description: 'Role catalog sync operations grouped by operation, result and error code.',
});
const iamRoleDriftBacklogGauge = meter.createObservableGauge('iam_role_drift_backlog', {
  description: 'Latest known drift backlog per instance from role catalog reconciliation.',
});

const roleDriftBacklogByInstance = new Map<string, number>();

const resolvePool = createPoolResolver(() => process.env.IAM_DATABASE_URL);

const ADMIN_ROLES = new Set(['system_admin', 'app_manager']);
const SYSTEM_ADMIN_ROLES = new Set(['system_admin']);
const USER_STATUS = ['active', 'inactive', 'pending'] as const;
const READ_RATE_LIMIT = 60;
const WRITE_RATE_LIMIT = 10;
const BULK_RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;

type UserStatus = (typeof USER_STATUS)[number];
type RateScope = 'read' | 'write' | 'bulk';
type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

type FeatureFlags = {
  readonly iamUiEnabled: boolean;
  readonly iamAdminEnabled: boolean;
  readonly iamBulkEnabled: boolean;
};

type RateBucket = {
  windowStartedAt: number;
  count: number;
};

type ActorInfo = {
  readonly instanceId: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly actorAccountId?: string;
};

type ResolveActorOptions = {
  readonly createMissingInstanceFromKey?: boolean;
  readonly requireActorMembership?: boolean;
};

type IamRoleRow = {
  id: string;
  role_key: string;
  role_name: string;
  display_name?: string | null;
  external_role_name?: string | null;
  role_level: number;
  is_system_role: boolean;
};

type ManagedBy = 'studio' | 'external';

type RoleSyncErrorCode =
  | 'IDP_UNAVAILABLE'
  | 'IDP_TIMEOUT'
  | 'IDP_FORBIDDEN'
  | 'IDP_CONFLICT'
  | 'IDP_NOT_FOUND'
  | 'IDP_UNKNOWN'
  | 'DB_WRITE_FAILED'
  | 'COMPENSATION_FAILED'
  | 'REQUIRES_MANUAL_ACTION';

type ManagedRoleRow = IamRoleRow & {
  readonly description: string | null;
  readonly external_role_name: string;
  readonly managed_by: ManagedBy;
  readonly sync_state: IamRoleSyncState;
  readonly last_synced_at: string | null;
  readonly last_error_code: string | null;
};

type IdempotencyReserveResult =
  | {
      status: 'reserved';
    }
  | {
      status: 'replay';
      responseStatus: number;
      responseBody: unknown;
    }
  | {
      status: 'conflict';
      message: string;
    };

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1).max(200).optional(),
  lastName: z.string().trim().min(1).max(200).optional(),
  displayName: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().min(1).max(64).optional(),
  position: z.string().trim().max(255).optional(),
  department: z.string().trim().max(255).optional(),
  preferredLanguage: z.string().trim().max(16).optional(),
  timezone: z.string().trim().max(64).optional(),
  avatarUrl: z.string().url().max(1024).optional(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(USER_STATUS).optional(),
  roleIds: z.array(z.string().uuid()).max(20).default([]),
});

const parseBooleanFlag = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) {
    return defaultValue;
  }
  const lowered = value.trim().toLowerCase();
  return lowered === '1' || lowered === 'true' || lowered === 'yes' || lowered === 'on';
};

const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    firstName: z.string().trim().min(1).max(200).optional(),
    lastName: z.string().trim().min(1).max(200).optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().min(1).max(64).optional(),
    position: z.string().trim().max(255).optional(),
    department: z.string().trim().max(255).optional(),
    preferredLanguage: z.string().trim().max(16).optional(),
    timezone: z.string().trim().max(64).optional(),
    avatarUrl: z.string().url().max(1024).optional(),
    notes: z.string().trim().max(2000).optional(),
    status: z.enum(USER_STATUS).optional(),
    roleIds: z.array(z.string().uuid()).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Mindestens ein Feld muss gesetzt werden.');

const updateMyProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(200).optional(),
    lastName: z.string().trim().min(1).max(200).optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().min(1).max(64).optional(),
    position: z.string().trim().max(255).optional(),
    department: z.string().trim().max(255).optional(),
    preferredLanguage: z.string().trim().max(16).optional(),
    timezone: z.string().trim().max(64).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Mindestens ein Feld muss gesetzt werden.');

const bulkDeactivateSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50),
});

const createRoleSchema = z.object({
  roleName: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9_]+$/),
  displayName: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  permissionIds: z.array(z.string().uuid()).max(100).default([]),
  roleLevel: z.number().int().min(0).max(100).default(0),
});

const updateRoleSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    permissionIds: z.array(z.string().uuid()).max(100).optional(),
    roleLevel: z.number().int().min(0).max(100).optional(),
    retrySync: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0 && (Object.keys(value).some((key) => key !== 'retrySync') || value.retrySync),
    'Mindestens ein Feld muss gesetzt werden.'
  );

const rateLimiterStore = new Map<string, RateBucket>();

let encryptionConfigCache: { signature: string; config: FieldEncryptionConfig | null } | null = null;

let identityProviderCache:
  | {
      provider: IdentityProviderPort;
      getCircuitBreakerState?: () => number;
    }
  | null
  | undefined;

const getFeatureFlags = (): FeatureFlags => {
  const readFlag = (key: string, defaultValue: boolean) => parseBooleanFlag(process.env[key], defaultValue);

  const iamUiEnabled = readFlag('IAM_UI_ENABLED', true);
  const iamAdminEnabled = iamUiEnabled && readFlag('IAM_ADMIN_ENABLED', true);
  const iamBulkEnabled = iamAdminEnabled && readFlag('IAM_BULK_ENABLED', true);

  return { iamUiEnabled, iamAdminEnabled, iamBulkEnabled };
};

const maskEmail = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const [localPart, domain] = value.split('@');
  if (!localPart || !domain) {
    return '***';
  }
  if (localPart.length <= 2) {
    return `***@${domain}`;
  }
  return `${localPart.slice(0, 2)}***@${domain}`;
};

const parseRequestBody = async <T>(request: Request, schema: z.ZodSchema<T>) => {
  const raw = await request.text();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { ok: false as const, rawBody: raw };
  }

  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false as const, rawBody: raw };
  }
  return { ok: true as const, data: parsed.data, rawBody: raw };
};

const toPayloadHash = (rawBody: string): string => createHash('sha256').update(rawBody).digest('hex');

const getEncryptionConfig = (): FieldEncryptionConfig | null => {
  const activeKeyId = process.env.IAM_PII_ACTIVE_KEY_ID ?? '';
  const keyring = process.env.IAM_PII_KEYRING_JSON ?? '';
  const signature = `${activeKeyId}::${keyring}`;
  if (encryptionConfigCache?.signature === signature) {
    return encryptionConfigCache.config;
  }

  const config = parseFieldEncryptionConfigFromEnv(process.env);
  encryptionConfigCache = { signature, config };
  return config;
};

const protectField = (value: string | undefined, aad: string): string | null => {
  if (!value) {
    return null;
  }
  const config = getEncryptionConfig();
  if (!config) {
    const allowPlaintextFallback =
      process.env.IAM_PII_ALLOW_PLAINTEXT_FALLBACK !== undefined
        ? parseBooleanFlag(process.env.IAM_PII_ALLOW_PLAINTEXT_FALLBACK, false)
        : process.env.NODE_ENV !== 'production';
    if (!allowPlaintextFallback) {
      throw new Error('pii_encryption_required:PII-Verschlüsselung ist nicht konfiguriert.');
    }
    return value;
  }
  return encryptFieldValue(value, config, aad);
};

const revealField = (value: string | null | undefined, aad: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (!value.startsWith('enc:v1:')) {
    return value;
  }
  const config = getEncryptionConfig();
  if (!config) {
    return undefined;
  }
  try {
    return decryptFieldValue(value, config.keyring, aad);
  } catch {
    return undefined;
  }
};

const createApiError = (
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId?: string,
  details?: Readonly<Record<string, unknown>>
): Response =>
  jsonResponse(status, {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    ...(requestId ? { requestId } : {}),
  } satisfies ApiErrorResponse);

const asApiItem = <T>(data: T, requestId?: string): ApiItemResponse<T> => ({
  data,
  ...(requestId ? { requestId } : {}),
});

const asApiList = <T>(
  data: readonly T[],
  pagination: { page: number; pageSize: number; total: number },
  requestId?: string
): ApiListResponse<T> => ({
  data,
  pagination,
  ...(requestId ? { requestId } : {}),
});

const readPage = (request: Request): { page: number; pageSize: number } => {
  const url = new URL(request.url);
  const page = Math.max(1, readNumber(Number(url.searchParams.get('page'))) ?? 1);
  const pageSize = Math.max(1, Math.min(100, readNumber(Number(url.searchParams.get('pageSize'))) ?? 25));
  return { page, pageSize };
};

const readInstanceIdFromRequest = (request: Request, fallback?: string): string | undefined => {
  const url = new URL(request.url);
  return readString(url.searchParams.get('instanceId')) ?? fallback;
};

const readPathSegment = (request: Request, index: number): string | undefined => {
  const segments = new URL(request.url).pathname.split('/').filter((segment) => segment.length > 0);
  return segments[index];
};

const resolveIdentityProvider = () => {
  if (identityProviderCache !== undefined) {
    return identityProviderCache;
  }

  try {
    const config = getKeycloakAdminClientConfigFromEnv();
    const client = new KeycloakAdminClient(config);
    identityProviderCache = {
      provider: client,
      getCircuitBreakerState: () => client.getCircuitBreakerState(),
    };
  } catch {
    identityProviderCache = null;
  }

  return identityProviderCache;
};

const isKeycloakIdentityProvider = (provider: IdentityProviderPort): provider is KeycloakAdminClient =>
  provider instanceof KeycloakAdminClient;

iamCircuitBreakerGauge.addCallback((result) => {
  const idp = resolveIdentityProvider();
  result.observe(idp?.getCircuitBreakerState ? idp.getCircuitBreakerState() : 0);
});

iamRoleDriftBacklogGauge.addCallback((result) => {
  for (const [instanceId, backlog] of roleDriftBacklogByInstance.entries()) {
    result.observe(backlog, { instance_id: instanceId });
  }
});

const trackKeycloakCall = async <T>(operation: string, execute: () => Promise<T>): Promise<T> => {
  const startedAt = Date.now();
  try {
    const result = await execute();
    iamKeycloakRequestLatency.record((Date.now() - startedAt) / 1000, { operation, result: 'success' });
    return result;
  } catch (error) {
    iamKeycloakRequestLatency.record((Date.now() - startedAt) / 1000, { operation, result: 'failure' });
    throw error;
  }
};

const getRoleDisplayName = (role: Pick<IamRoleRow, 'display_name' | 'role_name'>): string =>
  readString(role.display_name) ?? role.role_name;

const getRoleExternalName = (role: Pick<IamRoleRow, 'external_role_name' | 'role_key'>): string =>
  readString(role.external_role_name) ?? role.role_key;

const ROLE_AUDIT_STRING_REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]'],
  [/((?:api[_-]?key|token|secret|password|session|cookie|csrf)[^=:\s]{0,20}[=:]\s*)([^,\s]+)/gi, '$1[REDACTED]'],
  [/((?:client[_-]?secret)[^=:\s]{0,20}[=:]\s*)([^,\s]+)/gi, '$1[REDACTED]'],
];
const ROLE_AUDIT_SENSITIVE_KEY_PATTERN =
  /(?:^|[_-])(token|secret|password|authorization|cookie|session|csrf)(?:$|[_-])|^(?:x-api-key|api[_-]?key)$/i;

const isRoleAuditSensitiveKey = (key: string): boolean => ROLE_AUDIT_SENSITIVE_KEY_PATTERN.test(key);

const sanitizeRoleAuditString = (value: string): string => {
  const redacted = redactObject({ value }).value;
  let next = typeof redacted === 'string' ? redacted : value;
  for (const [pattern, replacement] of ROLE_AUDIT_STRING_REDACTIONS) {
    next = next.replace(pattern, replacement);
  }
  return next;
};

const sanitizeRoleAuditValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return sanitizeRoleAuditString(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeRoleAuditValue(entry));
  }
  if (value && typeof value === 'object') {
    const redactedObject = redactObject(value as Record<string, unknown>);
    return Object.entries(redactedObject).reduce<Record<string, unknown>>((acc, [key, entry]) => {
      acc[key] = sanitizeRoleAuditValue(isRoleAuditSensitiveKey(key) ? '[REDACTED]' : entry);
      return acc;
    }, {});
  }
  return value;
};

export const sanitizeRoleAuditDetails = (
  details: Readonly<Record<string, unknown>> | undefined
): Record<string, unknown> | undefined => {
  if (!details) {
    return undefined;
  }
  return Object.entries(details).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const redacted = isRoleAuditSensitiveKey(key) ? '[REDACTED]' : redactObject({ [key]: value })[key];
    acc[key] = sanitizeRoleAuditValue(redacted);
    return acc;
  }, {});
};

export const sanitizeRoleErrorMessage = (error: unknown): string =>
  sanitizeRoleAuditString(error instanceof Error ? error.message : String(error));

const mapRoleSyncErrorCode = (error: unknown): RoleSyncErrorCode => {
  if (error instanceof KeycloakAdminUnavailableError) {
    return 'IDP_UNAVAILABLE';
  }
  if (error instanceof KeycloakAdminRequestError) {
    if (error.code === 'connect_timeout' || error.code === 'read_timeout') {
      return 'IDP_TIMEOUT';
    }
    if (error.statusCode === 403) {
      return 'IDP_FORBIDDEN';
    }
    if (error.statusCode === 404) {
      return 'IDP_NOT_FOUND';
    }
    if (error.statusCode === 409) {
      return 'IDP_CONFLICT';
    }
    if (error.statusCode >= 500 || error.statusCode === 429) {
      return 'IDP_UNAVAILABLE';
    }
  }
  return 'IDP_UNKNOWN';
};

const mapRoleListItem = (row: {
  id: string;
  role_key: string;
  role_name: string;
  display_name: string | null;
  external_role_name: string | null;
  managed_by: ManagedBy;
  description: string | null;
  is_system_role: boolean;
  role_level: number;
  member_count: number;
  sync_state: IamRoleSyncState;
  last_synced_at: string | null;
  last_error_code: string | null;
  permission_rows: Array<{ id: string; permission_key: string; description: string | null }> | null;
}): IamRoleListItem => ({
  id: row.id,
  roleKey: row.role_key,
  roleName: row.display_name ?? row.role_name,
  externalRoleName: row.external_role_name ?? row.role_key,
  managedBy: row.managed_by,
  description: row.description ?? undefined,
  isSystemRole: row.is_system_role,
  roleLevel: row.role_level,
  memberCount: row.member_count,
  syncState: row.sync_state,
  lastSyncedAt: row.last_synced_at ?? undefined,
  syncError: row.last_error_code ? { code: row.last_error_code } : undefined,
  permissions:
    row.permission_rows?.map((permission) => ({
      id: permission.id,
      permissionKey: permission.permission_key,
      description: permission.description ?? undefined,
    })) ?? [],
});

const buildRoleSyncFailure = (
  input: {
    error: unknown;
    requestId?: string;
    fallbackMessage: string;
    details?: Readonly<Record<string, unknown>>;
  } & (
    | {
        roleId?: undefined;
      }
    | {
        roleId: string;
      }
  )
): Response => {
  const syncErrorCode = mapRoleSyncErrorCode(input.error);
  const details = {
    syncState: 'failed',
    syncError: { code: syncErrorCode },
    ...input.details,
  } satisfies Readonly<Record<string, unknown>>;

  if (syncErrorCode === 'IDP_CONFLICT') {
    return createApiError(409, 'conflict', input.fallbackMessage, input.requestId, details);
  }

  if (syncErrorCode === 'IDP_FORBIDDEN') {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak-Service-Account hat keine Berechtigung zum Verwalten von Realm-Rollen. Prüfe die realm-management-Rolle manage-realm.',
      input.requestId,
      details
    );
  }

  if (syncErrorCode === 'IDP_UNAVAILABLE' || syncErrorCode === 'IDP_TIMEOUT') {
    return createApiError(503, 'keycloak_unavailable', input.fallbackMessage, input.requestId, details);
  }

  return createApiError(500, 'internal_error', input.fallbackMessage, input.requestId, details);
};

const consumeRateLimit = (
  input: { instanceId: string; actorKeycloakSubject: string; scope: RateScope; requestId?: string } & {
    now?: number;
  }
): Response | null => {
  const limit = input.scope === 'read' ? READ_RATE_LIMIT : input.scope === 'bulk' ? BULK_RATE_LIMIT : WRITE_RATE_LIMIT;
  const now = input.now ?? Date.now();
  const key = `${input.instanceId}:${input.actorKeycloakSubject}:${input.scope}`;
  const existing = rateLimiterStore.get(key);
  if (!existing || now - existing.windowStartedAt >= RATE_WINDOW_MS) {
    rateLimiterStore.set(key, { windowStartedAt: now, count: 1 });
    return null;
  }

  if (existing.count >= limit) {
    return createApiError(
      429,
      'rate_limited',
      'Rate limit überschritten.',
      input.requestId,
      { scope: input.scope, limit, windowSeconds: 60 }
    );
  }

  existing.count += 1;
  rateLimiterStore.set(key, existing);
  return null;
};

const validateCsrf = (request: Request, requestId?: string): Response | null => {
  const header = readString(request.headers.get('x-requested-with'));
  if (!header || header.toLowerCase() !== 'xmlhttprequest') {
    return createApiError(
      403,
      'csrf_validation_failed',
      "Ungültiger CSRF-Header. 'X-Requested-With: XMLHttpRequest' ist erforderlich.",
      requestId
    );
  }

  if (!isTrustedRequestOrigin(request)) {
    return createApiError(
      403,
      'csrf_validation_failed',
      "Ungültige Request-Origin. 'Origin' oder 'Referer' muss vertrauenswürdig sein.",
      requestId
    );
  }

  return null;
};

const normalizeOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const readAllowedOrigins = (raw: string | undefined): ReadonlySet<string> => {
  if (!raw) {
    return new Set();
  }

  const normalized = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => Boolean(entry));

  return new Set(normalized);
};

export const isTrustedRequestOrigin = (
  request: Request,
  allowedOriginsRaw: string | undefined = process.env.IAM_CSRF_ALLOWED_ORIGINS
): boolean => {
  const requestOrigin = normalizeOrigin(request.url);
  if (!requestOrigin) {
    return false;
  }

  const allowedOrigins = new Set<string>([requestOrigin, ...readAllowedOrigins(allowedOriginsRaw)]);

  const originHeader = readString(request.headers.get('origin'));
  if (originHeader) {
    const normalizedOrigin = normalizeOrigin(originHeader);
    return Boolean(normalizedOrigin && allowedOrigins.has(normalizedOrigin));
  }

  const refererHeader = readString(request.headers.get('referer'));
  if (refererHeader) {
    const normalizedRefererOrigin = normalizeOrigin(refererHeader);
    return Boolean(normalizedRefererOrigin && allowedOrigins.has(normalizedRefererOrigin));
  }

  return false;
};

const withInstanceScopedDb = async <T>(instanceId: string, work: (client: QueryClient) => Promise<T>): Promise<T> =>
  withInstanceDb(resolvePool, instanceId, work);

const resolveActorAccountId = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<string | undefined> => {
  const row = await client.query<{ account_id: string }>(
    `
SELECT a.id AS account_id
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1::uuid
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );
  return row.rows[0]?.account_id;
};

const resolveActorMaxRoleLevel = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<number> => {
  const row = await client.query<{ max_role_level: number }>(
    `
SELECT COALESCE(MAX(r.role_level), 0)::int AS max_role_level
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1::uuid
JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE a.keycloak_subject = $2;
`,
    [input.instanceId, input.keycloakSubject]
  );
  return row.rows[0]?.max_role_level ?? 0;
};

const resolveRolesByIds = async (
  client: QueryClient,
  input: { instanceId: string; roleIds: readonly string[] }
): Promise<readonly IamRoleRow[]> => {
  if (input.roleIds.length === 0) {
    return [];
  }

  const result = await client.query<IamRoleRow>(
    `
SELECT id, role_key, role_name, display_name, external_role_name, role_level, is_system_role
FROM iam.roles
WHERE instance_id = $1::uuid
  AND id = ANY($2::uuid[]);
`,
    [input.instanceId, input.roleIds]
  );
  return result.rows;
};

const canAssignRoles = (input: { actorMaxRoleLevel: number; targetRoles: readonly IamRoleRow[] }): boolean =>
  input.targetRoles.every((role) => role.role_level <= input.actorMaxRoleLevel);

const ensureActorCanManageTarget = (input: {
  actorMaxRoleLevel: number;
  actorRoles: readonly string[];
  targetRoles: readonly IamUserRoleAssignment[];
}): { ok: true } | { ok: false; code: ApiErrorCode; message: string } => {
  const targetMaxRoleLevel = input.targetRoles.reduce((maxLevel, role) => Math.max(maxLevel, role.roleLevel), 0);
  if (targetMaxRoleLevel > input.actorMaxRoleLevel) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Zielnutzer überschreitet die eigene Berechtigungsstufe.',
    };
  }

  const targetHasSystemAdmin = input.targetRoles.some((role) => role.roleKey === 'system_admin');
  const actorIsSystemAdmin = input.actorRoles.includes('system_admin');
  if (targetHasSystemAdmin && !actorIsSystemAdmin) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Nur system_admin darf system_admin-Nutzer verwalten.',
    };
  }

  return { ok: true };
};

const resolveSystemAdminCount = async (client: QueryClient, instanceId: string): Promise<number> => {
  const result = await client.query<{ admin_count: number }>(
    `
SELECT COUNT(DISTINCT a.id)::int AS admin_count
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1::uuid
JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE a.status = 'active'
    AND r.role_key = 'system_admin';
`,
    [instanceId]
  );
  return result.rows[0]?.admin_count ?? 0;
};

const isSystemAdminAccount = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
): Promise<boolean> => {
  const result = await client.query<{ has_role: boolean }>(
    `
SELECT EXISTS (
  SELECT 1
  FROM iam.account_roles ar
  JOIN iam.roles r
    ON r.instance_id = ar.instance_id
   AND r.id = ar.role_id
  WHERE ar.instance_id = $1::uuid
    AND ar.account_id = $2::uuid
    AND ar.valid_from <= NOW()
    AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
    AND r.role_key = 'system_admin'
) AS has_role;
`,
    [input.instanceId, input.accountId]
  );
  return Boolean(result.rows[0]?.has_role);
};

const emitActivityLog = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId?: string;
    subjectId?: string;
    eventType: string;
    result: 'success' | 'failure';
    payload?: Record<string, unknown>;
    requestId?: string;
    traceId?: string;
  }
) => {
  await client.query(
    `
INSERT INTO iam.activity_logs (
  instance_id,
  account_id,
  subject_id,
  event_type,
  result,
  payload,
  request_id,
  trace_id
)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7, $8);
`,
    [
      input.instanceId,
      input.accountId ?? null,
      input.subjectId ?? null,
      input.eventType,
      input.result,
      JSON.stringify(input.payload ?? {}),
      input.requestId ?? null,
      input.traceId ?? null,
    ]
  );
};

const emitRoleAuditEvent = async (
  client: QueryClient,
  input: {
    instanceId: string;
    accountId?: string;
    roleId?: string;
    eventType: 'role.sync_started' | 'role.sync_succeeded' | 'role.sync_failed' | 'role.reconciled';
    operation: string;
    result: 'success' | 'failure';
    roleKey?: string;
    externalRoleName?: string;
    errorCode?: string;
    details?: Record<string, unknown>;
    requestId?: string;
    traceId?: string;
  }
) => {
  const sanitizedDetails = sanitizeRoleAuditDetails(input.details);
  await emitActivityLog(client, {
    instanceId: input.instanceId,
    accountId: input.accountId,
    eventType: input.eventType,
    result: input.result,
    payload: {
      workspace_id: input.instanceId,
      operation: input.operation,
      result: input.result,
      ...(input.roleId ? { role_id: input.roleId } : {}),
      ...(input.roleKey ? { role_key: input.roleKey } : {}),
      ...(input.externalRoleName ? { external_role_name: input.externalRoleName } : {}),
      ...(input.errorCode ? { error_code: input.errorCode } : {}),
      ...(input.requestId ? { request_id: input.requestId } : {}),
      ...(input.traceId ? { trace_id: input.traceId } : {}),
      ...sanitizedDetails,
    },
    requestId: input.requestId,
    traceId: input.traceId,
  });
};

const setRoleSyncState = async (
  client: QueryClient,
  input: {
    instanceId: string;
    roleId: string;
    syncState: IamRoleSyncState;
    errorCode?: string | null;
    syncedAt?: boolean;
  }
) => {
  await client.query(
    `
UPDATE iam.roles
SET
  sync_state = $3,
  last_error_code = $4,
  last_synced_at = CASE WHEN $5::boolean THEN NOW() ELSE last_synced_at END,
  updated_at = NOW()
WHERE instance_id = $1::uuid
  AND id = $2::uuid;
`,
    [input.instanceId, input.roleId, input.syncState, input.errorCode ?? null, input.syncedAt ?? false]
  );
};

const notifyPermissionInvalidation = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject?: string; trigger: string }
) => {
  await client.query('SELECT pg_notify($1, $2);', [
    'iam_permission_snapshot_invalidation',
    JSON.stringify({
      instanceId: input.instanceId,
      ...(input.keycloakSubject ? { keycloakSubject: input.keycloakSubject } : {}),
      trigger: 'pg_notify',
      reason: input.trigger,
    }),
  ]);
};

const reserveIdempotency = async (input: {
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
  payloadHash: string;
}): Promise<IdempotencyReserveResult> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query('DELETE FROM iam.idempotency_keys WHERE expires_at < NOW();');

    const insert = await client.query<{ status: IdempotencyStatus }>(
      `
INSERT INTO iam.idempotency_keys (
  instance_id,
  actor_account_id,
  endpoint,
  idempotency_key,
  payload_hash,
  status,
  expires_at
)
VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'IN_PROGRESS', NOW() + INTERVAL '24 hours')
ON CONFLICT (instance_id, actor_account_id, endpoint, idempotency_key) DO NOTHING
RETURNING status;
`,
      [input.instanceId, input.actorAccountId, input.endpoint, input.idempotencyKey, input.payloadHash]
    );

    if (insert.rowCount > 0) {
      return { status: 'reserved' };
    }

    const existing = await client.query<{
      status: IdempotencyStatus;
      payload_hash: string;
      response_status: number | null;
      response_body: unknown;
    }>(
      `
SELECT status, payload_hash, response_status, response_body
FROM iam.idempotency_keys
WHERE instance_id = $1::uuid
  AND actor_account_id = $2::uuid
  AND endpoint = $3
  AND idempotency_key = $4
LIMIT 1;
`,
      [input.instanceId, input.actorAccountId, input.endpoint, input.idempotencyKey]
    );

    const row = existing.rows[0];
    if (!row) {
      return { status: 'reserved' };
    }

    if (row.payload_hash !== input.payloadHash) {
      return {
        status: 'conflict',
        message: 'Idempotency-Key wurde bereits mit anderem Payload verwendet.',
      };
    }

    if (row.status === 'IN_PROGRESS') {
      return {
        status: 'conflict',
        message: 'Idempotenter Request wird bereits verarbeitet.',
      };
    }

    return {
      status: 'replay',
      responseStatus: row.response_status ?? 200,
      responseBody: row.response_body,
    };
  });

const completeIdempotency = async (input: {
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
  status: IdempotencyStatus;
  responseStatus: number;
  responseBody: unknown;
}) => {
  await withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query(
      `
UPDATE iam.idempotency_keys
SET
  status = $5,
  response_status = $6,
  response_body = $7::jsonb,
  updated_at = NOW(),
  expires_at = NOW() + INTERVAL '24 hours'
WHERE actor_account_id = $1::uuid
  AND instance_id = $2::uuid
  AND endpoint = $3
  AND idempotency_key = $4;
`,
      [
        input.actorAccountId,
        input.instanceId,
        input.endpoint,
        input.idempotencyKey,
        input.status,
        input.responseStatus,
        JSON.stringify(input.responseBody),
      ]
    );
  });
};

const ensureFeature = (
  flags: FeatureFlags,
  feature: 'iam_ui' | 'iam_admin' | 'iam_bulk',
  requestId?: string
): Response | null => {
  if (feature === 'iam_ui' && !flags.iamUiEnabled) {
    return createApiError(503, 'feature_disabled', 'Feature iam-ui-enabled ist deaktiviert.', requestId);
  }
  if (feature === 'iam_admin' && !flags.iamAdminEnabled) {
    return createApiError(503, 'feature_disabled', 'Feature iam-admin-enabled ist deaktiviert.', requestId);
  }
  if (feature === 'iam_bulk' && !flags.iamBulkEnabled) {
    return createApiError(503, 'feature_disabled', 'Feature iam-bulk-enabled ist deaktiviert.', requestId);
  }
  return null;
};

const requireRoles = (ctx: AuthenticatedRequestContext, roles: ReadonlySet<string>, requestId?: string) => {
  const hasRole = ctx.user.roles.some((role) => roles.has(role));
  if (!hasRole) {
    return createApiError(403, 'forbidden', 'Unzureichende Berechtigungen.', requestId);
  }
  return null;
};

const resolveActorInfo = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  options?: ResolveActorOptions
): Promise<{ actor: ActorInfo } | { error: Response }> => {
  const requestedInstanceId = readInstanceIdFromRequest(request, ctx.user.instanceId);
  const requestContext = getWorkspaceContext();
  const resolvedInstance = await resolveInstanceId({
    resolvePool,
    candidate: requestedInstanceId,
    createIfMissingFromKey: options?.createMissingInstanceFromKey,
    displayNameForCreate: requestedInstanceId,
  });
  if (!resolvedInstance.ok) {
    const status = resolvedInstance.reason === 'database_unavailable' ? 503 : 400;
    const code = resolvedInstance.reason === 'database_unavailable' ? 'database_unavailable' : 'invalid_instance_id';
    const message =
      resolvedInstance.reason === 'database_unavailable'
        ? 'IAM-Datenbank ist nicht erreichbar.'
        : 'Ungültige oder fehlende instanceId.';
    return {
      error: createApiError(
        status,
        code,
        message,
        requestContext.requestId
      ),
    };
  }
  const instanceId = resolvedInstance.instanceId;

  let actorAccountId: string | undefined;
  try {
    actorAccountId = await withInstanceScopedDb(instanceId, (client) =>
      resolveActorAccountId(client, { instanceId, keycloakSubject: ctx.user.id })
    );
  } catch {
    return {
      error: createApiError(
        503,
        'database_unavailable',
        'IAM-Datenbank ist nicht erreichbar.',
        requestContext.requestId
      ),
    };
  }

  if (options?.requireActorMembership && !actorAccountId) {
    return {
      error: createApiError(
        403,
        'forbidden',
        'Akteur-Account nicht gefunden.',
        requestContext.requestId
      ),
    };
  }

  return {
    actor: {
      instanceId,
      requestId: requestContext.requestId,
      traceId: requestContext.traceId,
      actorAccountId,
    },
  };
};

const mapRoles = (roles: readonly IamRoleRow[]): readonly IamUserRoleAssignment[] =>
  roles.map((role) => ({
    roleId: role.id,
    roleKey: role.role_key,
    roleName: getRoleDisplayName(role),
    roleLevel: role.role_level,
  }));

export const resolveUserDisplayName = (input: {
  decryptedDisplayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  keycloakSubject: string;
}): string => {
  const fullName = [input.firstName, input.lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();

  if (input.decryptedDisplayName && input.decryptedDisplayName.trim().length > 0) {
    return input.decryptedDisplayName;
  }

  return fullName || input.keycloakSubject;
};

const mapUserRowToListItem = (row: {
  id: string;
  keycloak_subject: string;
  display_name_ciphertext: string | null;
  first_name_ciphertext?: string | null;
  last_name_ciphertext?: string | null;
  email_ciphertext: string | null;
  position: string | null;
  department: string | null;
  status: UserStatus;
  last_login_at: string | null;
  roles: readonly IamRoleRow[];
}): IamUserListItem => {
  const decryptedDisplayName = revealField(
    row.display_name_ciphertext,
    `iam.accounts.display_name:${row.keycloak_subject}`
  );
  const firstName = revealField(row.first_name_ciphertext, `iam.accounts.first_name:${row.keycloak_subject}`);
  const lastName = revealField(row.last_name_ciphertext, `iam.accounts.last_name:${row.keycloak_subject}`);
  const displayName = resolveUserDisplayName({
    decryptedDisplayName,
    firstName,
    lastName,
    keycloakSubject: row.keycloak_subject,
  });
  const email = revealField(row.email_ciphertext, `iam.accounts.email:${row.keycloak_subject}`);
  return {
    id: row.id,
    keycloakSubject: row.keycloak_subject,
    displayName,
    email,
    status: row.status,
    position: row.position ?? undefined,
    department: row.department ?? undefined,
    lastLoginAt: row.last_login_at ?? undefined,
    roles: mapRoles(row.roles),
  };
};

const resolveUsersWithPagination = async (
  client: QueryClient,
  input: {
    instanceId: string;
    page: number;
    pageSize: number;
    status?: UserStatus;
    role?: string;
    search?: string;
  }
): Promise<{ total: number; users: readonly IamUserListItem[] }> => {
  const offset = (input.page - 1) * input.pageSize;
  const totalResult = await client.query<{ total: number }>(
    `
SELECT COUNT(DISTINCT a.id)::int AS total
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1::uuid
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE ($2::text IS NULL OR a.status = $2)
  AND ($3::text IS NULL OR r.role_key = $3)
  AND (
    $4::text IS NULL OR
    a.keycloak_subject ILIKE '%' || $4 || '%' OR
    COALESCE(a.position, '') ILIKE '%' || $4 || '%' OR
    COALESCE(a.department, '') ILIKE '%' || $4 || '%'
  );
`,
    [input.instanceId, input.status ?? null, input.role ?? null, input.search ?? null]
  );

  const rows = await client.query<{
    id: string;
    keycloak_subject: string;
    display_name_ciphertext: string | null;
    first_name_ciphertext: string | null;
    last_name_ciphertext: string | null;
    email_ciphertext: string | null;
    position: string | null;
    department: string | null;
    status: UserStatus;
    last_login_at: string | null;
    role_rows: Array<{
      id: string;
      role_key: string;
      role_name: string;
      display_name: string | null;
      role_level: number;
      is_system_role: boolean;
    }> | null;
    permission_rows: Array<{ permission_key: string }> | null;
  }>(
    `
SELECT
  a.id,
  a.keycloak_subject,
  a.display_name_ciphertext,
  a.first_name_ciphertext,
  a.last_name_ciphertext,
  a.email_ciphertext,
  a.position,
  a.department,
  a.status,
  MAX(al.created_at)::text AS last_login_at,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', r.id,
        'role_key', r.role_key,
        'role_name', r.role_name,
        'display_name', r.display_name,
        'role_level', r.role_level,
        'is_system_role', r.is_system_role
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1::uuid
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
LEFT JOIN iam.role_permissions rp
  ON rp.instance_id = r.instance_id
 AND rp.role_id = r.id
LEFT JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
LEFT JOIN iam.activity_logs al
  ON al.instance_id = im.instance_id
 AND al.account_id = a.id
 AND al.event_type = 'login'
WHERE ($2::text IS NULL OR a.status = $2)
  AND ($3::text IS NULL OR r.role_key = $3)
  AND (
    $4::text IS NULL OR
    a.keycloak_subject ILIKE '%' || $4 || '%' OR
    COALESCE(a.position, '') ILIKE '%' || $4 || '%' OR
    COALESCE(a.department, '') ILIKE '%' || $4 || '%'
  )
GROUP BY a.id
ORDER BY a.created_at DESC
LIMIT $5 OFFSET $6;
`,
    [input.instanceId, input.status ?? null, input.role ?? null, input.search ?? null, input.pageSize, offset]
  );

  const users = rows.rows.map((row) =>
    mapUserRowToListItem({
      ...row,
      roles:
        row.role_rows?.map((entry) => ({
          id: entry.id,
          role_key: entry.role_key,
          role_name: entry.role_name,
          display_name: entry.display_name,
          role_level: Number(entry.role_level),
          is_system_role: Boolean(entry.is_system_role),
        })) ?? [],
    })
  );
  return {
    total: totalResult.rows[0]?.total ?? 0,
    users,
  };
};

const resolveUserDetail = async (
  client: QueryClient,
  input: { instanceId: string; userId: string }
): Promise<IamUserDetail | undefined> => {
  const result = await client.query<{
    id: string;
    keycloak_subject: string;
    display_name_ciphertext: string | null;
    email_ciphertext: string | null;
    first_name_ciphertext: string | null;
    last_name_ciphertext: string | null;
    phone_ciphertext: string | null;
    position: string | null;
    department: string | null;
    preferred_language: string | null;
    timezone: string | null;
    avatar_url: string | null;
    notes: string | null;
    status: UserStatus;
    last_login_at: string | null;
    role_rows: Array<{
      id: string;
      role_key: string;
      role_name: string;
      display_name: string | null;
      role_level: number;
      is_system_role: boolean;
    }> | null;
    permission_rows: Array<{ permission_key: string }> | null;
  }>(
    `
SELECT
  a.id,
  a.keycloak_subject,
  a.display_name_ciphertext,
  a.email_ciphertext,
  a.first_name_ciphertext,
  a.last_name_ciphertext,
  a.phone_ciphertext,
  a.position,
  a.department,
  a.preferred_language,
  a.timezone,
  a.avatar_url,
  a.notes,
  a.status,
  MAX(al.created_at)::text AS last_login_at,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', r.id,
        'role_key', r.role_key,
        'role_name', r.role_name,
        'display_name', r.display_name,
        'role_level', r.role_level,
        'is_system_role', r.is_system_role
      )
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) AS role_rows,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'permission_key', p.permission_key
      )
    ) FILTER (WHERE p.permission_key IS NOT NULL),
    '[]'::json
  ) AS permission_rows
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1::uuid
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = im.instance_id
 AND ar.account_id = im.account_id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
LEFT JOIN iam.role_permissions rp
  ON rp.instance_id = r.instance_id
 AND rp.role_id = r.id
LEFT JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
LEFT JOIN iam.activity_logs al
  ON al.instance_id = im.instance_id
 AND al.account_id = a.id
 AND al.event_type = 'login'
WHERE a.id = $2::uuid
GROUP BY a.id;
`,
    [input.instanceId, input.userId]
  );
  const row = result.rows[0];
  if (!row) {
    return undefined;
  }

  const base = mapUserRowToListItem({
    id: row.id,
    keycloak_subject: row.keycloak_subject,
    display_name_ciphertext: row.display_name_ciphertext,
    first_name_ciphertext: row.first_name_ciphertext,
    last_name_ciphertext: row.last_name_ciphertext,
    email_ciphertext: row.email_ciphertext,
    position: row.position,
    department: row.department,
    status: row.status,
    last_login_at: row.last_login_at,
    roles:
      row.role_rows?.map((entry) => ({
        id: entry.id,
        role_key: entry.role_key,
        role_name: entry.role_name,
        display_name: entry.display_name,
        role_level: Number(entry.role_level),
        is_system_role: Boolean(entry.is_system_role),
      })) ?? [],
  });

  return {
    ...base,
    firstName: revealField(row.first_name_ciphertext, `iam.accounts.first_name:${row.keycloak_subject}`),
    lastName: revealField(row.last_name_ciphertext, `iam.accounts.last_name:${row.keycloak_subject}`),
    phone: revealField(row.phone_ciphertext, `iam.accounts.phone:${row.keycloak_subject}`),
    preferredLanguage: row.preferred_language ?? undefined,
    timezone: row.timezone ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    notes: row.notes ?? undefined,
    permissions: row.permission_rows?.map((entry) => entry.permission_key) ?? [],
  };
};

const requireIdempotencyKey = (request: Request, requestId?: string): { key: string } | { error: Response } => {
  const idempotencyKey = readString(request.headers.get('idempotency-key'));
  if (!idempotencyKey) {
    return {
      error: createApiError(
        400,
        'idempotency_key_required',
        'Header Idempotency-Key ist erforderlich.',
        requestId
      ),
    };
  }
  return { key: idempotencyKey };
};

const ensureRoleAssignmentWithinActorLevel = async (input: {
  client: QueryClient;
  instanceId: string;
  actorSubject: string;
  roleIds: readonly string[];
}): Promise<{ ok: true; roles: readonly IamRoleRow[] } | { ok: false; code: ApiErrorCode; message: string }> => {
  const roles = await resolveRolesByIds(input.client, {
    instanceId: input.instanceId,
    roleIds: input.roleIds,
  });
  if (roles.length !== input.roleIds.length) {
    return { ok: false, code: 'invalid_request', message: 'Mindestens eine Rolle existiert nicht.' };
  }

  const actorMaxRoleLevel = await resolveActorMaxRoleLevel(input.client, {
    instanceId: input.instanceId,
    keycloakSubject: input.actorSubject,
  });
  if (!canAssignRoles({ actorMaxRoleLevel, targetRoles: roles })) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Rollenzuweisung überschreitet die eigene Berechtigungsstufe.',
    };
  }
  return { ok: true, roles };
};

const assignRoles = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; roleIds: readonly string[]; assignedBy?: string }
) => {
  await client.query('DELETE FROM iam.account_roles WHERE instance_id = $1::uuid AND account_id = $2::uuid;', [
    input.instanceId,
    input.accountId,
  ]);
  if (input.roleIds.length === 0) {
    return;
  }
  await client.query(
    `
INSERT INTO iam.account_roles (
  instance_id,
  account_id,
  role_id,
  assigned_by,
  valid_from
)
SELECT $1::uuid, $2::uuid, role_id, $3::uuid, NOW()
FROM unnest($4::uuid[]) AS role_id;
`,
    [input.instanceId, input.accountId, input.assignedBy ?? null, input.roleIds]
  );
};

const loadRoleListItems = async (client: QueryClient, instanceId: string): Promise<readonly IamRoleListItem[]> => {
  const result = await client.query<{
    id: string;
    role_key: string;
    role_name: string;
    display_name: string | null;
    external_role_name: string | null;
    managed_by: ManagedBy;
    description: string | null;
    is_system_role: boolean;
    role_level: number;
    member_count: number;
    sync_state: IamRoleSyncState;
    last_synced_at: string | null;
    last_error_code: string | null;
    permission_rows: Array<{ id: string; permission_key: string; description: string | null }> | null;
  }>(
    `
SELECT
  r.id,
  r.role_key,
  r.role_name,
  r.display_name,
  r.external_role_name,
  r.managed_by,
  r.description,
  r.is_system_role,
  r.role_level,
  COUNT(DISTINCT ar.account_id)::int AS member_count,
  r.sync_state,
  r.last_synced_at::text,
  r.last_error_code,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', p.id,
        'permission_key', p.permission_key,
        'description', p.description
      )
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'::json
  ) AS permission_rows
FROM iam.roles r
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = r.instance_id
 AND ar.role_id = r.id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.role_permissions rp
  ON rp.instance_id = r.instance_id
 AND rp.role_id = r.id
LEFT JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE r.instance_id = $1::uuid
GROUP BY r.id
ORDER BY r.role_level DESC, COALESCE(r.display_name, r.role_name) ASC;
`,
    [instanceId]
  );

  return result.rows.map(mapRoleListItem);
};

const loadRoleById = async (
  client: QueryClient,
  input: { instanceId: string; roleId: string }
): Promise<ManagedRoleRow | undefined> => {
  const result = await client.query<ManagedRoleRow>(
    `
SELECT
  id,
  role_key,
  role_name,
  display_name,
  external_role_name,
  description,
  is_system_role,
  role_level,
  managed_by,
  sync_state,
  last_synced_at::text,
  last_error_code
FROM iam.roles
WHERE instance_id = $1::uuid
  AND id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.roleId]
  );
  return result.rows[0];
};

const loadRoleListItemById = async (
  client: QueryClient,
  input: { instanceId: string; roleId: string }
): Promise<IamRoleListItem | undefined> => {
  const result = await client.query<{
    id: string;
    role_key: string;
    role_name: string;
    display_name: string | null;
    external_role_name: string | null;
    managed_by: ManagedBy;
    description: string | null;
    is_system_role: boolean;
    role_level: number;
    member_count: number;
    sync_state: IamRoleSyncState;
    last_synced_at: string | null;
    last_error_code: string | null;
    permission_rows: Array<{ id: string; permission_key: string; description: string | null }> | null;
  }>(
    `
SELECT
  r.id,
  r.role_key,
  r.role_name,
  r.display_name,
  r.external_role_name,
  r.managed_by,
  r.description,
  r.is_system_role,
  r.role_level,
  COUNT(DISTINCT ar.account_id)::int AS member_count,
  r.sync_state,
  r.last_synced_at::text,
  r.last_error_code,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', p.id,
        'permission_key', p.permission_key,
        'description', p.description
      )
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'::json
  ) AS permission_rows
FROM iam.roles r
LEFT JOIN iam.account_roles ar
  ON ar.instance_id = r.instance_id
 AND ar.role_id = r.id
 AND ar.valid_from <= NOW()
 AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
LEFT JOIN iam.role_permissions rp
  ON rp.instance_id = r.instance_id
 AND rp.role_id = r.id
LEFT JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE r.instance_id = $1::uuid
  AND r.id = $2::uuid
GROUP BY r.id
LIMIT 1;
`,
    [input.instanceId, input.roleId]
  );
  const row = result.rows[0];
  return row ? mapRoleListItem(row) : undefined;
};

type ReconcileRoleEntry = {
  readonly roleId?: string;
  readonly roleKey?: string;
  readonly externalRoleName: string;
  readonly action: 'noop' | 'create' | 'update' | 'report';
  readonly status: 'synced' | 'corrected' | 'failed' | 'requires_manual_action';
  readonly errorCode?: string;
};

type ReconcileReport = {
  readonly checkedCount: number;
  readonly correctedCount: number;
  readonly failedCount: number;
  readonly requiresManualActionCount: number;
  readonly roles: readonly ReconcileRoleEntry[];
};

const readRoleAttribute = (
  attributes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string
): string | undefined => {
  const values = attributes?.[key];
  return Array.isArray(values) ? readString(values[0]) : undefined;
};

const isStudioManagedIdentityRole = (
  role: Awaited<ReturnType<IdentityProviderPort['getRoleByName']>> extends infer T
    ? Exclude<T, null>
    : never,
  instanceId: string
): boolean =>
  readRoleAttribute(role.attributes, 'managed_by') === 'studio' &&
  readRoleAttribute(role.attributes, 'instance_id') === instanceId;

const runRoleCatalogReconciliation = async (input: {
  instanceId: string;
  actorAccountId?: string;
  requestId?: string;
  traceId?: string;
}): Promise<ReconcileReport> => {
  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    throw new Error('identity_provider_unavailable');
  }

  const dbRoles = await withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<ManagedRoleRow>(
      `
SELECT
  id,
  role_key,
  role_name,
  display_name,
  external_role_name,
  description,
  is_system_role,
  role_level,
  managed_by,
  sync_state,
  last_synced_at::text,
  last_error_code
FROM iam.roles
WHERE instance_id = $1::uuid
  AND managed_by = 'studio'
ORDER BY role_level DESC, COALESCE(display_name, role_name) ASC;
`,
      [input.instanceId]
    );
    return result.rows;
  });

  const idpRoles = await trackKeycloakCall('reconcile_list_roles', () => identityProvider.provider.listRoles());
  const managedIdpRoles = idpRoles.filter((role) => isStudioManagedIdentityRole(role, input.instanceId));
  const idpByExternalName = new Map(managedIdpRoles.map((role) => [role.externalName, role]));
  const dbByExternalName = new Map(dbRoles.map((role) => [getRoleExternalName(role), role]));

  const entries: ReconcileRoleEntry[] = [];

  for (const role of dbRoles) {
    const externalRoleName = getRoleExternalName(role);
    const matchingIdentityRole = idpByExternalName.get(externalRoleName);
    const expectedDisplayName = getRoleDisplayName(role);
    const identityDisplayName = readRoleAttribute(matchingIdentityRole?.attributes, 'display_name');

    if (!matchingIdentityRole) {
      try {
        await trackKeycloakCall('reconcile_create_role', () =>
          identityProvider.provider.createRole({
            externalName: externalRoleName,
            description: role.description ?? undefined,
            attributes: {
              managedBy: 'studio',
              instanceId: input.instanceId,
              roleKey: role.role_key,
              displayName: expectedDisplayName,
            },
          })
        );
        await withInstanceScopedDb(input.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'synced',
            errorCode: null,
            syncedAt: true,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_create',
            result: 'success',
            roleKey: role.role_key,
            externalRoleName,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName,
          action: 'create',
          status: 'corrected',
        });
      } catch (error) {
        const errorCode = mapRoleSyncErrorCode(error);
        await withInstanceScopedDb(input.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'failed',
            errorCode,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_create',
            result: 'failure',
            roleKey: role.role_key,
            externalRoleName,
            errorCode,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName,
          action: 'create',
          status: 'failed',
          errorCode,
        });
      }
      continue;
    }

    const descriptionChanged = (matchingIdentityRole.description ?? undefined) !== (role.description ?? undefined);
    const displayNameChanged = identityDisplayName !== expectedDisplayName;
    const roleKeyChanged = readRoleAttribute(matchingIdentityRole.attributes, 'role_key') !== role.role_key;

    if (descriptionChanged || displayNameChanged || roleKeyChanged || role.sync_state !== 'synced') {
      try {
        await trackKeycloakCall('reconcile_update_role', () =>
          identityProvider.provider.updateRole(externalRoleName, {
            description: role.description ?? undefined,
            attributes: {
              managedBy: 'studio',
              instanceId: input.instanceId,
              roleKey: role.role_key,
              displayName: expectedDisplayName,
            },
          })
        );
        await withInstanceScopedDb(input.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'synced',
            errorCode: null,
            syncedAt: true,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_update',
            result: 'success',
            roleKey: role.role_key,
            externalRoleName,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName,
          action: 'update',
          status: 'corrected',
        });
      } catch (error) {
        const errorCode = mapRoleSyncErrorCode(error);
        await withInstanceScopedDb(input.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: input.instanceId,
            roleId: role.id,
            syncState: 'failed',
            errorCode,
          });
          await emitRoleAuditEvent(client, {
            instanceId: input.instanceId,
            accountId: input.actorAccountId,
            roleId: role.id,
            eventType: 'role.reconciled',
            operation: 'reconcile_update',
            result: 'failure',
            roleKey: role.role_key,
            externalRoleName,
            errorCode,
            requestId: input.requestId,
            traceId: input.traceId,
          });
        });
        entries.push({
          roleId: role.id,
          roleKey: role.role_key,
          externalRoleName,
          action: 'update',
          status: 'failed',
          errorCode,
        });
      }
      continue;
    }

    entries.push({
      roleId: role.id,
      roleKey: role.role_key,
      externalRoleName,
      action: 'noop',
      status: 'synced',
    });
  }

  for (const identityRole of managedIdpRoles) {
    if (!dbByExternalName.has(identityRole.externalName)) {
      entries.push({
        externalRoleName: identityRole.externalName,
        roleKey: readRoleAttribute(identityRole.attributes, 'role_key'),
        action: 'report',
        status: 'requires_manual_action',
        errorCode: 'REQUIRES_MANUAL_ACTION',
      });
    }
  }

  const report = {
    checkedCount: dbRoles.length,
    correctedCount: entries.filter((entry) => entry.status === 'corrected').length,
    failedCount: entries.filter((entry) => entry.status === 'failed').length,
    requiresManualActionCount: entries.filter((entry) => entry.status === 'requires_manual_action').length,
    roles: entries,
  } satisfies ReconcileReport;

  roleDriftBacklogByInstance.set(input.instanceId, report.failedCount + report.requiresManualActionCount);
  return report;
};

const listUsersInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const { page, pageSize } = readPage(request);
  const url = new URL(request.url);
  const status = readString(url.searchParams.get('status')) as UserStatus | undefined;
  const role = readString(url.searchParams.get('role'));
  const search = readString(url.searchParams.get('search'));

  if (status && !USER_STATUS.includes(status)) {
    return createApiError(400, 'invalid_request', 'Ungültiger Status-Filter.', actorResolution.actor.requestId);
  }

  try {
    const data = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      resolveUsersWithPagination(client, {
        instanceId: actorResolution.actor.instanceId,
        page,
        pageSize,
        status,
        role: role ?? undefined,
        search: search ?? undefined,
      })
    );

    return jsonResponse(
      200,
      asApiList(data.users, { page, pageSize, total: data.total }, actorResolution.actor.requestId)
    );
  } catch (error) {
    logger.error('IAM user list failed', {
      operation: 'list_users',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'IAM-Datenbank ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
  }
};

const getUserInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const userId = readPathSegment(request, 4);
  if (!userId || !isUuid(userId)) {
    return createApiError(400, 'invalid_request', 'Ungültige userId.', actorResolution.actor.requestId);
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const user = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      resolveUserDetail(client, { instanceId: actorResolution.actor.instanceId, userId })
    );
    if (!user) {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', actorResolution.actor.requestId);
    }
    return jsonResponse(200, asApiItem(user, actorResolution.actor.requestId));
  } catch {
    return createApiError(
      503,
      'database_unavailable',
      'IAM-Datenbank ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
  }
};

const createUserInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const idempotencyKey = requireIdempotencyKey(request, actorResolution.actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, createUserSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }
  const payloadHash = toPayloadHash(parsed.rawBody);
  const reserve = await reserveIdempotency({
    instanceId: actorResolution.actor.instanceId,
    actorAccountId: actorResolution.actor.actorAccountId,
    endpoint: 'POST:/api/v1/iam/users',
    idempotencyKey: idempotencyKey.key,
    payloadHash,
  });

  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(
      409,
      'idempotency_key_reuse',
      reserve.message,
      actorResolution.actor.requestId
    );
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    const response = {
      error: {
        code: 'keycloak_unavailable',
        message: 'Keycloak Admin API ist nicht konfiguriert.',
      },
      ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
    } satisfies ApiErrorResponse;
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/users',
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: 503,
      responseBody: response,
    });
    return jsonResponse(503, response);
  }

  let createdExternalId: string | undefined;
  try {
    const createdIdentityUser = await trackKeycloakCall('create_user', () =>
      identityProvider.provider.createUser({
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        enabled: parsed.data.status !== 'inactive',
      })
    );
    const externalId = createdIdentityUser.externalId;
    createdExternalId = externalId;

    const result = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const roleValidation = await ensureRoleAssignmentWithinActorLevel({
        client,
        instanceId: actorResolution.actor.instanceId,
        actorSubject: ctx.user.id,
        roleIds: parsed.data.roleIds,
      });
      if (!roleValidation.ok) {
        throw new Error(`${roleValidation.code}:${roleValidation.message}`);
      }

      const inserted = await client.query<{ id: string }>(
        `
INSERT INTO iam.accounts (
  instance_id,
  keycloak_subject,
  email_ciphertext,
  display_name_ciphertext,
  first_name_ciphertext,
  last_name_ciphertext,
  phone_ciphertext,
  position,
  department,
  avatar_url,
  preferred_language,
  timezone,
  status,
  notes
)
VALUES (
  $1::uuid,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  $8,
  $9,
  $10,
  $11,
  $12,
  $13,
  $14
)
RETURNING id;
`,
        [
          actorResolution.actor.instanceId,
          externalId,
          protectField(parsed.data.email, `iam.accounts.email:${externalId}`),
          protectField(
            parsed.data.displayName ?? [parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(' '),
            `iam.accounts.display_name:${externalId}`
          ),
          protectField(parsed.data.firstName, `iam.accounts.first_name:${externalId}`),
          protectField(parsed.data.lastName, `iam.accounts.last_name:${externalId}`),
          protectField(parsed.data.phone, `iam.accounts.phone:${externalId}`),
          parsed.data.position ?? null,
          parsed.data.department ?? null,
          parsed.data.avatarUrl ?? null,
          parsed.data.preferredLanguage ?? null,
          parsed.data.timezone ?? null,
          parsed.data.status ?? 'pending',
          parsed.data.notes ?? null,
        ]
      );

      const accountId = inserted.rows[0]?.id;
      if (!accountId) {
        throw new Error('conflict:Account konnte nicht erstellt werden.');
      }

      await client.query(
        `
INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)
VALUES ($1::uuid, $2::uuid, 'member')
ON CONFLICT (instance_id, account_id) DO NOTHING;
`,
        [actorResolution.actor.instanceId, accountId]
      );

      await assignRoles(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId,
        roleIds: parsed.data.roleIds,
        assignedBy: actorResolution.actor.actorAccountId,
      });

      const assignedRoleRows = await resolveRolesByIds(client, {
        instanceId: actorResolution.actor.instanceId,
        roleIds: parsed.data.roleIds,
      });

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        subjectId: accountId,
        eventType: 'user.created',
        result: 'success',
        payload: {
          target_keycloak_subject: externalId,
          role_count: parsed.data.roleIds.length,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: externalId,
        trigger: 'user_role_changed',
      });

      const responseData: IamUserDetail = {
        id: accountId,
        keycloakSubject: externalId,
        displayName: parsed.data.displayName ?? ([parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(' ') || externalId),
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        position: parsed.data.position,
        department: parsed.data.department,
        preferredLanguage: parsed.data.preferredLanguage,
        timezone: parsed.data.timezone,
        avatarUrl: parsed.data.avatarUrl,
        notes: parsed.data.notes,
        status: parsed.data.status ?? 'pending',
        roles: mapRoles(assignedRoleRows),
      };

      return {
        accountId,
        roleNames: assignedRoleRows.map((entry) => getRoleExternalName(entry)),
        responseData,
      };
    });

    if (result.roleNames.length > 0) {
      await trackKeycloakCall('sync_roles', () =>
        identityProvider.provider.syncRoles(result.responseData.keycloakSubject, result.roleNames)
      );
    }

    iamUserOperationsCounter.add(1, { action: 'create_user', result: 'success' });
    const responseBody = asApiItem(result.responseData, actorResolution.actor.requestId);
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/users',
      idempotencyKey: idempotencyKey.key,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody,
    });
    return jsonResponse(201, responseBody);
  } catch (error) {
    logger.error('IAM user creation failed', {
      operation: 'create_user',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      actor_account_id: actorResolution.actor.actorAccountId,
      email_masked: maskEmail(parsed.data.email),
      error: error instanceof Error ? error.message : String(error),
    });

    if (createdExternalId) {
      try {
        const identityProvider = resolveIdentityProvider();
        if (identityProvider) {
          await trackKeycloakCall('deactivate_user_compensation', () =>
            identityProvider.provider.deactivateUser(createdExternalId!)
          );
        }
      } catch (compensationError) {
        logger.error('IAM user create compensation failed', {
          operation: 'create_user_compensation',
          keycloak_subject: createdExternalId,
          request_id: actorResolution.actor.requestId,
          trace_id: actorResolution.actor.traceId,
          error: compensationError instanceof Error ? compensationError.message : String(compensationError),
        });
      }
    }

    iamUserOperationsCounter.add(1, { action: 'create_user', result: 'failure' });

    const errorBody = {
      error: {
        code: 'internal_error',
        message: 'Nutzer konnte nicht erstellt werden.',
      },
      ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
    } satisfies ApiErrorResponse;
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/users',
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: 500,
      responseBody: errorBody,
    });
    return jsonResponse(500, errorBody);
  }
};

const updateUserInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const userId = readPathSegment(request, 4);
  if (!userId || !isUuid(userId)) {
    return createApiError(400, 'invalid_request', 'Ungültige userId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const parsed = await parseRequestBody(request, updateUserSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      actorResolution.actor.requestId
    );
  }

  try {
    const result = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: ctx.user.id,
      });
      const existing = await resolveUserDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        userId,
      });
      if (!existing) {
        return undefined;
      }

      const targetAccessCheck = ensureActorCanManageTarget({
        actorMaxRoleLevel,
        actorRoles: ctx.user.roles,
        targetRoles: existing.roles,
      });
      if (!targetAccessCheck.ok) {
        throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
      }

      let syncedRoleNames: readonly string[] | undefined;
      if (parsed.data.roleIds) {
        const roleValidation = await ensureRoleAssignmentWithinActorLevel({
          client,
          instanceId: actorResolution.actor.instanceId,
          actorSubject: ctx.user.id,
          roleIds: parsed.data.roleIds,
        });
        if (!roleValidation.ok) {
          throw new Error(`${roleValidation.code}:${roleValidation.message}`);
        }
        await assignRoles(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: userId,
          roleIds: parsed.data.roleIds,
          assignedBy: actorResolution.actor.actorAccountId,
        });
        const assignedRoles = await resolveRolesByIds(client, {
          instanceId: actorResolution.actor.instanceId,
          roleIds: parsed.data.roleIds,
        });
        syncedRoleNames = assignedRoles.map((role) => getRoleExternalName(role));

        await notifyPermissionInvalidation(client, {
          instanceId: actorResolution.actor.instanceId,
          keycloakSubject: existing.keycloakSubject,
          trigger: 'user_role_changed',
        });
      }

      if (parsed.data.status === 'inactive') {
        const lastAdmin = await isSystemAdminAccount(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: userId,
        });
        if (lastAdmin) {
          const adminCount = await resolveSystemAdminCount(client, actorResolution.actor.instanceId);
          if (adminCount <= 1) {
            throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
          }
        }
      }

      await client.query(
        `
UPDATE iam.accounts
SET
  email_ciphertext = COALESCE($3, email_ciphertext),
  display_name_ciphertext = COALESCE($4, display_name_ciphertext),
  first_name_ciphertext = COALESCE($5, first_name_ciphertext),
  last_name_ciphertext = COALESCE($6, last_name_ciphertext),
  phone_ciphertext = COALESCE($7, phone_ciphertext),
  position = COALESCE($8, position),
  department = COALESCE($9, department),
  avatar_url = COALESCE($10, avatar_url),
  preferred_language = COALESCE($11, preferred_language),
  timezone = COALESCE($12, timezone),
  status = COALESCE($13, status),
  notes = COALESCE($14, notes),
  updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2::uuid;
`,
        [
          userId,
          actorResolution.actor.instanceId,
          parsed.data.email
            ? protectField(parsed.data.email, `iam.accounts.email:${existing.keycloakSubject}`)
            : null,
          parsed.data.displayName
            ? protectField(parsed.data.displayName, `iam.accounts.display_name:${existing.keycloakSubject}`)
            : null,
          parsed.data.firstName
            ? protectField(parsed.data.firstName, `iam.accounts.first_name:${existing.keycloakSubject}`)
            : null,
          parsed.data.lastName
            ? protectField(parsed.data.lastName, `iam.accounts.last_name:${existing.keycloakSubject}`)
            : null,
          parsed.data.phone ? protectField(parsed.data.phone, `iam.accounts.phone:${existing.keycloakSubject}`) : null,
          parsed.data.position ?? null,
          parsed.data.department ?? null,
          parsed.data.avatarUrl ?? null,
          parsed.data.preferredLanguage ?? null,
          parsed.data.timezone ?? null,
          parsed.data.status ?? null,
          parsed.data.notes ?? null,
        ]
      );

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        subjectId: userId,
        eventType: 'user.updated',
        result: 'success',
        payload: {
          status: parsed.data.status ?? existing.status,
          role_update: Boolean(parsed.data.roleIds),
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: existing.keycloakSubject,
        trigger: 'user_updated',
      });

      return {
        detail: await resolveUserDetail(client, {
          instanceId: actorResolution.actor.instanceId,
          userId,
        }),
        roleNames: syncedRoleNames,
      };
    });

    if (!result?.detail) {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', actorResolution.actor.requestId);
    }
    const detail = result.detail;
    const roleNames = result.roleNames;

    await trackKeycloakCall('update_user', () =>
      identityProvider.provider.updateUser(detail.keycloakSubject, {
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        enabled: parsed.data.status ? parsed.data.status !== 'inactive' : undefined,
      })
    );

    if (parsed.data.status === 'inactive') {
      await trackKeycloakCall('deactivate_user', () =>
        identityProvider.provider.deactivateUser(detail.keycloakSubject)
      );
    }

    if (roleNames) {
      await trackKeycloakCall('sync_roles', () =>
        identityProvider.provider.syncRoles(detail.keycloakSubject, [...roleNames])
      );
    }

    iamUserOperationsCounter.add(1, { action: 'update_user', result: 'success' });
    return jsonResponse(200, asApiItem(detail, actorResolution.actor.requestId));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const [errorCode, errorDetail] = errorMessage.split(':', 2);
    if (errorCode === 'last_admin_protection') {
      return createApiError(
        409,
        'last_admin_protection',
        'Letzter aktiver system_admin kann nicht deaktiviert werden.',
        actorResolution.actor.requestId
      );
    }
    if (errorCode === 'forbidden') {
      return createApiError(
        403,
        'forbidden',
        errorDetail ?? 'Änderung dieses Nutzers ist nicht erlaubt.',
        actorResolution.actor.requestId
      );
    }
    if (errorCode === 'invalid_request') {
      return createApiError(400, 'invalid_request', 'Ungültige Rolle.', actorResolution.actor.requestId);
    }
    if (errorCode === 'pii_encryption_required') {
      return createApiError(
        503,
        'internal_error',
        'PII-Verschlüsselung ist nicht konfiguriert.',
        actorResolution.actor.requestId
      );
    }

    logger.error('IAM user update failed', {
      operation: 'update_user',
      instance_id: actorResolution.actor.instanceId,
      user_id: userId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: errorMessage,
    });
    iamUserOperationsCounter.add(1, { action: 'update_user', result: 'failure' });
    return createApiError(500, 'internal_error', 'Nutzer konnte nicht aktualisiert werden.', actorResolution.actor.requestId);
  }
};

const deactivateUserInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const userId = readPathSegment(request, 4);
  if (!userId || !isUuid(userId)) {
    return createApiError(400, 'invalid_request', 'Ungültige userId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      actorResolution.actor.requestId
    );
  }

  try {
    const detail = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: ctx.user.id,
      });
      const existing = await resolveUserDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        userId,
      });
      if (!existing) {
        return undefined;
      }

      const targetAccessCheck = ensureActorCanManageTarget({
        actorMaxRoleLevel,
        actorRoles: ctx.user.roles,
        targetRoles: existing.roles,
      });
      if (!targetAccessCheck.ok) {
        throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
      }

      if (existing.keycloakSubject === ctx.user.id) {
        throw new Error('self_protection:Eigener Nutzer kann nicht deaktiviert werden.');
      }

      const isAdmin = await isSystemAdminAccount(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: userId,
      });
      if (isAdmin) {
        const adminCount = await resolveSystemAdminCount(client, actorResolution.actor.instanceId);
        if (adminCount <= 1) {
          throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
        }
      }

      await client.query(
        `
UPDATE iam.accounts
SET
  status = 'inactive',
  updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2::uuid;
`,
        [userId, actorResolution.actor.instanceId]
      );

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        subjectId: userId,
        eventType: 'user.deactivated',
        result: 'success',
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: existing.keycloakSubject,
        trigger: 'user_deactivated',
      });

      return resolveUserDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        userId,
      });
    });

    if (!detail) {
      return createApiError(404, 'not_found', 'Nutzer nicht gefunden.', actorResolution.actor.requestId);
    }

    await trackKeycloakCall('deactivate_user', () =>
      identityProvider.provider.deactivateUser(detail.keycloakSubject)
    );

    iamUserOperationsCounter.add(1, { action: 'deactivate_user', result: 'success' });
    return jsonResponse(200, asApiItem(detail, actorResolution.actor.requestId));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const [errorCode, errorDetail] = errorMessage.split(':', 2);
    if (errorCode === 'self_protection') {
      return createApiError(409, 'self_protection', 'Eigener Nutzer kann nicht deaktiviert werden.', actorResolution.actor.requestId);
    }
    if (errorCode === 'last_admin_protection') {
      return createApiError(
        409,
        'last_admin_protection',
        'Letzter aktiver system_admin kann nicht deaktiviert werden.',
        actorResolution.actor.requestId
      );
    }
    if (errorCode === 'forbidden') {
      return createApiError(
        403,
        'forbidden',
        errorDetail ?? 'Deaktivierung dieses Nutzers ist nicht erlaubt.',
        actorResolution.actor.requestId
      );
    }
    logger.error('IAM deactivate user failed', {
      operation: 'deactivate_user',
      instance_id: actorResolution.actor.instanceId,
      user_id: userId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: errorMessage,
    });
    iamUserOperationsCounter.add(1, { action: 'deactivate_user', result: 'failure' });
    return createApiError(500, 'internal_error', 'Nutzer konnte nicht deaktiviert werden.', actorResolution.actor.requestId);
  }
};

const bulkDeactivateInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_bulk', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'bulk',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const idempotencyKey = requireIdempotencyKey(request, actorResolution.actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, bulkDeactivateSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const payloadHash = toPayloadHash(parsed.rawBody);
  const reserve = await reserveIdempotency({
    instanceId: actorResolution.actor.instanceId,
    actorAccountId: actorResolution.actor.actorAccountId,
    endpoint: 'POST:/api/v1/iam/users/bulk-deactivate',
    idempotencyKey: idempotencyKey.key,
    payloadHash,
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(
      409,
      'idempotency_key_reuse',
      reserve.message,
      actorResolution.actor.requestId
    );
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      actorResolution.actor.requestId
    );
  }

  try {
    const uniqueUserIds = [...new Set(parsed.data.userIds)];
    const details = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const actorMaxRoleLevel = await resolveActorMaxRoleLevel(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: ctx.user.id,
      });
      const users = (
        await Promise.all(
          uniqueUserIds.map((userId) =>
            resolveUserDetail(client, {
              instanceId: actorResolution.actor.instanceId,
              userId,
            })
          )
        )
      ).filter((entry): entry is IamUserDetail => Boolean(entry));

      if (users.some((entry) => entry.keycloakSubject === ctx.user.id)) {
        throw new Error('self_protection:Eigener Nutzer kann nicht deaktiviert werden.');
      }

      for (const user of users) {
        const targetAccessCheck = ensureActorCanManageTarget({
          actorMaxRoleLevel,
          actorRoles: ctx.user.roles,
          targetRoles: user.roles,
        });
        if (!targetAccessCheck.ok) {
          throw new Error(`${targetAccessCheck.code}:${targetAccessCheck.message}`);
        }

        const isAdmin = await isSystemAdminAccount(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: user.id,
        });
        if (isAdmin) {
          const adminCount = await resolveSystemAdminCount(client, actorResolution.actor.instanceId);
          if (adminCount <= 1) {
            throw new Error('last_admin_protection:Letzter aktiver system_admin kann nicht deaktiviert werden.');
          }
        }
      }

      await client.query(
        `
UPDATE iam.accounts
SET
  status = 'inactive',
  updated_at = NOW()
WHERE instance_id = $1::uuid
  AND id = ANY($2::uuid[]);
`,
        [actorResolution.actor.instanceId, uniqueUserIds]
      );

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        eventType: 'user.bulk_deactivated',
        result: 'success',
        payload: {
          total: users.length,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      for (const user of users) {
        await notifyPermissionInvalidation(client, {
          instanceId: actorResolution.actor.instanceId,
          keycloakSubject: user.keycloakSubject,
          trigger: 'user_bulk_deactivated',
        });
      }

      return users;
    });

    await Promise.all(
      details.map((detail) =>
        trackKeycloakCall('deactivate_user_bulk', () => identityProvider.provider.deactivateUser(detail.keycloakSubject))
      )
    );
    iamUserOperationsCounter.add(1, { action: 'bulk_deactivate', result: 'success' });
    const responseBody = asApiItem(
      {
        deactivatedUserIds: details.map((entry) => entry.id),
        count: details.length,
      },
      actorResolution.actor.requestId
    );
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/users/bulk-deactivate',
      idempotencyKey: idempotencyKey.key,
      status: 'COMPLETED',
      responseStatus: 200,
      responseBody,
    });
    return jsonResponse(200, responseBody);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const [errorCode, errorDetail] = errorMessage.split(':', 2);
    if (errorCode === 'self_protection') {
      return createApiError(409, 'self_protection', 'Eigener Nutzer kann nicht deaktiviert werden.', actorResolution.actor.requestId);
    }
    if (errorCode === 'last_admin_protection') {
      return createApiError(
        409,
        'last_admin_protection',
        'Letzter aktiver system_admin kann nicht deaktiviert werden.',
        actorResolution.actor.requestId
      );
    }
    if (errorCode === 'forbidden') {
      return createApiError(
        403,
        'forbidden',
        errorDetail ?? 'Bulk-Deaktivierung enthält nicht erlaubte Zielnutzer.',
        actorResolution.actor.requestId
      );
    }

    logger.error('IAM bulk deactivate failed', {
      operation: 'bulk_deactivate',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: errorMessage,
    });
    iamUserOperationsCounter.add(1, { action: 'bulk_deactivate', result: 'failure' });
    const errorBody = {
      error: {
        code: 'internal_error',
        message: 'Bulk-Deaktivierung fehlgeschlagen.',
      },
      ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
    } satisfies ApiErrorResponse;
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/users/bulk-deactivate',
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: 500,
      responseBody: errorBody,
    });
    return jsonResponse(500, errorBody);
  }
};

const updateMyProfileInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_ui', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, {
    createMissingInstanceFromKey: process.env.NODE_ENV !== 'production',
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const parsed = await parseRequestBody(request, updateMyProfileSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  try {
    const detail = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const existingAccountId = await resolveActorAccountId(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: ctx.user.id,
      });
      const accountId =
        existingAccountId ??
        (
          await jitProvisionAccountWithClient(client, {
            instanceId: actorResolution.actor.instanceId,
            keycloakSubject: ctx.user.id,
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          })
        ).accountId;

      await client.query(
        `
UPDATE iam.accounts
SET
  first_name_ciphertext = COALESCE($3, first_name_ciphertext),
  last_name_ciphertext = COALESCE($4, last_name_ciphertext),
  display_name_ciphertext = COALESCE($5, display_name_ciphertext),
  phone_ciphertext = COALESCE($6, phone_ciphertext),
  position = COALESCE($7, position),
  department = COALESCE($8, department),
  preferred_language = COALESCE($9, preferred_language),
  timezone = COALESCE($10, timezone),
  updated_at = NOW()
WHERE id = $1::uuid
  AND instance_id = $2::uuid;
`,
        [
          accountId,
          actorResolution.actor.instanceId,
          parsed.data.firstName ? protectField(parsed.data.firstName, `iam.accounts.first_name:${ctx.user.id}`) : null,
          parsed.data.lastName ? protectField(parsed.data.lastName, `iam.accounts.last_name:${ctx.user.id}`) : null,
          parsed.data.displayName
            ? protectField(parsed.data.displayName, `iam.accounts.display_name:${ctx.user.id}`)
            : null,
          parsed.data.phone ? protectField(parsed.data.phone, `iam.accounts.phone:${ctx.user.id}`) : null,
          parsed.data.position ?? null,
          parsed.data.department ?? null,
          parsed.data.preferredLanguage ?? null,
          parsed.data.timezone ?? null,
        ]
      );

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId,
        subjectId: accountId,
        eventType: 'user.profile_updated',
        result: 'success',
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      return resolveUserDetail(client, { instanceId: actorResolution.actor.instanceId, userId: accountId });
    });
    if (!detail) {
      return createApiError(404, 'not_found', 'Nutzerprofil nicht gefunden.', actorResolution.actor.requestId);
    }
    iamUserOperationsCounter.add(1, { action: 'update_my_profile', result: 'success' });
    return jsonResponse(200, asApiItem(detail, actorResolution.actor.requestId));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const [errorCode] = errorMessage.split(':', 2);
    if (errorCode === 'pii_encryption_required') {
      return createApiError(
        503,
        'internal_error',
        'PII-Verschlüsselung ist nicht konfiguriert.',
        actorResolution.actor.requestId
      );
    }
    logger.error('IAM profile update failed', {
      operation: 'update_my_profile',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: errorMessage,
    });
    iamUserOperationsCounter.add(1, { action: 'update_my_profile', result: 'failure' });
    return createApiError(
      500,
      'internal_error',
      'Profil konnte nicht aktualisiert werden.',
      actorResolution.actor.requestId
    );
  }
};

const getMyProfileInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_ui', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, {
    createMissingInstanceFromKey: process.env.NODE_ENV !== 'production',
  });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const detail = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const existingAccountId = await resolveActorAccountId(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: ctx.user.id,
      });
      const accountId =
        existingAccountId ??
        (
          await jitProvisionAccountWithClient(client, {
            instanceId: actorResolution.actor.instanceId,
            keycloakSubject: ctx.user.id,
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          })
        ).accountId;
      return resolveUserDetail(client, { instanceId: actorResolution.actor.instanceId, userId: accountId });
    });
    if (!detail) {
      return createApiError(404, 'not_found', 'Nutzerprofil nicht gefunden.', actorResolution.actor.requestId);
    }

    iamUserOperationsCounter.add(1, { action: 'get_my_profile', result: 'success' });
    return jsonResponse(200, asApiItem(detail, actorResolution.actor.requestId));
  } catch (error) {
    logger.error('IAM profile fetch failed', {
      operation: 'get_my_profile',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: error instanceof Error ? error.message : String(error),
    });
    iamUserOperationsCounter.add(1, { action: 'get_my_profile', result: 'failure' });
    return createApiError(
      500,
      'internal_error',
      'Profil konnte nicht geladen werden.',
      actorResolution.actor.requestId
    );
  }
};

const listRolesInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const roles = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadRoleListItems(client, actorResolution.actor.instanceId)
    );
    return jsonResponse(200, asApiList(roles, { page: 1, pageSize: roles.length, total: roles.length }, actorResolution.actor.requestId));
  } catch {
    return createApiError(
      503,
      'database_unavailable',
      'IAM-Datenbank ist nicht erreichbar.',
      actorResolution.actor.requestId
    );
  }
};

const createRoleInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, SYSTEM_ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const idempotencyKey = requireIdempotencyKey(request, actorResolution.actor.requestId);
  if ('error' in idempotencyKey) {
    return idempotencyKey.error;
  }

  const parsed = await parseRequestBody(request, createRoleSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actorResolution.actor.instanceId,
    actorAccountId: actorResolution.actor.actorAccountId,
    endpoint: 'POST:/api/v1/iam/roles',
    idempotencyKey: idempotencyKey.key,
    payloadHash: toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(
      409,
      'idempotency_key_reuse',
      reserve.message,
      actorResolution.actor.requestId
    );
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    const responseBody = {
      error: {
        code: 'keycloak_unavailable',
        message: 'Keycloak Admin API ist nicht konfiguriert.',
        details: {
          syncState: 'failed',
          syncError: { code: 'IDP_UNAVAILABLE' },
        },
      },
      ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
    } satisfies ApiErrorResponse;
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/roles',
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: 503,
      responseBody,
    });
    return jsonResponse(503, responseBody);
  }

  const roleKey = parsed.data.roleName;
  const displayName = parsed.data.displayName?.trim() || roleKey;
  const externalRoleName = roleKey;
  let createdInIdentityProvider = false;

  try {
    await trackKeycloakCall('create_role', () =>
      identityProvider.provider.createRole({
        externalName: externalRoleName,
        description: parsed.data.description ?? undefined,
        attributes: {
          managedBy: 'studio',
          instanceId: actorResolution.actor.instanceId,
          roleKey,
          displayName,
        },
      })
    );
    createdInIdentityProvider = true;

    const role = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const inserted = await client.query<{ id: string }>(
        `
INSERT INTO iam.roles (
  instance_id,
  role_key,
  role_name,
  display_name,
  external_role_name,
  description,
  is_system_role,
  role_level,
  managed_by,
  sync_state,
  last_synced_at,
  last_error_code
)
VALUES ($1::uuid, $2, $3, $4, $5, $6, false, $7, 'studio', 'synced', NOW(), NULL)
RETURNING id;
`,
        [
          actorResolution.actor.instanceId,
          roleKey,
          roleKey,
          displayName,
          externalRoleName,
          parsed.data.description ?? null,
          parsed.data.roleLevel,
        ]
      );
      const roleId = inserted.rows[0]?.id;
      if (!roleId) {
        throw new Error('conflict');
      }

      if (parsed.data.permissionIds.length > 0) {
        await client.query(
          `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT $1::uuid, $2::uuid, permission_id
FROM unnest($3::uuid[]) AS permission_id
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
          [actorResolution.actor.instanceId, roleId, parsed.data.permissionIds]
        );
      }

      await emitRoleAuditEvent(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        roleId,
        eventType: 'role.sync_started',
        operation: 'create',
        result: 'success',
        roleKey,
        externalRoleName,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        eventType: 'role.created',
        result: 'success',
        payload: {
          role_id: roleId,
          role_key: roleKey,
          display_name: displayName,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await emitRoleAuditEvent(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        roleId,
        eventType: 'role.sync_succeeded',
        operation: 'create',
        result: 'success',
        roleKey,
        externalRoleName,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        trigger: 'role_created',
      });

      const roleItem = await loadRoleListItemById(client, {
        instanceId: actorResolution.actor.instanceId,
        roleId,
      });
      if (!roleItem) {
        throw new Error('role_load_failed');
      }
      return roleItem;
    });
    iamUserOperationsCounter.add(1, { action: 'create_role', result: 'success' });
    iamRoleSyncCounter.add(1, { operation: 'create', result: 'success', error_code: 'none' });
    const responseBody = asApiItem(role, actorResolution.actor.requestId);
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/roles',
      idempotencyKey: idempotencyKey.key,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody,
    });
    return jsonResponse(201, responseBody);
  } catch (error) {
    if (createdInIdentityProvider) {
      try {
        await trackKeycloakCall('delete_role_compensation', () => identityProvider.provider.deleteRole(externalRoleName));
      } catch (compensationError) {
        iamRoleSyncCounter.add(1, {
          operation: 'create',
          result: 'failure',
          error_code: 'COMPENSATION_FAILED',
        });
        logger.error('Role create compensation failed', {
          operation: 'create_role_compensation',
          instance_id: actorResolution.actor.instanceId,
          request_id: actorResolution.actor.requestId,
          trace_id: actorResolution.actor.traceId,
          role_key: roleKey,
          external_role_name: externalRoleName,
          error_code: 'COMPENSATION_FAILED',
          error: sanitizeRoleErrorMessage(compensationError),
        });
        const responseBody = createApiError(
          500,
          'internal_error',
          'Rolle konnte nicht konsistent erstellt werden.',
          actorResolution.actor.requestId,
          {
            syncState: 'failed',
            syncError: { code: 'COMPENSATION_FAILED' },
          }
        );
        await completeIdempotency({
          instanceId: actorResolution.actor.instanceId,
          actorAccountId: actorResolution.actor.actorAccountId,
          endpoint: 'POST:/api/v1/iam/roles',
          idempotencyKey: idempotencyKey.key,
          status: 'FAILED',
          responseStatus: 500,
          responseBody: await responseBody.clone().json(),
        });
        return responseBody;
      }

      iamRoleSyncCounter.add(1, {
        operation: 'create',
        result: 'failure',
        error_code: 'DB_WRITE_FAILED',
      });
      const responseBody = {
        error: {
          code: 'conflict',
          message: 'Rolle konnte nicht erstellt werden.',
          details: {
            syncState: 'failed',
            syncError: { code: 'DB_WRITE_FAILED' },
          },
        },
        ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
      } satisfies ApiErrorResponse;
      await completeIdempotency({
        instanceId: actorResolution.actor.instanceId,
        actorAccountId: actorResolution.actor.actorAccountId,
        endpoint: 'POST:/api/v1/iam/roles',
        idempotencyKey: idempotencyKey.key,
        status: 'FAILED',
        responseStatus: 409,
        responseBody,
      });
      return jsonResponse(409, responseBody);
    }

    iamUserOperationsCounter.add(1, { action: 'create_role', result: 'failure' });
    const failureResponse = buildRoleSyncFailure({
      error,
      requestId: actorResolution.actor.requestId,
      fallbackMessage: 'Rolle konnte nicht erstellt werden.',
    });
    iamRoleSyncCounter.add(1, {
      operation: 'create',
      result: 'failure',
      error_code: mapRoleSyncErrorCode(error),
    });
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/roles',
      idempotencyKey: idempotencyKey.key,
      status: 'FAILED',
      responseStatus: failureResponse.status,
      responseBody: await failureResponse.clone().json(),
    });
    return failureResponse;
  }
};

const updateRoleInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, SYSTEM_ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const roleId = readPathSegment(request, 4);
  if (!roleId || !isUuid(roleId)) {
    return createApiError(400, 'invalid_request', 'Ungültige roleId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const parsed = await parseRequestBody(request, updateRoleSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      actorResolution.actor.requestId,
      {
        syncState: 'failed',
        syncError: { code: 'IDP_UNAVAILABLE' },
      }
    );
  }

  try {
    const existing = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadRoleById(client, { instanceId: actorResolution.actor.instanceId, roleId })
    );

    if (!existing) {
      return createApiError(404, 'not_found', 'Rolle nicht gefunden.', actorResolution.actor.requestId);
    }
    if (existing.is_system_role) {
      return createApiError(
        409,
        'conflict',
        'System-Rollen können nicht geändert werden.',
        actorResolution.actor.requestId
      );
    }
    if (existing.managed_by !== 'studio') {
      return createApiError(
        409,
        'conflict',
        'Extern verwaltete Rollen können im Studio nicht geändert werden.',
        actorResolution.actor.requestId
      );
    }

    const nextDisplayName = parsed.data.displayName?.trim() || getRoleDisplayName(existing);
    const nextDescription = parsed.data.description ?? existing.description ?? undefined;
    const nextRoleLevel = parsed.data.roleLevel ?? existing.role_level;
    const externalRoleName = getRoleExternalName(existing);

    await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      await setRoleSyncState(client, {
        instanceId: actorResolution.actor.instanceId,
        roleId,
        syncState: 'pending',
        errorCode: null,
      });
      await emitRoleAuditEvent(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        roleId,
        eventType: 'role.sync_started',
        operation: parsed.data.retrySync ? 'retry' : 'update',
        result: 'success',
        roleKey: existing.role_key,
        externalRoleName,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });
    });

    try {
      await trackKeycloakCall('update_role', () =>
        identityProvider.provider.updateRole(externalRoleName, {
          description: nextDescription,
          attributes: {
            managedBy: 'studio',
            instanceId: actorResolution.actor.instanceId,
            roleKey: existing.role_key,
            displayName: nextDisplayName,
          },
        })
      );
    } catch (error) {
      const errorCode = mapRoleSyncErrorCode(error);
      iamRoleSyncCounter.add(1, {
        operation: parsed.data.retrySync ? 'retry' : 'update',
        result: 'failure',
        error_code: errorCode,
      });
      await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        await setRoleSyncState(client, {
          instanceId: actorResolution.actor.instanceId,
          roleId,
          syncState: 'failed',
          errorCode,
        });
        await emitRoleAuditEvent(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          roleId,
          eventType: 'role.sync_failed',
          operation: parsed.data.retrySync ? 'retry' : 'update',
          result: 'failure',
          roleKey: existing.role_key,
          externalRoleName,
          errorCode,
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
      });
      return buildRoleSyncFailure({
        error,
        requestId: actorResolution.actor.requestId,
        fallbackMessage: 'Rolle konnte nicht mit Keycloak synchronisiert werden.',
        roleId,
      });
    }

    try {
      const roleItem = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        await client.query(
          `
UPDATE iam.roles
SET
  display_name = $3,
  description = $4,
  role_level = $5,
  sync_state = 'synced',
  last_synced_at = NOW(),
  last_error_code = NULL,
  updated_at = NOW()
WHERE instance_id = $1::uuid
  AND id = $2::uuid;
`,
          [actorResolution.actor.instanceId, roleId, nextDisplayName, nextDescription ?? null, nextRoleLevel]
        );

        if (parsed.data.permissionIds) {
          await client.query('DELETE FROM iam.role_permissions WHERE instance_id = $1::uuid AND role_id = $2::uuid;', [
            actorResolution.actor.instanceId,
            roleId,
          ]);
          if (parsed.data.permissionIds.length > 0) {
            await client.query(
              `
INSERT INTO iam.role_permissions (instance_id, role_id, permission_id)
SELECT $1::uuid, $2::uuid, permission_id
FROM unnest($3::uuid[]) AS permission_id
ON CONFLICT (instance_id, role_id, permission_id) DO NOTHING;
`,
              [actorResolution.actor.instanceId, roleId, parsed.data.permissionIds]
            );
          }
        }

        await emitActivityLog(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          eventType: 'role.updated',
          result: 'success',
          payload: {
            role_id: roleId,
            role_key: existing.role_key,
            display_name: nextDisplayName,
          },
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
        await emitRoleAuditEvent(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          roleId,
          eventType: 'role.sync_succeeded',
          operation: parsed.data.retrySync ? 'retry' : 'update',
          result: 'success',
          roleKey: existing.role_key,
          externalRoleName,
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
        await notifyPermissionInvalidation(client, {
          instanceId: actorResolution.actor.instanceId,
          trigger: 'role_updated',
        });

        const updatedRole = await loadRoleListItemById(client, {
          instanceId: actorResolution.actor.instanceId,
          roleId,
        });
        if (!updatedRole) {
          throw new Error('role_load_failed');
        }
        return updatedRole;
      });

      iamRoleSyncCounter.add(1, {
        operation: parsed.data.retrySync ? 'retry' : 'update',
        result: 'success',
        error_code: 'none',
      });
      return jsonResponse(200, asApiItem(roleItem, actorResolution.actor.requestId));
    } catch (error) {
      try {
        await trackKeycloakCall('update_role_compensation', () =>
          identityProvider.provider.updateRole(externalRoleName, {
            description: existing.description ?? undefined,
            attributes: {
              managedBy: 'studio',
              instanceId: actorResolution.actor.instanceId,
              roleKey: existing.role_key,
              displayName: getRoleDisplayName(existing),
            },
          })
        );
      } catch {
        await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: actorResolution.actor.instanceId,
            roleId,
            syncState: 'failed',
            errorCode: 'COMPENSATION_FAILED',
          });
          await emitRoleAuditEvent(client, {
            instanceId: actorResolution.actor.instanceId,
            accountId: actorResolution.actor.actorAccountId,
            roleId,
            eventType: 'role.sync_failed',
            operation: 'update',
            result: 'failure',
            roleKey: existing.role_key,
            externalRoleName,
            errorCode: 'COMPENSATION_FAILED',
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          });
        });
        iamRoleSyncCounter.add(1, { operation: 'update', result: 'failure', error_code: 'COMPENSATION_FAILED' });
        return createApiError(
          500,
          'internal_error',
          'Rolle konnte nicht konsistent aktualisiert werden.',
          actorResolution.actor.requestId,
          {
            syncState: 'failed',
            syncError: { code: 'COMPENSATION_FAILED' },
          }
        );
      }

      await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        await setRoleSyncState(client, {
          instanceId: actorResolution.actor.instanceId,
          roleId,
          syncState: 'failed',
          errorCode: 'DB_WRITE_FAILED',
        });
        await emitRoleAuditEvent(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          roleId,
          eventType: 'role.sync_failed',
          operation: 'update',
          result: 'failure',
          roleKey: existing.role_key,
          externalRoleName,
          errorCode: 'DB_WRITE_FAILED',
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
      });
      iamRoleSyncCounter.add(1, { operation: 'update', result: 'failure', error_code: 'DB_WRITE_FAILED' });
      logger.error('Role update database write failed after successful Keycloak update', {
        operation: 'update_role',
        instance_id: actorResolution.actor.instanceId,
        request_id: actorResolution.actor.requestId,
        trace_id: actorResolution.actor.traceId,
        role_id: roleId,
        role_key: existing.role_key,
        error: sanitizeRoleErrorMessage(error),
      });
      return createApiError(500, 'internal_error', 'Rolle konnte nicht aktualisiert werden.', actorResolution.actor.requestId, {
        syncState: 'failed',
        syncError: { code: 'DB_WRITE_FAILED' },
      });
    }
  } catch {
    return createApiError(500, 'internal_error', 'Rolle konnte nicht aktualisiert werden.', actorResolution.actor.requestId);
  }
};

const deleteRoleInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, SYSTEM_ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const roleId = readPathSegment(request, 4);
  if (!roleId || !isUuid(roleId)) {
    return createApiError(400, 'invalid_request', 'Ungültige roleId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const identityProvider = resolveIdentityProvider();
  if (!identityProvider) {
    return createApiError(
      503,
      'keycloak_unavailable',
      'Keycloak Admin API ist nicht konfiguriert.',
      actorResolution.actor.requestId,
      {
        syncState: 'failed',
        syncError: { code: 'IDP_UNAVAILABLE' },
      }
    );
  }

  try {
    const existing = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadRoleById(client, { instanceId: actorResolution.actor.instanceId, roleId })
    );

    if (!existing) {
      return createApiError(404, 'not_found', 'Rolle nicht gefunden.', actorResolution.actor.requestId);
    }
    if (existing.is_system_role) {
      return createApiError(
        409,
        'conflict',
        'System-Rollen können nicht gelöscht werden.',
        actorResolution.actor.requestId
      );
    }
    if (existing.managed_by !== 'studio') {
      return createApiError(
        409,
        'conflict',
        'Extern verwaltete Rollen können im Studio nicht gelöscht werden.',
        actorResolution.actor.requestId
      );
    }

    const dependency = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const result = await client.query<{ used: number }>(
        `
SELECT COUNT(*)::int AS used
FROM iam.account_roles
WHERE instance_id = $1::uuid
  AND role_id = $2::uuid;
`,
        [actorResolution.actor.instanceId, roleId]
      );
      return result.rows[0]?.used ?? 0;
    });
    if (dependency > 0) {
      return createApiError(
        409,
        'conflict',
        'Rolle wird noch von Nutzern verwendet.',
        actorResolution.actor.requestId
      );
    }

    const externalRoleName = getRoleExternalName(existing);

    await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      await setRoleSyncState(client, {
        instanceId: actorResolution.actor.instanceId,
        roleId,
        syncState: 'pending',
        errorCode: null,
      });
      await emitRoleAuditEvent(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        roleId,
        eventType: 'role.sync_started',
        operation: 'delete',
        result: 'success',
        roleKey: existing.role_key,
        externalRoleName,
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });
    });

    try {
      await trackKeycloakCall('delete_role', () => identityProvider.provider.deleteRole(externalRoleName));
    } catch (error) {
      if (!(error instanceof KeycloakAdminRequestError && error.statusCode === 404)) {
        const errorCode = mapRoleSyncErrorCode(error);
        await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
          await setRoleSyncState(client, {
            instanceId: actorResolution.actor.instanceId,
            roleId,
            syncState: 'failed',
            errorCode,
          });
          await emitRoleAuditEvent(client, {
            instanceId: actorResolution.actor.instanceId,
            accountId: actorResolution.actor.actorAccountId,
            roleId,
            eventType: 'role.sync_failed',
            operation: 'delete',
            result: 'failure',
            roleKey: existing.role_key,
            externalRoleName,
            errorCode,
            requestId: actorResolution.actor.requestId,
            traceId: actorResolution.actor.traceId,
          });
        });
        iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: errorCode });
        return buildRoleSyncFailure({
          error,
          requestId: actorResolution.actor.requestId,
          fallbackMessage: 'Rolle konnte nicht gelöscht werden.',
          roleId,
        });
      }
    }

    try {
      await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        await client.query('DELETE FROM iam.role_permissions WHERE instance_id = $1::uuid AND role_id = $2::uuid;', [
          actorResolution.actor.instanceId,
          roleId,
        ]);
        await client.query('DELETE FROM iam.roles WHERE instance_id = $1::uuid AND id = $2::uuid;', [
          actorResolution.actor.instanceId,
          roleId,
        ]);

        await emitActivityLog(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          eventType: 'role.deleted',
          result: 'success',
          payload: {
            role_id: roleId,
            role_key: existing.role_key,
          },
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
        await emitRoleAuditEvent(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          roleId,
          eventType: 'role.sync_succeeded',
          operation: 'delete',
          result: 'success',
          roleKey: existing.role_key,
          externalRoleName,
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
        await notifyPermissionInvalidation(client, {
          instanceId: actorResolution.actor.instanceId,
          trigger: 'role_deleted',
        });
      });
    } catch {
      try {
        await trackKeycloakCall('create_role_compensation', () =>
          identityProvider.provider.createRole({
            externalName: externalRoleName,
            description: existing.description ?? undefined,
            attributes: {
              managedBy: 'studio',
              instanceId: actorResolution.actor.instanceId,
              roleKey: existing.role_key,
              displayName: getRoleDisplayName(existing),
            },
          })
        );
      } catch (compensationError) {
        iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: 'COMPENSATION_FAILED' });
        logger.error('Role delete compensation failed', {
          operation: 'delete_role_compensation',
          instance_id: actorResolution.actor.instanceId,
          request_id: actorResolution.actor.requestId,
          trace_id: actorResolution.actor.traceId,
          role_id: roleId,
          role_key: existing.role_key,
          error: sanitizeRoleErrorMessage(compensationError),
        });
        return createApiError(
          500,
          'internal_error',
          'Rolle konnte nicht konsistent gelöscht werden.',
          actorResolution.actor.requestId,
          {
            syncState: 'failed',
            syncError: { code: 'COMPENSATION_FAILED' },
          }
        );
      }

      await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
        await setRoleSyncState(client, {
          instanceId: actorResolution.actor.instanceId,
          roleId,
          syncState: 'failed',
          errorCode: 'DB_WRITE_FAILED',
        });
        await emitRoleAuditEvent(client, {
          instanceId: actorResolution.actor.instanceId,
          accountId: actorResolution.actor.actorAccountId,
          roleId,
          eventType: 'role.sync_failed',
          operation: 'delete',
          result: 'failure',
          roleKey: existing.role_key,
          externalRoleName,
          errorCode: 'DB_WRITE_FAILED',
          requestId: actorResolution.actor.requestId,
          traceId: actorResolution.actor.traceId,
        });
      });
      iamRoleSyncCounter.add(1, { operation: 'delete', result: 'failure', error_code: 'DB_WRITE_FAILED' });
      return createApiError(500, 'internal_error', 'Rolle konnte nicht gelöscht werden.', actorResolution.actor.requestId, {
        syncState: 'failed',
        syncError: { code: 'DB_WRITE_FAILED' },
      });
    }

    iamRoleSyncCounter.add(1, { operation: 'delete', result: 'success', error_code: 'none' });
    return jsonResponse(
      200,
      asApiItem(
        {
          id: roleId,
          roleKey: existing.role_key,
          roleName: getRoleDisplayName(existing),
          externalRoleName,
          syncState: 'synced' as const,
        },
        actorResolution.actor.requestId
      )
    );
  } catch {
    return createApiError(500, 'internal_error', 'Rolle konnte nicht gelöscht werden.', actorResolution.actor.requestId);
  }
};

const readyInternal = async (request: Request): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const dbReady = await (async () => {
    try {
      const pool = resolvePool();
      if (!pool) {
        return false;
      }
      const client = await pool.connect();
      try {
        await client.query('SELECT 1;');
        return true;
      } finally {
        client.release();
      }
    } catch {
      return false;
    }
  })();

  const redisReady = await isRedisAvailable();

  const keycloakReady = await (async () => {
    const idp = resolveIdentityProvider();
    if (!idp) {
      return false;
    }
    if (isKeycloakIdentityProvider(idp.provider)) {
      const keycloakProvider = idp.provider;
      try {
        await trackKeycloakCall('readiness_list_roles', () => keycloakProvider.listRoles());
        return true;
      } catch {
        return false;
      }
    }
    return true;
  })();

  const allReady = dbReady && redisReady && keycloakReady;
  return jsonResponse(allReady ? 200 : 503, {
    status: allReady ? 'ready' : 'not_ready',
    checks: {
      db: dbReady,
      redis: redisReady,
      keycloak: keycloakReady,
    },
    ...(requestContext.requestId ? { requestId: requestContext.requestId } : {}),
    timestamp: new Date().toISOString(),
    path: new URL(request.url).pathname,
  });
};

const liveInternal = async (request: Request): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  return jsonResponse(200, {
    status: 'alive',
    timestamp: new Date().toISOString(),
    path: new URL(request.url).pathname,
    ...(requestContext.requestId ? { requestId: requestContext.requestId } : {}),
  });
};

const reconcilePlaceholderInternal = async (request: Request, ctx: AuthenticatedRequestContext): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, SYSTEM_ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }
  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const report = await runRoleCatalogReconciliation({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      requestId: actorResolution.actor.requestId,
      traceId: actorResolution.actor.traceId,
    });
    return jsonResponse(200, asApiItem(report, actorResolution.actor.requestId));
  } catch (error) {
    logger.error('Role reconciliation failed', {
      operation: 'reconcile_roles',
      instance_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      error: sanitizeRoleErrorMessage(error),
    });
    return createApiError(
      503,
      'keycloak_unavailable',
      'Rollen-Reconciliation konnte nicht ausgeführt werden.',
      actorResolution.actor.requestId,
      {
        syncState: 'failed',
        syncError: { code: mapRoleSyncErrorCode(error) },
      }
    );
  }
};

let roleCatalogSchedulerStarted = false;
const roleCatalogSchedulerInFlight = new Set<string>();

const readScheduledReconcileInstanceIds = (): readonly string[] =>
  (process.env.IAM_ROLE_RECONCILE_INSTANCE_IDS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const ensureRoleCatalogSchedulerStarted = (): void => {
  if (roleCatalogSchedulerStarted) {
    return;
  }

  const intervalRaw = process.env.IAM_ROLE_RECONCILE_INTERVAL_MS;
  const intervalMs = intervalRaw ? Number(intervalRaw) : NaN;
  const instanceIds = readScheduledReconcileInstanceIds();
  if (!Number.isFinite(intervalMs) || intervalMs <= 0 || instanceIds.length === 0) {
    return;
  }

  roleCatalogSchedulerStarted = true;
  const timer = setInterval(async () => {
    for (const instanceId of instanceIds) {
      if (roleCatalogSchedulerInFlight.has(instanceId)) {
        logger.warn('Role catalog reconciliation already running; skipping overlapping scheduler run', {
          operation: 'reconcile_roles_scheduler',
          workspace_id: instanceId,
          instance_id: instanceId,
          result: 'skipped',
          error_code: 'SCHEDULER_ALREADY_RUNNING',
          request_id: `scheduler:${Date.now()}:${instanceId}`,
        });
        continue;
      }

      roleCatalogSchedulerInFlight.add(instanceId);
      const schedulerRequestId = `scheduler:${Date.now()}:${instanceId}`;
      try {
        const report = await runRoleCatalogReconciliation({
          instanceId,
          requestId: schedulerRequestId,
        });
        logger.info('Role catalog reconciliation completed', {
          operation: 'reconcile_roles_scheduler',
          workspace_id: instanceId,
          instance_id: instanceId,
          result: 'success',
          request_id: schedulerRequestId,
          checked_count: report.checkedCount,
          corrected_count: report.correctedCount,
          failed_count: report.failedCount,
          requires_manual_action_count: report.requiresManualActionCount,
        });
      } catch (error) {
        logger.error('Role catalog reconciliation scheduler failed', {
          operation: 'reconcile_roles_scheduler',
          workspace_id: instanceId,
          instance_id: instanceId,
          result: 'failure',
          request_id: schedulerRequestId,
          error: sanitizeRoleErrorMessage(error),
        });
      } finally {
        roleCatalogSchedulerInFlight.delete(instanceId);
      }
    }
  }, intervalMs);

  timer.unref?.();
};

ensureRoleCatalogSchedulerStarted();

export const listUsersHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => listUsersInternal(request, ctx))
  );

export const getUserHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => getUserInternal(request, ctx))
  );

export const createUserHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => createUserInternal(request, ctx))
  );

export const updateUserHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => updateUserInternal(request, ctx))
  );

export const deactivateUserHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => deactivateUserInternal(request, ctx))
  );

export const bulkDeactivateUsersHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => bulkDeactivateInternal(request, ctx))
  );

export const updateMyProfileHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => updateMyProfileInternal(request, ctx))
  );

export const getMyProfileHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => getMyProfileInternal(request, ctx))
  );

export const listRolesHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => listRolesInternal(request, ctx))
  );

export const createRoleHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => createRoleInternal(request, ctx))
  );

export const updateRoleHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => updateRoleInternal(request, ctx))
  );

export const deleteRoleHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => deleteRoleInternal(request, ctx))
  );

export const healthReadyHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => readyInternal(request));

export const healthLiveHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => liveInternal(request));

export const reconcileHandler = async (request: Request): Promise<Response> =>
  withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, (ctx) => reconcilePlaceholderInternal(request, ctx))
  );

export const getIamFeatureFlags = (): FeatureFlags => getFeatureFlags();
