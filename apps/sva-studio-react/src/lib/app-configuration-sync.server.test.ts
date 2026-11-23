import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigurationSave } from '@sva/sva-mainserver';
import { saveAppConfiguration } from './app-configuration-sync.server';

const state = vi.hoisted(() => ({
  authenticated: true,
  plugin: vi.fn(),
  permissions: vi.fn(),
  save: vi.fn(),
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
  validateCsrf: (await importOriginal<typeof import('@sva/auth-runtime/server')>()).validateCsrf,
}));
vi.mock('@sva/sva-mainserver/server', () => ({
  listSvaMainserverAppConfiguration: vi.fn(),
  getSvaMainserverAppConfiguration: vi.fn(),
  saveSvaMainserverAppConfiguration: state.save,
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
