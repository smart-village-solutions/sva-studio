import type { IamMyDeletionRulesOverview, IamTenantDeletionRulesOverview } from '@sva/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SessionUser = {
  id: string;
  instanceId?: string;
  roles: string[];
};

const state = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  withAuthenticatedUser: vi.fn(),
  withResolvedInstanceDb: vi.fn(),
  loadTenantDeletionRulesOverview: vi.fn(),
  loadMyDeletionRulesOverview: vi.fn(),
  validateCsrf: vi.fn(() => null),
  authorizeInstancePermissionForUser: vi.fn(),
  queries: [] as string[],
  createApiError: vi.fn(
    (status: number, error: string, message: string, requestId?: string) =>
      new Response(JSON.stringify({ error, message, requestId }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
  ),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: () => ({ requestId: 'req-1', traceId: 'trace-1' }),
  withRequestContext: async (_input: unknown, work: () => Promise<Response>) => work(),
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('../runtime-secrets.js', () => ({
  getIamDatabaseUrl: () => undefined,
}));

vi.mock('../db.js', () => ({
  createPoolResolver: () => () => null,
  jsonResponse: (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  textResponse: (status: number, body: string, contentType: string) =>
    new Response(body, {
      status,
      headers: { 'Content-Type': contentType },
    }),
  withResolvedInstanceDb: state.withResolvedInstanceDb,
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  createApiError: state.createApiError,
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: state.validateCsrf,
}));

vi.mock('@sva/iam-governance', () => ({
  loadTenantDeletionRulesOverview: state.loadTenantDeletionRulesOverview,
  loadMyDeletionRulesOverview: state.loadMyDeletionRulesOverview,
}));

vi.mock('../instance-permission-authorization.js', () => ({
  authorizeInstancePermissionForUser: state.authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode: (error: string) =>
    error === 'missing_instance'
      ? 'invalid_instance_id'
      : error === 'invalid_action'
        ? 'invalid_request'
        : error === 'database_unavailable'
          ? 'database_unavailable'
          : 'forbidden',
}));

const defaultUser: SessionUser = {
  id: 'kc-user-1',
  instanceId: 'de-test',
  roles: ['legacy-role'],
};

const adminOverview: IamTenantDeletionRulesOverview = {
  instanceId: 'de-test',
  deactivateAfterDays: 90,
  pseudonymizeAfterDays: 180,
  deleteAfterDays: 365,
  defaultContentStrategy: 'retain',
  allowContentPreferenceOverride: true,
  canEdit: true,
};

const myOverview: IamMyDeletionRulesOverview = {
  instanceId: 'de-test',
  lastLoginAt: '2026-05-01T10:00:00.000Z',
  lifecycleState: 'active',
  rules: adminOverview,
  contentPreference: {
    isOverridden: true,
    effectiveStrategy: 'with_owner_lifecycle',
    overrideStrategy: 'with_owner_lifecycle',
  },
};

const buildDbClient = () => ({
  query: vi.fn(async (text: string) => {
    state.queries.push(text);

    if (text.includes('FROM iam.accounts a') && text.includes('WHERE a.keycloak_subject = $2')) {
      return {
        rowCount: 1,
        rows: [{ id: '11111111-1111-1111-1111-111111111111' }],
      };
    }

    return { rowCount: 1, rows: [] };
  }),
});

describe('iam deletion rules runtime handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.queries.splice(0, state.queries.length);

    state.withAuthenticatedUser.mockImplementation(async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
      handler({ user: defaultUser })
    );
    state.withResolvedInstanceDb.mockImplementation(async (_resolver: unknown, _instanceId: string, work: (client: ReturnType<typeof buildDbClient>) => Promise<Response>) =>
      work(buildDbClient())
    );
    state.loadTenantDeletionRulesOverview.mockResolvedValue(adminOverview);
    state.loadMyDeletionRulesOverview.mockResolvedValue(myOverview);
    state.authorizeInstancePermissionForUser.mockResolvedValue({ ok: true, permissions: [] });
  });

  it('returns admin deletion rules for a tenant-scoped custom permission actor', async () => {
    const { deletionRulesAdminHandler } = await import('./core.js');

    const response = await deletionRulesAdminHandler(
      new Request('http://localhost/iam/admin/deletion-rules?instanceId=de-test')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(adminOverview);
    expect(state.loadTenantDeletionRulesOverview).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'de-test',
      canEdit: true,
    });
  });

  it('accepts custom permission grants without legacy admin roles for tenant deletion rules', async () => {
    const { deletionRulesAdminHandler } = await import('./core.js');
    state.withAuthenticatedUser.mockImplementationOnce(
      async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
        handler({
          user: {
            id: 'custom-admin',
            instanceId: 'de-test',
            roles: ['custom_role'],
          },
        })
    );

    const response = await deletionRulesAdminHandler(
      new Request('http://localhost/iam/admin/deletion-rules?instanceId=de-test')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(adminOverview);
  });

  it('stores tenant defaults and returns the refreshed overview', async () => {
    const { deletionRulesAdminHandler } = await import('./core.js');

    const response = await deletionRulesAdminHandler(
      new Request('http://localhost/iam/admin/deletion-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: 'de-test',
          deactivateAfterDays: 120,
          pseudonymizeAfterDays: 240,
          deleteAfterDays: 400,
          defaultContentStrategy: 'with_owner_lifecycle',
          allowContentPreferenceOverride: false,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(state.queries.some((query) => query.includes('INSERT INTO iam.instance_deletion_rules'))).toBe(true);
    await expect(response.json()).resolves.toEqual(adminOverview);
  });

  it('rejects platform admins without tenant scope for tenant deletion rules', async () => {
    const { deletionRulesAdminHandler } = await import('./core.js');
    state.withAuthenticatedUser.mockImplementationOnce(async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
      handler({
        user: {
          id: 'platform-admin',
          roles: ['system_admin'],
        },
      })
    );

    const response = await deletionRulesAdminHandler(
      new Request('http://localhost/iam/admin/deletion-rules?instanceId=de-test')
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'forbidden' });
    expect(state.loadTenantDeletionRulesOverview).not.toHaveBeenCalled();
  });

  it('rejects invalid tenant defaults before writing them', async () => {
    const { deletionRulesAdminHandler } = await import('./core.js');

    const response = await deletionRulesAdminHandler(
      new Request('http://localhost/iam/admin/deletion-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: 'de-test',
          deactivateAfterDays: 180,
          pseudonymizeAfterDays: 90,
          deleteAfterDays: 365,
          defaultContentStrategy: 'retain',
          allowContentPreferenceOverride: true,
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(state.queries.some((query) => query.includes('INSERT INTO iam.instance_deletion_rules'))).toBe(false);
  });

  it('returns my deletion rules overview for the authenticated tenant account', async () => {
    const { myDeletionRulesOverviewHandler } = await import('./core.js');

    const response = await myDeletionRulesOverviewHandler(
      new Request('http://localhost/iam/me/deletion-rules')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(myOverview);
    expect(state.loadMyDeletionRulesOverview).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'de-test',
      accountId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('stores a self-service content preference override', async () => {
    const { myDeletionRulesPreferenceHandler } = await import('./core.js');

    const response = await myDeletionRulesPreferenceHandler(
      new Request('http://localhost/iam/me/deletion-rules/content-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'with_owner_lifecycle' }),
      })
    );

    expect(response.status).toBe(200);
    expect(
      state.queries.some((query) => query.includes('INSERT INTO iam.account_deletion_content_preferences'))
    ).toBe(true);
    await expect(response.json()).resolves.toEqual(myOverview);
    expect(state.loadMyDeletionRulesOverview).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'de-test',
      accountId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('removes self-service overrides when the tenant disables them', async () => {
    const disabledOverrideOverview: IamMyDeletionRulesOverview = {
      ...myOverview,
      rules: {
        ...adminOverview,
        allowContentPreferenceOverride: false,
      },
      contentPreference: {
        isOverridden: false,
        effectiveStrategy: 'retain',
      },
    };
    state.loadMyDeletionRulesOverview.mockResolvedValueOnce(disabledOverrideOverview);

    const { myDeletionRulesPreferenceHandler } = await import('./core.js');

    const response = await myDeletionRulesPreferenceHandler(
      new Request('http://localhost/iam/me/deletion-rules/content-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'with_owner_lifecycle' }),
      })
    );

    expect(response.status).toBe(403);
    expect(
      state.queries.some((query) => query.includes('INSERT INTO iam.account_deletion_content_preferences'))
    ).toBe(false);
  });

  it('rejects invalid self-service content strategies before writing them', async () => {
    const { myDeletionRulesPreferenceHandler } = await import('./core.js');

    const response = await myDeletionRulesPreferenceHandler(
      new Request('http://localhost/iam/me/deletion-rules/content-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'invalid' }),
      })
    );

    expect(response.status).toBe(400);
    expect(
      state.queries.some((query) => query.includes('INSERT INTO iam.account_deletion_content_preferences'))
    ).toBe(false);
  });

  it('returns method not allowed for unsupported admin handler verbs', async () => {
    const { deletionRulesAdminHandler } = await import('./core.js');

    const response = await deletionRulesAdminHandler(
      new Request('http://localhost/iam/admin/deletion-rules', { method: 'DELETE' })
    );

    expect(response.status).toBe(405);
    await expect(response.text()).resolves.toBe('Method Not Allowed');
  });

  it('maps admin overview and save failures to database_unavailable responses', async () => {
    const { deletionRulesAdminHandler } = await import('./core.js');
    state.loadTenantDeletionRulesOverview.mockRejectedValueOnce(new Error('db_down'));

    const getResponse = await deletionRulesAdminHandler(
      new Request('http://localhost/iam/admin/deletion-rules?instanceId=de-test')
    );

    expect(getResponse.status).toBe(503);
    await expect(getResponse.json()).resolves.toMatchObject({
      error: 'database_unavailable',
    });

    state.withResolvedInstanceDb.mockRejectedValueOnce(new Error('write_failed'));
    const postResponse = await deletionRulesAdminHandler(
      new Request('http://localhost/iam/admin/deletion-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: 'de-test',
          deactivateAfterDays: 120,
          pseudonymizeAfterDays: 240,
          deleteAfterDays: 400,
          defaultContentStrategy: 'retain',
          allowContentPreferenceOverride: true,
        }),
      })
    );

    expect(postResponse.status).toBe(503);
    await expect(postResponse.json()).resolves.toMatchObject({
      error: 'database_unavailable',
    });
  });

  it('short-circuits admin saves on csrf and missing tenant scope', async () => {
    const { deletionRulesAdminHandler } = await import('./core.js');
    state.validateCsrf.mockReturnValueOnce(
      new Response(JSON.stringify({ error: 'csrf_invalid' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const csrfResponse = await deletionRulesAdminHandler(
      new Request('http://localhost/iam/admin/deletion-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: 'de-test',
          deactivateAfterDays: 120,
          pseudonymizeAfterDays: 240,
          deleteAfterDays: 400,
          defaultContentStrategy: 'retain',
          allowContentPreferenceOverride: true,
        }),
      })
    );

    expect(csrfResponse.status).toBe(403);
    await expect(csrfResponse.json()).resolves.toMatchObject({ error: 'csrf_invalid' });

    state.withAuthenticatedUser.mockImplementationOnce(async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
      handler({
        user: {
          id: 'platform-admin',
          roles: ['system_admin'],
        },
      })
    );

    const scopedResponse = await deletionRulesAdminHandler(
      new Request('http://localhost/iam/admin/deletion-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: 'de-test',
          deactivateAfterDays: 120,
          pseudonymizeAfterDays: 240,
          deleteAfterDays: 400,
          defaultContentStrategy: 'retain',
          allowContentPreferenceOverride: true,
        }),
      })
    );

    expect(scopedResponse.status).toBe(403);
    await expect(scopedResponse.json()).resolves.toMatchObject({ error: 'forbidden' });
  });

  it('returns forbidden or database_unavailable for missing actor and unexpected overview failures', async () => {
    const { myDeletionRulesOverviewHandler } = await import('./core.js');
    state.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, _instanceId, work) =>
      work({
        query: vi.fn(async (text: string) => {
          state.queries.push(text);
          return { rowCount: 0, rows: [] };
        }),
      })
    );

    const missingActorResponse = await myDeletionRulesOverviewHandler(
      new Request('http://localhost/iam/me/deletion-rules')
    );

    expect(missingActorResponse.status).toBe(403);
    await expect(missingActorResponse.json()).resolves.toMatchObject({ error: 'forbidden' });

    state.withResolvedInstanceDb.mockRejectedValueOnce('repo_down_string');
    const failedResponse = await myDeletionRulesOverviewHandler(
      new Request('http://localhost/iam/me/deletion-rules')
    );

    expect(failedResponse.status).toBe(503);
    await expect(failedResponse.json()).resolves.toMatchObject({ error: 'database_unavailable' });
    expect(state.logger.error).toHaveBeenCalledWith(
      'My deletion rules overview failed',
      expect.objectContaining({ error: 'repo_down_string' })
    );
  });

  it('short-circuits self-service preference writes on csrf, missing actor and repository failures', async () => {
    const { myDeletionRulesPreferenceHandler } = await import('./core.js');
    state.validateCsrf.mockReturnValueOnce(
      new Response(JSON.stringify({ error: 'csrf_invalid' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const csrfResponse = await myDeletionRulesPreferenceHandler(
      new Request('http://localhost/iam/me/deletion-rules/content-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'retain' }),
      })
    );

    expect(csrfResponse.status).toBe(403);
    await expect(csrfResponse.json()).resolves.toMatchObject({ error: 'csrf_invalid' });

    state.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, _instanceId, work) =>
      work({
        query: vi.fn(async (text: string) => {
          state.queries.push(text);
          return { rowCount: 0, rows: [] };
        }),
      })
    );

    const missingActorResponse = await myDeletionRulesPreferenceHandler(
      new Request('http://localhost/iam/me/deletion-rules/content-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'retain' }),
      })
    );

    expect(missingActorResponse.status).toBe(403);
    await expect(missingActorResponse.json()).resolves.toMatchObject({ error: 'forbidden' });

    state.withResolvedInstanceDb.mockRejectedValueOnce(new Error('repo_down'));
    const failedResponse = await myDeletionRulesPreferenceHandler(
      new Request('http://localhost/iam/me/deletion-rules/content-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'retain' }),
      })
    );

    expect(failedResponse.status).toBe(503);
    await expect(failedResponse.json()).resolves.toMatchObject({ error: 'database_unavailable' });
  });

  it('rejects self-service preference writes without tenant scope and logs non-Error repository failures', async () => {
    const { myDeletionRulesPreferenceHandler } = await import('./core.js');
    state.withAuthenticatedUser.mockImplementationOnce(async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
      handler({
        user: {
          id: 'platform-admin',
          roles: ['system_admin'],
        },
      })
    );

    const forbiddenResponse = await myDeletionRulesPreferenceHandler(
      new Request('http://localhost/iam/me/deletion-rules/content-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'retain' }),
      })
    );

    expect(forbiddenResponse.status).toBe(400);
    await expect(forbiddenResponse.json()).resolves.toMatchObject({ error: 'invalid_instance_id' });

    state.withResolvedInstanceDb.mockRejectedValueOnce('repo_down_string');
    const failedResponse = await myDeletionRulesPreferenceHandler(
      new Request('http://localhost/iam/me/deletion-rules/content-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'retain' }),
      })
    );

    expect(failedResponse.status).toBe(503);
    await expect(failedResponse.json()).resolves.toMatchObject({ error: 'database_unavailable' });
    expect(state.logger.error).toHaveBeenCalledWith(
      'My deletion rules preference update failed',
      expect.objectContaining({ error: 'repo_down_string' })
    );
  });
});
