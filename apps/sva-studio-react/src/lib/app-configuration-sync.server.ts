import {
  appConfigurationReadAccess,
  appConfigurationWriteAccess,
} from './app-configuration-access';
import {
  resolveEffectivePermissions,
  evaluateTenantPluginAccess,
  readConfiguredPluginTenantAccess,
  validateCsrf,
  withAuthenticatedUser,
} from '@sva/auth-runtime/server';
import type {
  AppConfigurationDocument,
  AppConfigurationRecord,
  AppConfigurationSave,
  AppConfigurationSyncResult,
} from '@sva/sva-mainserver';

type ReadCommand = { id?: string };
type Result<T> = { ok: true; data: T } | { ok: false; error: 'denied' | 'failed' };

const run = async <T>(
  request: Request,
  action: 'application-workspace.settings.read' | 'application-workspace.settings.update',
  execute: (
    input: Parameters<
      typeof import('@sva/sva-mainserver/server').listSvaMainserverAppConfiguration
    >[0]
  ) => Promise<T>
): Promise<Result<T>> => {
  const response = await withAuthenticatedUser(request, async (ctx) => {
    const instanceId = ctx.user.instanceId;
    if (!instanceId) return new Response(null, { status: 403 });
    const writing = action === 'application-workspace.settings.update';
    const tenantAccess = await readConfiguredPluginTenantAccess(
      instanceId,
      'application-workspace'
    );
    if (!tenantAccess.allowed) return new Response(null, { status: 403 });
    const resolved = await resolveEffectivePermissions({
      instanceId,
      keycloakSubject: ctx.user.id,
      organizationId: ctx.activeOrganizationId,
    });
    if (!resolved.ok) return new Response(null, { status: 503 });
    const decision = evaluateTenantPluginAccess({
      requirement: writing ? appConfigurationWriteAccess : appConfigurationReadAccess,
      instanceId,
      organizationId: ctx.activeOrganizationId,
      pluginId: 'application-workspace',
      permissions: resolved.permissions,
    });
    if (decision.status !== 'allowed') return new Response(null, { status: 403 });
    if (writing) {
      const csrf = validateCsrf(request, undefined, { allowServerFnHeader: true });
      if (csrf) return csrf;
    }
    try {
      const data = await execute({
        instanceId,
        keycloakSubject: ctx.user.id,
        activeOrganizationId: ctx.activeOrganizationId,
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      const { createSdkLogger } = await import('@sva/server-runtime');
      createSdkLogger({ component: 'app-configuration' }).warn(
        'App configuration operation failed',
        { action }
      );
      return new Response(null, { status: 502 });
    }
  });
  return response.ok
    ? ((await response.json()) as Result<T>)
    : { ok: false, error: response.status < 500 ? 'denied' : 'failed' };
};

export const readAppConfiguration = (request: Request, command: ReadCommand) =>
  run<AppConfigurationDocument | AppConfigurationRecord[] | null>(
    request,
    'application-workspace.settings.read',
    async (input) => {
      const { getSvaMainserverAppConfiguration, listSvaMainserverAppConfiguration } =
        await import('@sva/sva-mainserver/server');
      return command.id
        ? getSvaMainserverAppConfiguration(input, command.id)
        : listSvaMainserverAppConfiguration(input);
    }
  );

export const saveAppConfiguration = (request: Request, command: AppConfigurationSave) =>
  run<AppConfigurationSyncResult>(
    request,
    'application-workspace.settings.update',
    async (input) => {
      const { saveSvaMainserverAppConfiguration } = await import('@sva/sva-mainserver/server');
      return saveSvaMainserverAppConfiguration(input, command);
    }
  );
