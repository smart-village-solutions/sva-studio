import { withRootMainserverRegistryAccess } from '@sva/auth-runtime/server';
import { isValidInstanceId } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';
import { z } from 'zod';

import { SvaMainserverError } from './errors.js';
import { loadSvaMainserverSettings, saveSvaMainserverSettings } from './settings.js';

const logger = createSdkLogger({ component: 'root-mainserver-interface' });
const collectionPath = '/api/v1/iam/instances/mainserver-interfaces';
const detailPath = /^\/api\/v1\/iam\/instances\/([^/]+)\/mainserver-interface$/u;
const saveInput = z.object({
  graphqlBaseUrl: z.string().trim().min(1).max(4096),
  oauthTokenUrl: z.string().trim().min(1).max(4096),
  enabled: z.boolean(),
}).strict();

const statusFor = (config: Awaited<ReturnType<typeof loadSvaMainserverSettings>>) =>
  config === null ? 'missing' : config.enabled ? 'configured' : 'disabled';

const errorResponse = (error: unknown, operation: string): Response => {
  const status = error instanceof SvaMainserverError && error.statusCode < 500
    ? error.statusCode
    : 500;
  const code = error instanceof SvaMainserverError && status < 500
    ? error.code
    : 'mainserver_interface_error';
  logger.error('Root Mainserver interface request failed', {
    operation,
    error_code: code,
    status_code: status,
  });
  return Response.json({ error: { code } }, { status });
};

const readDetail = async (instanceId: string, requireConfig = false): Promise<Response> => {
  try {
    const config = await loadSvaMainserverSettings(instanceId);
    if (requireConfig && config === null) {
      return Response.json({ error: { code: 'mainserver_interface_readback_missing' } }, { status: 500 });
    }
    return Response.json({ data: { instanceId, status: statusFor(config), config } });
  } catch (error) {
    return errorResponse(error, 'read_root_mainserver_interface');
  }
};

export const dispatchRootMainserverInterfacesRequest = (request: Request): Promise<Response | null> => {
  const { pathname } = new URL(request.url);
  if (pathname === collectionPath) {
    if (request.method !== 'GET') {
      return Promise.resolve(new Response(null, { status: 405, headers: { allow: 'GET' } }));
    }
    return withRootMainserverRegistryAccess(request, 'instance.list', async (access) => {
      let instances: Awaited<ReturnType<typeof access.listActiveInstances>>;
      try {
        instances = await access.listActiveInstances();
      } catch (error) {
        return errorResponse(error, 'list_root_mainserver_instances');
      }
      const entries = [];
      for (let offset = 0; offset < instances.length; offset += 8) {
        const batch = await Promise.all(instances.slice(offset, offset + 8).map(async (instance) => {
          try {
            const config = await loadSvaMainserverSettings(instance.instanceId);
            return { ...instance, status: statusFor(config) };
          } catch {
            return { ...instance, status: 'error' as const, errorCode: 'mainserver_interface_read_failed' };
          }
        }));
        entries.push(...batch);
      }
      return Response.json({ data: { entries } });
    });
  }

  const match = detailPath.exec(pathname);
  if (!match) return Promise.resolve(null);
  const instanceId = match[1];
  if (!instanceId || !isValidInstanceId(instanceId)) {
    return Promise.resolve(Response.json({ error: { code: 'invalid_instance_id' } }, { status: 400 }));
  }
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return Promise.resolve(new Response(null, { status: 405, headers: { allow: 'GET, PUT' } }));
  }
  return withRootMainserverRegistryAccess(
    request,
    request.method === 'GET' ? 'instance.read' : 'instance.update',
    async (access) => {
      try {
        if (!await access.instanceExists(instanceId)) {
          return Response.json({ error: { code: 'instance_not_found' } }, { status: 404 });
        }
      } catch (error) {
        return errorResponse(error, 'resolve_root_mainserver_instance');
      }
      if (request.method === 'GET') return readDetail(instanceId);

      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        return Response.json({ error: { code: 'invalid_request' } }, { status: 400 });
      }
      const parsed = saveInput.safeParse(raw);
      if (!parsed.success) {
        return Response.json({ error: { code: 'invalid_request' } }, { status: 400 });
      }
      try {
        await saveSvaMainserverSettings({ instanceId, ...parsed.data });
        await access.recordSave(instanceId, parsed.data.enabled);
        return readDetail(instanceId, true);
      } catch (error) {
        return errorResponse(error, 'save_root_mainserver_interface');
      }
    }
  );
};
