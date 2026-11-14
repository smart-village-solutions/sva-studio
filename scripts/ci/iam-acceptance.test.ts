import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { ensureEditorRoles } from '../../packages/studio-mcp/src/editor-role-baseline.ts';
import type { PersonalMcpContext } from '../../packages/studio-mcp/src/config.ts';
import { studioPermissionCatalog } from '../../packages/studio-module-iam/src/index.ts';
import { getManagedPermissionMetadata } from '../../packages/iam-admin/src/managed-permissions.ts';
import { createRoleSchema } from '../../packages/auth-runtime/src/iam-account-management/schemas.ts';
import type { EffectivePermission } from '../../packages/iam-core/src/authorization-contract.ts';
import { authorizeInstancePermissionForUser } from '../../packages/auth-runtime/src/instance-permission-authorization.ts';
import {
  authorizeMainserverCreatePrincipal,
  authorizeMainserverDataProviderAccess,
} from '../../packages/auth-runtime/src/iam-contents/mainserver-content-authorization.ts';
import { projectOrganizationIdForPermission } from '../../packages/auth-runtime/src/iam-authorization/permission-scope-semantics.ts';
import {
  createRoleReadHandlers,
  type RoleReadHandlerDeps,
} from '../../packages/iam-admin/src/role-read-handlers.ts';
import {
  createUserReadHandlers,
  type UserReadHandlerDeps,
} from '../../packages/iam-admin/src/user-read-handlers.ts';

const ownershipIo = vi.hoisted(() => ({ bindings: new Map<string, { dataProviderId: string }>() }));
vi.mock(
  '../../packages/auth-runtime/src/iam-contents/mainserver-data-provider-bindings.ts',
  () => ({
    loadCurrentMainserverDataProviderBinding: async (input: {
      instanceId: string;
      principalType: string;
      principalId: string;
    }) =>
      ownershipIo.bindings.get(`${input.instanceId}:${input.principalType}:${input.principalId}`),
  })
);
vi.mock('../../packages/auth-runtime/src/mainserver-effective-credentials.ts', () => ({
  readEffectiveSvaMainserverCredentialsWithStatus: async (input: {
    actingPrincipalType: string;
  }) => ({
    status: 'ok',
    source: input.actingPrincipalType,
    credentialFingerprint: (input.actingPrincipalType === 'organization' ? 'b' : 'a').repeat(64),
    credentials: { apiKey: 'synthetic-key', apiSecret: 'synthetic-secret' },
  }),
}));

import {
  buildAcceptanceReport,
  parseAcceptanceConfig,
  renderAcceptanceMarkdownReport,
  summarizeAcceptanceSteps,
} from './iam-acceptance.ts';

it('parseAcceptanceConfig applies defaults and reads required env', () => {
  const config = parseAcceptanceConfig(
    {
      IAM_ACCEPTANCE_ADMIN_PASSWORD: 'fixture-admin-value',
      IAM_ACCEPTANCE_ADMIN_USERNAME: 'fixture-admin-user',
      IAM_ACCEPTANCE_MEMBER_PASSWORD: 'fixture-member-value',
      IAM_ACCEPTANCE_MEMBER_USERNAME: 'fixture-member-user',
      IAM_DATABASE_URL: 'postgres://localhost/sva',
      KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example.com',
      KEYCLOAK_ADMIN_CLIENT_ID: 'fixture-client-id',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'fixture-client-value',
      KEYCLOAK_ADMIN_REALM: 'acceptance',
    },
    '/workspace'
  );

  expect(config.baseUrl).toBe('http://127.0.0.1:3000');
  expect(config.instanceId).toBe('de-musterhausen');
  expect(config.admin.expectedRoles).toEqual(['system_admin']);
  expect(config.reportDirectory).toBe('/workspace/docs/reports');
});

it('parseAcceptanceConfig rejects incomplete configuration', () => {
  expect(() =>
    parseAcceptanceConfig({
      IAM_ACCEPTANCE_ADMIN_USERNAME: 'fixture-admin-user',
    })
  ).toThrow(/Missing required acceptance env/);
});

it('parseAcceptanceConfig accepts evidence credentials as fallback aliases', () => {
  const config = parseAcceptanceConfig(
    {
      IAM_DATABASE_URL: 'postgres://localhost/sva',
      IAM_EVIDENCE_INSTANCE_PASSWORD: 'fixture-member-value',
      IAM_EVIDENCE_INSTANCE_USERNAME: 'fixture-member-user',
      IAM_EVIDENCE_ROOT_PASSWORD: 'fixture-admin-value',
      IAM_EVIDENCE_ROOT_USERNAME: 'fixture-admin-user',
      KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example.com',
      KEYCLOAK_ADMIN_CLIENT_ID: 'fixture-client-id',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'fixture-client-value',
      KEYCLOAK_ADMIN_REALM: 'acceptance',
    },
    '/workspace'
  );

  expect(config.admin.username).toBe('fixture-admin-user');
  expect(config.member.username).toBe('fixture-member-user');
});

it('report helpers summarize and render acceptance steps', () => {
  const report = buildAcceptanceReport({
    baseUrl: 'https://studio.example.com',
    generatedAt: '2026-03-17T09:00:00.000Z',
    instanceId: 'de-musterhausen',
    steps: [
      { name: 'Readiness', status: 'passed', details: 'Alle Dependencies gesund.' },
      {
        name: 'OIDC Login',
        status: 'failed',
        failureCode: 'acceptance_login_failed',
        details: 'Login schlug fehl.',
      },
      { name: 'UI Nachweis', status: 'skipped', details: 'Vorheriger Schritt fehlgeschlagen.' },
    ],
  });

  expect(summarizeAcceptanceSteps(report.steps)).toEqual({
    failed: 1,
    passed: 1,
    skipped: 1,
    status: 'failed',
  });

  const markdown = renderAcceptanceMarkdownReport(report);
  expect(markdown).toMatch(/Verifikationsbericht: IAM Foundation Acceptance/);
  expect(markdown).toMatch(/Fehlercode: acceptance_login_failed/);
  expect(markdown).toMatch(/Ergebnis: fehlgeschlagen/);
});

// Synthetic transport/storage replies only: authorization decisions are not mocked.
const editorialTenants = () => {
  const activeModules = new Set(['news', 'events', 'poi', 'media', 'categories']);
  const definitions = studioPermissionCatalog.filter(
    (permission) =>
      permission.availability.kind === 'tenant' ||
      (permission.availability.kind === 'module' &&
        activeModules.has(permission.availability.moduleId))
  );
  const contexts: PersonalMcpContext[] = ['one', 'two'].map((id) => ({
    id,
    name: id,
    kind: 'tenant',
    tenantId: `test-${id}`,
    baseUrl: `https://${id}.example.invalid`,
    issuer: `https://id.example.invalid/realms/${id}`,
    clientId: 'test',
  }));
  const catalogs = new Map(
    contexts.map((context, index) => [
      context.id,
      definitions.map((definition, permissionIndex) => ({
        id: `00000000-0000-4000-8${index + 1}00-${String(permissionIndex + 1).padStart(12, '0')}`,
        instanceId: context.kind === 'tenant' ? context.tenantId : '',
        permissionKey: definition.key,
        ...getManagedPermissionMetadata(definition.key),
      })),
    ])
  );
  type StoredRole = {
    id: string;
    roleKey: string;
    description?: string;
    managedBy: 'studio';
    syncState: 'synced';
    permissions: { permissionKey: string; accessScope: 'all' | 'own' | 'organization' }[];
  };
  const roles = new Map<string, StoredRole[]>(
    contexts.map((context) => [
      context.id,
      [
        {
          id: `admin-${context.id}`,
          roleKey: 'system_admin',
          managedBy: 'studio',
          syncState: 'synced',
          permissions: definitions.map((definition) => ({
            permissionKey: definition.key,
            accessScope: 'all',
          })),
        },
      ],
    ])
  );
  const postPayloads = new Map<string, ReturnType<typeof createRoleSchema.parse>>();
  const call = vi.fn<Parameters<typeof ensureEditorRoles>[2]>(async (request) => {
    const catalog = catalogs.get(request.contextId);
    const tenantRoles = roles.get(request.contextId);
    if (!catalog || !tenantRoles) throw new Error('unselected_test_tenant');
    let data: unknown = request.path.endsWith('permissions') ? catalog : tenantRoles;
    if (request.method === 'POST') {
      const payload = createRoleSchema.parse(request.body);
      postPayloads.set(request.contextId, payload);
      const permissions = (payload.permissionAssignments ?? []).map((assignment) => {
        const permission = catalog.find((candidate) => candidate.id === assignment.permissionId);
        if (!permission) throw new Error('permission_outside_selected_tenant');
        return {
          permissionKey: permission.permissionKey,
          accessScope: assignment.accessScope ?? ('all' as const),
        };
      });
      const role = {
        id: `editor-${request.contextId}`,
        roleKey: payload.roleName ?? '',
        description: payload.description,
        managedBy: 'studio' as const,
        syncState: 'synced' as const,
        permissions,
      };
      tenantRoles.push(role);
      data = { id: role.id };
    }
    return {
      content: [{ type: 'text' as const, text: 'Synthetic IAM response' }],
      structuredContent: { ok: true, data: { data } },
    };
  });
  const accountRoles = new Map<string, string>();
  const contextFor = (id: string, role: 'editor' | 'system_admin') => {
    const context = contexts.find((candidate) => candidate.id === id);
    if (!context || context.kind !== 'tenant') throw new Error('unknown_test_context');
    const storedRole = roles.get(id)?.find((candidate) => candidate.roleKey === role);
    if (!storedRole) throw new Error('role_not_created');
    const subject = `${id}-${role}`;
    accountRoles.set(`${context.tenantId}:${subject}`, storedRole.id);
    const activeOrganizationId = `00000000-0000-4000-8${id === 'one' ? '1' : '2'}00-000000000001`;
    ownershipIo.bindings.set(`${context.tenantId}:organization:${activeOrganizationId}`, {
      dataProviderId: `provider-${id}-organization`,
    });
    ownershipIo.bindings.set(`${context.tenantId}:user:${subject}`, {
      dataProviderId: `provider-${id}-user`,
    });
    return {
      sessionId: `synthetic-session-${id}`,
      activeOrganizationId,
      user: { id: subject, instanceId: context.tenantId, roles: [role] },
    };
  };
  const grantsFor = (
    ctx: Parameters<typeof authorizeInstancePermissionForUser>[0]['ctx']
  ): EffectivePermission[] => {
    const context = contexts.find(
      (candidate) => candidate.kind === 'tenant' && candidate.tenantId === ctx.user.instanceId
    );
    const roleId = accountRoles.get(`${ctx.user.instanceId}:${ctx.user.id}`);
    const storedRole = context
      ? roles.get(context.id)?.find((role) => role.id === roleId)
      : undefined;
    return (storedRole?.permissions ?? []).map((permission) => {
      const definition = definitions.find(
        (candidate) => candidate.key === permission.permissionKey
      );
      if (!definition) throw new Error('permission_missing_from_real_catalog');
      return {
        action: permission.permissionKey,
        resourceType: definition.resourceType,
        accessScope: permission.accessScope,
        sourceRoleIds: [storedRole?.id ?? 'missing'],
        organizationId: projectOrganizationIdForPermission({
          permissionKey: permission.permissionKey,
          accessScope: permission.accessScope,
          organizationId: ctx.activeOrganizationId,
        }),
      };
    });
  };
  return { contexts, catalogs, roles, postPayloads, call, contextFor, grantsFor };
};

const editorialGrantContract = () =>
  JSON.parse(
    readFileSync(
      new URL(
        '../../apps/sva-studio-react/src/test/fixtures/editor-role-baseline.json',
        import.meta.url
      ),
      'utf8'
    )
  ) as { roleKey: string; permissions: { permissionKey: string; accessScope: string }[] };

it('carries the actual MCP POST through two tenant readbacks and the shared navigation grant contract', async () => {
  const fixture = editorialTenants();
  const result = await ensureEditorRoles(
    { contextIds: ['one', 'two'] },
    fixture.contexts,
    fixture.call
  );
  expect(result.map(({ contextId, status }) => ({ contextId, status }))).toEqual([
    { contextId: 'one', status: 'created' },
    { contextId: 'two', status: 'created' },
  ]);
  for (const context of fixture.contexts) {
    const stored = fixture.roles.get(context.id)?.find((role) => role.roleKey === 'editor');
    expect(stored).toBeDefined();
    expect({
      roleKey: stored?.roleKey,
      permissions: [...(stored?.permissions ?? [])].sort((a, b) =>
        a.permissionKey.localeCompare(b.permissionKey)
      ),
    }).toEqual(editorialGrantContract());
    const calls = fixture.call.mock.calls
      .map(([request]) => request)
      .filter((request) => request.contextId === context.id);
    expect(calls.map(({ method }) => method)).toEqual(['GET', 'GET', 'POST', 'GET']);
  }
  const one = fixture.postPayloads
    .get('one')
    ?.permissionAssignments?.map(({ permissionId }) => permissionId);
  const two = fixture.postPayloads
    .get('two')
    ?.permissionAssignments?.map(({ permissionId }) => permissionId);
  expect(one).toBeDefined();
  expect(two).toBeDefined();
  expect(one?.some((id) => two?.includes(id))).toBe(false);
});

it('retains actual tenant-specific grants across retries and individual role changes', async () => {
  const fixture = editorialTenants();
  await ensureEditorRoles({ contextIds: ['one', 'two'] }, fixture.contexts, fixture.call);
  const ctxOne = fixture.contextFor('one', 'editor');
  const ctxTwo = fixture.contextFor('two', 'editor');
  const editorOne = fixture.roles.get('one')?.find((role) => role.roleKey === 'editor');
  if (!editorOne) throw new Error('producer_did_not_create_role');
  editorOne.permissions = editorOne.permissions.filter(
    (permission) => permission.permissionKey !== 'media.delete'
  );
  const rolesBefore = structuredClone([...fixture.roles]);
  const writesBefore = fixture.call.mock.calls.filter(
    ([request]) => request.method === 'POST'
  ).length;
  const repeated = await ensureEditorRoles(
    { contextIds: ['one', 'two'] },
    fixture.contexts,
    fixture.call
  );
  expect(repeated).toEqual([
    expect.objectContaining({
      contextId: 'one',
      status: 'existing',
      matchesStandard: false,
      differences: ['media.delete'],
    }),
    expect.objectContaining({ contextId: 'two', status: 'existing', matchesStandard: true }),
  ]);
  expect([...fixture.roles]).toEqual(rolesBefore);
  expect(fixture.call.mock.calls.filter(([request]) => request.method === 'POST')).toHaveLength(
    writesBefore
  );
  const one = await authorizeInstancePermissionForUser({
    ctx: ctxOne,
    action: 'media.delete',
    permissions: fixture.grantsFor(ctxOne),
    logDeniedDecision: false,
  });
  const two = await authorizeInstancePermissionForUser({
    ctx: ctxTwo,
    action: 'media.delete',
    permissions: fixture.grantsFor(ctxTwo),
    logDeniedDecision: false,
  });
  expect(one).toMatchObject({ ok: false, status: 403 });
  expect(two).toMatchObject({ ok: true });
});

it('feeds produced editor and admin grants into exact ownership writes and publication in both tenants', async () => {
  const fixture = editorialTenants();
  await ensureEditorRoles({ contextIds: ['one', 'two'] }, fixture.contexts, fixture.call);
  for (const id of ['one', 'two']) {
    const editor = fixture.contextFor(id, 'editor');
    const admin = fixture.contextFor(id, 'system_admin');
    const permissions = fixture.grantsFor(editor);
    const context = {
      instanceId: editor.user.instanceId,
      keycloakSubject: editor.user.id,
      actorAccountId: editor.user.id,
      activeOrganizationId: editor.activeOrganizationId,
      actingPrincipalType: 'organization' as const,
      credentialFingerprint: 'b'.repeat(64),
      forceExactScopeAuthorization: true,
      permissions,
      contentId: 'synthetic-content',
    };
    expect(
      authorizeMainserverCreatePrincipal({
        ...context,
        action: 'news.create',
        contentType: 'news.article',
      }).allowed
    ).toBe(true);
    for (const [action, contentType] of [
      ['news.update', 'news.article'],
      ['news.delete', 'news.article'],
      ['events.update', 'events.event-record'],
      ['events.delete', 'events.event-record'],
      ['poi.update', 'poi.point-of-interest'],
      ['poi.delete', 'poi.point-of-interest'],
      ['content.publish', 'news.article'],
    ]) {
      await expect(
        authorizeMainserverDataProviderAccess({
          ...context,
          action,
          contentType,
          dataProviderId: `provider-${id}-organization`,
        })
      ).resolves.toMatchObject({ allowed: true, authorizationMode: 'exact' });
      for (const dataProviderId of [
        `provider-${id}-other-organization`,
        `provider-${id === 'one' ? 'two' : 'one'}-organization`,
      ]) {
        await expect(
          authorizeMainserverDataProviderAccess({ ...context, action, contentType, dataProviderId })
        ).resolves.toMatchObject({
          allowed: false,
          reason: 'data_provider_mismatch',
          authorizationMode: 'exact',
        });
      }
      await expect(
        authorizeMainserverDataProviderAccess({
          ...context,
          action,
          contentType,
          keycloakSubject: admin.user.id,
          actorAccountId: admin.user.id,
          permissions: fixture.grantsFor(admin),
          dataProviderId: `provider-${id}-other-organization`,
        })
      ).resolves.toMatchObject({ allowed: true, authorizationMode: 'exact' });
    }
  }
});

const unexpectedReadPath = (): never => {
  throw new Error('unexpected_read_path');
};

it('composes production user and role read-handler factories with real guards and produced assignments', async () => {
  const fixture = editorialTenants();
  await ensureEditorRoles({ contextIds: ['one', 'two'] }, fixture.contexts, fixture.call);
  const authorize = async (
    ctx: Parameters<typeof authorizeInstancePermissionForUser>[0]['ctx'],
    action: string
  ) => {
    const decision = await authorizeInstancePermissionForUser({
      ctx,
      action,
      permissions: fixture.grantsFor(ctx),
      logDeniedDecision: false,
    });
    return decision.ok
      ? null
      : Response.json({ error: decision.error }, { status: decision.status });
  };
  const jsonResponse = (status: number, body: unknown) => Response.json(body, { status });
  const createApiError = (status: number, code: string, message: string) =>
    Response.json({ error: { code, message } }, { status });
  const listUserData = vi.fn(async () => ({ users: [], total: 0 }));
  const listRoleData = vi.fn(async () => []);
  const roleDeps: RoleReadHandlerDeps = {
    asApiList: (data, pagination) => ({ data, pagination }),
    classifyIamDiagnosticError: unexpectedReadPath,
    consumeRateLimit: () => null,
    createApiError,
    ensureFeature: () => null,
    getFeatureFlags: () => ({}),
    getWorkspaceContext: () => ({ requestId: 'synthetic-read' }),
    jsonResponse,
    authorizeRoleReadAccess: async (_request, ctx) => authorize(ctx, 'iam.role.read'),
    listPlatformRolesInternal: unexpectedReadPath,
    loadKeycloakRoleListItems: unexpectedReadPath,
    loadPermissions: unexpectedReadPath,
    loadRoleListItems: listRoleData,
    requireRoles: unexpectedReadPath,
    resolveActorInfo: async (_request, ctx) => ({
      actor: { instanceId: ctx.user.instanceId ?? '' },
    }),
  };
  const userDeps: UserReadHandlerDeps = {
    applyCanonicalUserDetailProjection: unexpectedReadPath,
    applyCanonicalUserListProjection: async ({ users }) => users,
    asApiItem: (data) => ({ data }),
    asApiList: (data, pagination) => ({ data, pagination }),
    consumeRateLimit: () => null,
    createApiError,
    createDatabaseApiError: unexpectedReadPath,
    jsonResponse,
    listPlatformUsersInternal: unexpectedReadPath,
    logUserProjectionDegraded: unexpectedReadPath,
    logger: { error: unexpectedReadPath, warn: unexpectedReadPath },
    readPage: () => ({ page: 1, pageSize: 10 }),
    readString: (value) => value ?? undefined,
    readValidatedUserId: unexpectedReadPath,
    resolveKeycloakRoleNames: unexpectedReadPath,
    resolveProjectedMainserverCredentialState: unexpectedReadPath,
    resolveTenantKeycloakUsersWithPagination: listUserData,
    resolveUserDetail: unexpectedReadPath,
    resolveUserReadAccess: async (_request, ctx) => {
      const failure = await authorize(ctx, 'iam.user.read');
      return failure ? { response: failure } : { actor: { instanceId: ctx.user.instanceId ?? '' } };
    },
    resolveUserTimeline: unexpectedReadPath,
    withInstanceScopedDb: async (_instanceId, work) => work({ query: unexpectedReadPath }),
  };
  const roles = createRoleReadHandlers(roleDeps);
  const users = createUserReadHandlers(userDeps);
  for (const id of ['one', 'two']) {
    const editor = fixture.contextFor(id, 'editor');
    const admin = fixture.contextFor(id, 'system_admin');
    const endpoints = [
      { path: 'users', read: users.listUsersInternal, load: listUserData },
      { path: 'roles', read: roles.listRolesInternal, load: listRoleData },
    ];
    for (const endpoint of endpoints) {
      endpoint.load.mockClear();
      const url = `https://${id}.example.invalid/api/v1/iam/${endpoint.path}`;
      const denied = await endpoint.read(new Request(url), editor);
      expect(denied.status).toBe(403);
      expect(endpoint.load).not.toHaveBeenCalled();
      expect((await endpoint.read(new Request(url), admin)).status).toBe(200);
      expect(endpoint.load).toHaveBeenCalledTimes(1);
      const foreign = {
        ...admin,
        user: { ...admin.user, instanceId: `test-${id === 'one' ? 'two' : 'one'}` },
      };
      expect((await endpoint.read(new Request(url), foreign)).status).toBe(403);
      expect(endpoint.load).toHaveBeenCalledTimes(1);
    }
    for (const action of [
      'iam.user.write',
      'iam.role.write',
      'iam.accounts.delete',
      'content.transferOwnership',
    ]) {
      expect(await authorize(editor, action)).toBeInstanceOf(Response);
      expect(await authorize(admin, action)).toBeNull();
    }
    for (const action of [
      'media.create',
      'media.update',
      'media.delete',
      'categories.create',
      'categories.update',
      'categories.delete',
    ]) {
      expect(await authorize(editor, action)).toBeNull();
    }
  }
});
