/** Characterizes explicit tenant selection, non-overwriting creation and independent readback. */
import { describe, expect, it, vi } from 'vitest';
import type { PersonalMcpContext } from './config.js';
import { ensureEditorRoles } from './editor-role-baseline.js';
import type { PersonalRequest } from './tools-personal-request.js';
import { result } from './tools-support.js';

const contexts: PersonalMcpContext[] = ['one', 'two', 'untouched'].map((id) => ({
  id,
  name: id,
  kind: 'tenant',
  tenantId: `tenant-${id}`,
  baseUrl: `https://${id}.example.invalid`,
  issuer: `https://id.example.invalid/realms/${id}`,
  clientId: 'mcp',
}));
const core = [
  'read',
  'create',
  'updateMetadata',
  'updatePayload',
  'changeStatus',
  'publish',
  'archive',
  'restore',
  'delete',
];
const keys = [
  ...core.map((action) => `content.${action}`),
  ...['news', 'events', 'poi', 'categories'].flatMap((module) =>
    ['read', 'create', 'update', 'delete'].map((action) => `${module}.${action}`)
  ),
  ...['read', 'create', 'update', 'reference.manage', 'delete'].map((action) => `media.${action}`),
];
const marker = 'studio:editor-baseline:v1';
const admin = {
  id: 'admin',
  roleKey: 'system_admin',
  managedBy: 'studio',
  syncState: 'synced',
  permissions: [],
};
const scope = (key: string) =>
  key === 'content.create' ||
  key.endsWith('.create') ||
  key.startsWith('media.') ||
  key.startsWith('categories.')
    ? 'all'
    : 'organization';
const standardRole = () => ({
  id: 'editor-id',
  roleKey: 'editor',
  description: marker,
  managedBy: 'studio',
  syncState: 'synced',
  permissions: keys.map((permissionKey) => ({ permissionKey, accessScope: scope(permissionKey) })),
});

const setup = () => {
  const roles = new Map<string, ReturnType<typeof standardRole>[]>(contexts.map((c) => [c.id, []]));
  const catalog = (contextId: string) =>
    keys.map((permissionKey, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      instanceId: `tenant-${contextId}`,
      permissionKey,
      ...(scope(permissionKey) === 'organization'
        ? { isScopeAssignable: true, supportedAccessScopes: ['all', 'own', 'organization'] }
        : {}),
    }));
  const call = vi.fn(async (request: PersonalRequest) => {
    if (request.path === 'api/v1/iam/permissions')
      return result({ ok: true, data: { data: catalog(request.contextId) } });
    if (request.method === 'GET')
      return result({ ok: true, data: { data: [admin, ...(roles.get(request.contextId) ?? [])] } });
    roles.set(request.contextId, [standardRole()]);
    return result({ ok: true, data: { data: { id: 'editor-id' } } });
  });
  return { call, roles, catalog };
};

describe('editor role baseline', () => {
  it('creates only explicitly selected tenants and independently verifies every assignment', async () => {
    const { call } = setup();
    const outcomes = await ensureEditorRoles({ contextIds: ['one', 'two'] }, contexts, call);
    expect(outcomes).toEqual([
      expect.objectContaining({ contextId: 'one', status: 'created', matchesStandard: true }),
      expect.objectContaining({ contextId: 'two', status: 'created', matchesStandard: true }),
    ]);
    expect(call.mock.calls.some(([input]) => input.contextId === 'untouched')).toBe(false);
    for (const id of ['one', 'two']) {
      const calls = call.mock.calls
        .map(([input]) => input)
        .filter((input) => input.contextId === id);
      expect(calls.map(({ method, path }) => `${method}:${path}`)).toEqual([
        'GET:api/v1/iam/roles',
        'GET:api/v1/iam/permissions',
        'POST:api/v1/iam/roles',
        'GET:api/v1/iam/roles',
      ]);
      const create = calls[2]!;
      expect(create.body).toMatchObject({ roleName: 'editor', description: marker });
      expect(create.idempotencyKey).toBeTruthy();
      const assignments = create.body?.permissionAssignments as {
        permissionId: string;
        accessScope: string;
      }[];
      expect(assignments).toHaveLength(keys.length);
      expect(assignments[keys.indexOf('content.publish')]?.accessScope).toBe('organization');
      expect(assignments[keys.indexOf('media.delete')]?.accessScope).toBe('all');
      expect(assignments[keys.indexOf('categories.delete')]?.accessScope).toBe('all');
    }
  });

  it('preserves changed existing profiles, including deliberately removed rights', async () => {
    const { call, roles } = setup();
    const custom = standardRole();
    custom.permissions = custom.permissions.filter((p) => p.permissionKey !== 'events.delete');
    roles.set('one', [custom]);
    const outcomes = await ensureEditorRoles({ contextIds: ['one'] }, contexts, call);
    expect(outcomes[0]).toMatchObject({
      status: 'existing',
      matchesStandard: false,
      differences: ['events.delete'],
    });
    expect(call.mock.calls.every(([request]) => request.method === 'GET')).toBe(true);
    expect(roles.get('one')).toEqual([custom]);
  });

  it('repeats without writes once the profile exists', async () => {
    const { call } = setup();
    await ensureEditorRoles({ contextIds: ['one'] }, contexts, call);
    call.mockClear();
    expect((await ensureEditorRoles({ contextIds: ['one'] }, contexts, call))[0]).toMatchObject({
      status: 'existing',
      matchesStandard: true,
    });
    expect(call.mock.calls.every(([request]) => request.method === 'GET')).toBe(true);
  });

  it('does not adopt a same-name role without its own marker', async () => {
    const { call, roles } = setup();
    roles.set('one', [{ ...standardRole(), description: 'Customer-defined' }]);
    expect((await ensureEditorRoles({ contextIds: ['one'] }, contexts, call))[0]).toMatchObject({
      status: 'blocked',
      code: 'existing_role_requires_review',
    });
    expect(call.mock.calls.every(([request]) => request.method === 'GET')).toBe(true);
  });

  it.each(['unknown', 'platform'])(
    'rejects invalid selection %s before any request',
    async (id) => {
      const { call } = setup();
      const platform: PersonalMcpContext = { ...contexts[0]!, id: 'platform', kind: 'platform' };
      await expect(
        ensureEditorRoles({ contextIds: ['one', id] }, [...contexts, platform], call)
      ).rejects.toThrow();
      expect(call).not.toHaveBeenCalled();
    }
  );

  it('rejects duplicate and empty selections before any request', async () => {
    const { call } = setup();
    for (const contextIds of [[], ['one', 'one']]) {
      await expect(ensureEditorRoles({ contextIds }, contexts, call)).rejects.toThrow();
    }
    expect(call).not.toHaveBeenCalled();
  });

  it('blocks missing permissions instead of creating a partially privileged role', async () => {
    const { call, catalog } = setup();
    call
      .mockImplementationOnce(async () => result({ ok: true, data: { data: [admin] } }))
      .mockImplementationOnce(async () =>
        result({
          ok: true,
          data: { data: catalog('one').filter((p) => p.permissionKey !== 'events.delete') },
        })
      );
    expect((await ensureEditorRoles({ contextIds: ['one'] }, contexts, call))[0]).toMatchObject({
      status: 'blocked',
      code: 'permissions_missing',
      differences: ['events.delete'],
    });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('blocks old servers which would normalize publication to an unscoped grant', async () => {
    const { call, catalog } = setup();
    call
      .mockImplementationOnce(async () => result({ ok: true, data: { data: [admin] } }))
      .mockImplementationOnce(async () =>
        result({
          ok: true,
          data: {
            data: catalog('one').map((p) =>
              p.permissionKey === 'content.publish'
                ? { ...p, isScopeAssignable: false, supportedAccessScopes: ['all'] }
                : p
            ),
          },
        })
      );
    expect((await ensureEditorRoles({ contextIds: ['one'] }, contexts, call))[0]).toMatchObject({
      status: 'blocked',
      code: 'organization_scope_unavailable',
      differences: ['content.publish'],
    });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('does not add unsupported content or administrative permissions from the catalog', async () => {
    const { call, catalog } = setup();
    const extra = [
      'jobs.create',
      'iam.user.read',
      'iam.role.write',
      'content.transferOwnership',
      'content.readHistory',
      'content.manageRevisions',
    ];
    call
      .mockImplementationOnce(async () => result({ ok: true, data: { data: [admin] } }))
      .mockImplementationOnce(async () =>
        result({
          ok: true,
          data: {
            data: [
              ...catalog('one'),
              ...extra.map((permissionKey) => ({
                permissionKey,
                id: permissionKey,
                instanceId: 'tenant-one',
              })),
            ],
          },
        })
      );
    expect((await ensureEditorRoles({ contextIds: ['one'] }, contexts, call))[0]).toMatchObject({
      status: 'created',
      unsupportedContentActions: ['jobs.create'],
    });
    expect(call.mock.calls[2]?.[0].body?.permissionAssignments as unknown[]).toHaveLength(
      keys.length
    );
  });

  it('reports readback drift as failure and does not issue a corrective write', async () => {
    const { call } = setup();
    const original = call.getMockImplementation()!;
    call.mockImplementation(async (request) => {
      const response = await original(request);
      if (call.mock.calls.length === 4)
        return result({
          ok: true,
          data: { data: [admin, { ...standardRole(), permissions: [] }] },
        });
      return response;
    });
    expect((await ensureEditorRoles({ contextIds: ['one'] }, contexts, call))[0]).toMatchObject({
      status: 'error',
      code: 'role_readback_mismatch',
    });
    expect(call.mock.calls.filter(([request]) => request.method === 'POST')).toHaveLength(1);
  });

  it('reads after an uncertain create and isolates the error from the next selected tenant', async () => {
    const { call } = setup();
    const original = call.getMockImplementation()!;
    call.mockImplementation(async (request) =>
      request.contextId === 'one' && request.method === 'POST'
        ? result({ ok: false, error: { code: 'timeout' } }, true)
        : original(request)
    );
    const outcomes = await ensureEditorRoles({ contextIds: ['one', 'two'] }, contexts, call);
    expect(outcomes[0]).toMatchObject({ status: 'error', code: 'creation_outcome_unknown' });
    expect(outcomes[1]).toMatchObject({ status: 'created' });
    expect(
      call.mock.calls
        .filter(([request]) => request.contextId === 'one')
        .map(([request]) => request.method)
    ).toEqual(['GET', 'GET', 'POST', 'GET']);
  });
});
