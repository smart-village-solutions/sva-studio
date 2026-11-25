// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigurationSave } from '@sva/sva-mainserver';
import {
  changeAppConfigurationVariant as changeVariantAction,
  readAppConfiguration as readAction,
  saveAppConfiguration as saveAction,
} from './app-configuration-sync-api';
import {
  changeAppConfigurationVariant,
  saveAppConfiguration,
} from './app-configuration-sync.server';

const state = vi.hoisted(() => ({
  authenticated: true,
  plugin: vi.fn(),
  permissions: vi.fn(),
  request: vi.fn(),
  setResponseHeader: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
  changeVariant: vi.fn(),
  lock: vi.fn(),
}));
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    validator: (validate: (data: unknown) => Promise<unknown>) => ({
      handler:
        (handle: (input: { data: unknown }) => Promise<unknown>) =>
        async ({ data }: { data: unknown }) =>
          handle({ data: await validate(data) }),
    }),
  }),
}));
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: state.request,
  setResponseHeader: state.setResponseHeader,
}));
vi.mock('@sva/auth-runtime/server', async (importOriginal) => ({
  evaluateTenantPluginAccess: (await importOriginal<typeof import('@sva/auth-runtime/server')>())
    .evaluateTenantPluginAccess,
  withAuthenticatedUser: (_request: Request, next: (ctx: unknown) => Promise<Response>) =>
    state.authenticated
      ? next({ user: { id: 'editor', instanceId: 'sandbox' }, activeOrganizationId: 'org' })
      : Promise.resolve(new Response(null, { status: 401 })),
  readConfiguredPluginTenantAccess: state.plugin,
  resolveEffectivePermissions: state.permissions,
  withExternalContentMutationLock: state.lock,
  validateCsrf: (await importOriginal<typeof import('@sva/auth-runtime/server')>()).validateCsrf,
}));
vi.mock('@sva/sva-mainserver/server', () => ({
  listSvaMainserverAppConfiguration: state.list,
  getSvaMainserverAppConfiguration: state.read,
  saveSvaMainserverAppConfiguration: state.save,
  changeSvaMainserverAppConfigurationVariant: state.changeVariant,
}));
const command: AppConfigurationSave = {
  id: '42',
  baselineRevision: 'r1',
  baseline: { alternativeLocation: { state: 'missing' }, tileTitleLines: { state: 'missing' } },
  changes: { tileTitleLines: 4 },
};
const request = new Request('https://studio.example/_server/unit', {
  method: 'POST',
  headers: { origin: 'https://studio.example', 'x-tsr-serverfn': 'true' },
});
const permission = (operation: 'read' | 'update') => ({
  action: 'application-workspace.settings.' + operation,
  resourceType: 'application-workspace.settings',
  accessScope: 'all',
});
beforeEach(() => {
  vi.resetAllMocks();
  state.authenticated = true;
  state.request.mockReturnValue(request);
  state.plugin.mockResolvedValue({ allowed: true });
  state.permissions.mockResolvedValue({
    ok: true,
    permissions: [permission('read'), permission('update')],
  });
  state.lock.mockImplementation(({ execute }) => execute());
  state.save.mockResolvedValue({ status: 'unsupported' });
});
describe('App configuration host write authorization', () => {
  it.each(['session', 'module', 'read', 'update', 'CSRF'] as const)(
    'rejects writes without %s',
    async (missing) => {
      if (missing === 'session') state.authenticated = false;
      if (missing === 'module') state.plugin.mockResolvedValue({ allowed: false });
      if (missing === 'read')
        state.permissions.mockResolvedValue({ ok: true, permissions: [permission('update')] });
      if (missing === 'update')
        state.permissions.mockResolvedValue({ ok: true, permissions: [permission('read')] });

      const input =
        missing === 'CSRF'
          ? new Request(request.url, {
              method: 'POST',
              headers: { origin: 'https://other.example', 'x-tsr-serverfn': 'true' },
            })
          : request;
      expect(await saveAppConfiguration(input, command)).toEqual({ ok: false, error: 'denied' });
      expect(state.save).not.toHaveBeenCalled();
    }
  );

  it('binds the write to the authenticated actor, workspace and organization', async () => {
    expect(await saveAction({ data: command })).toEqual({
      ok: true,
      data: { status: 'unsupported' },
    });
    expect(state.permissions).toHaveBeenCalledWith({
      instanceId: 'sandbox',
      keycloakSubject: 'editor',
      organizationId: 'org',
    });
    expect(state.save).toHaveBeenCalledWith(
      {
        instanceId: 'sandbox',
        keycloakSubject: 'editor',
        activeOrganizationId: 'org',
      },
      command
    );
  });
});

describe('App configuration variant authorization', () => {
  const selection = { id: '42', revision: 'r1' };
  const deletion = { ...selection, operation: 'delete' } as const;

  it('requires broader permissions than editing settings', async () => {
    expect(await changeAppConfigurationVariant(request, deletion)).toEqual({
      ok: false,
      error: 'denied',
    });
    expect(state.lock).not.toHaveBeenCalled();
    expect(state.changeVariant).not.toHaveBeenCalled();
  });

  it('runs under the same tenant lock as a settings update', async () => {
    state.permissions.mockResolvedValue({
      ok: true,
      permissions: [
        permission('read'),
        permission('update'),
        { action: 'integration.manage', resourceType: 'integration', accessScope: 'all' },
      ],
    });
    state.changeVariant.mockResolvedValue({ status: 'deleted' });
    expect(await changeVariantAction({ data: deletion })).toEqual({
      ok: true,
      data: { status: 'deleted' },
    });
    expect(state.lock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'sandbox',
        referenceId: 'app-configuration',
      })
    );
    expect(state.changeVariant).toHaveBeenCalledWith(
      { instanceId: 'sandbox', keycloakSubject: 'editor', activeOrganizationId: 'org' },
      deletion
    );
  });
});

describe('App configuration read endpoints', () => {
  const session = {
    instanceId: 'sandbox',
    keycloakSubject: 'editor',
    activeOrganizationId: 'org',
  };

  it('returns the authorized list without caching the response', async () => {
    state.list.mockResolvedValue([]);
    state.permissions.mockResolvedValue({ ok: true, permissions: [permission('read')] });

    expect(await readAction({ data: {} })).toEqual({ ok: true, data: [] });
    expect(state.list).toHaveBeenCalledWith(session);
    expect(state.setResponseHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(state.lock).not.toHaveBeenCalled();
  });

  it('reads the exact ID and rejects an invalid selection before contacting the Mainserver', async () => {
    state.read.mockResolvedValue(null);

    await expect(readAction({ data: { id: 'invalid' } })).rejects.toThrow();
    expect(state.read).not.toHaveBeenCalled();
    expect(await readAction({ data: { id: '42' } })).toEqual({ ok: true, data: null });
    expect(state.read).toHaveBeenCalledWith(session, '42');
  });

  it('reports an unavailable permission check without calling the Mainserver', async () => {
    state.permissions.mockResolvedValue({ ok: false });

    expect(await readAction({ data: {} })).toEqual({ ok: false, error: 'failed' });
    expect(state.list).not.toHaveBeenCalled();
  });
});
