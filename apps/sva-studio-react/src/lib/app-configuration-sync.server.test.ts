// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigurationSave } from '@sva/sva-mainserver';
import {
  changeAppConfigurationVariant,
  saveAppConfiguration,
} from './app-configuration-sync.server';

const state = vi.hoisted(() => ({
  authenticated: true,
  plugin: vi.fn(),
  permissions: vi.fn(),
  save: vi.fn(),
  changeVariant: vi.fn(),
  lock: vi.fn(),
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
  listSvaMainserverAppConfiguration: vi.fn(),
  getSvaMainserverAppConfiguration: vi.fn(),
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
    expect(await saveAppConfiguration(request, command)).toEqual({
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
    expect(await changeAppConfigurationVariant(request, deletion)).toEqual({
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
