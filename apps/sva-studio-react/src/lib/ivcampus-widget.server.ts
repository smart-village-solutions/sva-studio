import {
  buildRequestOriginFromHeaders,
  readConfiguredPluginTenantAccess,
  resolveAuthConfigForRequest,
} from '@sva/auth-runtime/server';
import { workspaceServerModuleLoaders } from '#studio-plugin-server-inputs';
import { ivCampusWidgetRoutePath } from './server-entry-types';

const loadWidget =
  workspaceServerModuleLoaders['../../../../packages/plugin-ivcampus/src/server.ts'];

const sandboxInstanceId = 'de-studio-sandbox';

export async function dispatchIvCampusWidgetRequest(request: Request): Promise<Response | null> {
  if (new URL(request.url).pathname !== ivCampusWidgetRoutePath) return null;

  const unavailable = () =>
    new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
  if (!loadWidget || !process.env.SVA_IVCAMPUS_PILOT_ORIGIN) return unavailable();
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  }

  try {
    const { createIvCampusWidgetResponse, ivCampusPilotStudioOrigin, parseIvCampusOrigin } =
      (await loadWidget()) as typeof import('@sva/plugin-ivcampus/server');
    const origin = parseIvCampusOrigin(process.env.SVA_IVCAMPUS_PILOT_ORIGIN);
    if (!origin || buildRequestOriginFromHeaders(request) !== ivCampusPilotStudioOrigin)
      return unavailable();

    const config = await resolveAuthConfigForRequest(request);
    if (config.kind !== 'instance' || config.instanceId !== sandboxInstanceId) return unavailable();
    const access = await readConfiguredPluginTenantAccess(config.instanceId, 'ivcampus');
    return access.allowed ? createIvCampusWidgetResponse(request, origin) : unavailable();
  } catch {
    const { createSdkLogger } = await import('@sva/server-runtime');
    const logger = createSdkLogger({ component: 'ivcampus-widget', level: 'info' });
    logger.warn('ivCampus widget unavailable', { operation: 'resolve_ivcampus_widget_access' });
    return unavailable();
  }
}
