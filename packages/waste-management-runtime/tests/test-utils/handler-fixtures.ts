import { vi } from 'vitest';

import type { EffectivePermission } from '@sva/iam-core';

import type {
  AuthenticatedRequestContext,
  WasteManagementHandlerDeps,
} from '../../src/handlers/types.js';

const wasteTestOrigin = 'https://studio.test';
const wasteTestRequestId = 'req-test';

type WasteTestActorOverrides = Partial<Omit<AuthenticatedRequestContext, 'user'>> & {
  readonly user?: Partial<AuthenticatedRequestContext['user']>;
};

export const createWasteTestActor = ({
  user,
  ...context
}: WasteTestActorOverrides = {}): AuthenticatedRequestContext => ({
  sessionId: 'session-1',
  ...context,
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
    ...user,
  },
});

export const wasteResolvedActorInfo = {
  actor: {
    instanceId: 'tenant-a',
    actorAccountId: 'account-1',
    requestId: wasteTestRequestId,
    traceId: 'trace-test',
  },
};

/** An action name grants that action on the plugin resource; pass a full permission for scoped grants. */
type WastePermissionGrant = string | EffectivePermission;

type WastePermissionResolution =
  | { readonly ok: true; readonly permissions: readonly EffectivePermission[] }
  | { readonly ok: false; readonly error: string };

/**
 * Handler dependencies as direct-handler tests supply them. `resolvePermissions` is not a
 * production dependency: `host-controls.setup.ts` evaluates it in place of the host-bound
 * `authorizeAction`, so the requested action is still checked against the granted permissions.
 */
type WasteHandlerTestDeps = WasteManagementHandlerDeps & {
  readonly resolvePermissions?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
  }) => Promise<WastePermissionResolution>;
};

const toEffectivePermission = (grant: WastePermissionGrant): EffectivePermission =>
  typeof grant === 'string' ? { action: grant, resourceType: 'waste-management' } : grant;

/** The permission binding as a dependency fragment; spread it to grant or to override grants. */
export const grantWastePermissions = (...grants: readonly WastePermissionGrant[]) => ({
  resolvePermissions: vi.fn(async () => ({
    ok: true as const,
    permissions: grants.map(toEffectivePermission),
  })),
});

/** Request id and granted permissions only, for suites that own every other dependency. */
export const createWasteAuthDeps = (grants: readonly WastePermissionGrant[]) => ({
  getRequestId: () => wasteTestRequestId,
  ...grantWastePermissions(...grants),
});

/** Auth setup plus the audit and actor bindings every mutation path needs; overrides win. */
export const createWasteHandlerDeps = (
  grants: readonly WastePermissionGrant[],
  overrides: WasteHandlerTestDeps = {}
) => ({
  ...createWasteAuthDeps(grants),
  emitAuditEvent: vi.fn(async () => undefined),
  resolveActorInfo: vi.fn(async () => ({
    actor: { instanceId: 'tenant-a', actorAccountId: 'account-1' },
  })),
  ...overrides,
});

const trustedOriginHeaders = {
  origin: wasteTestOrigin,
  'x-requested-with': 'XMLHttpRequest',
};

// Header names are case-insensitive; normalising keeps an override from duplicating a default.
const withHeaderOverrides = (
  defaults: Record<string, string>,
  overrides: Record<string, string>
): Record<string, string> => ({
  ...defaults,
  ...Object.fromEntries(
    Object.entries(overrides).map(([name, value]) => [name.toLowerCase(), value])
  ),
});

/** Headers of a same-origin browser mutation, as the CSRF guard of the host expects them. */
export const createWasteMutationHeaders = (overrides: Record<string, string> = {}) =>
  withHeaderOverrides({ 'content-type': 'application/json', ...trustedOriginHeaders }, overrides);

/** Same-origin mutation request; the JSON content type is only sent together with a body. */
export const createWasteMutationRequest = (
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Request =>
  new Request(
    new URL(url, wasteTestOrigin),
    body === undefined
      ? { method, headers: withHeaderOverrides(trustedOriginHeaders, headers) }
      : { method, headers: createWasteMutationHeaders(headers), body: JSON.stringify(body) }
  );
