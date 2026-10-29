import { createServerFn } from '@tanstack/react-start';
import {
  loadInterfacesRequestDependencies,
  runWithAuthenticatedInterfacesUser,
  validateInterfaceMutationCsrf,
  resolveAuthorizedInterfacesInstanceId,
} from './interfaces-api-context';

export const checkDeepLInterfaceForRequest = async (
  data: { instanceId?: string; id: string },
  request?: Request
): Promise<{ ok: boolean; errorCode?: string }> => {
  if (
    !data ||
    typeof data.id !== 'string' ||
    !/^[A-Za-z0-9:_-]{1,128}$/.test(data.id) ||
    (data.instanceId !== undefined && typeof data.instanceId !== 'string')
  )
    throw new Error('invalid_config');
  const deps = await loadInterfacesRequestDependencies(request);
  return runWithAuthenticatedInterfacesUser({
    request: deps.request,
    fallbackMessage: 'deepl_check_failed',
    run: async (ctx) => {
      await validateInterfaceMutationCsrf(deps.request);
      const instanceId = await resolveAuthorizedInterfacesInstanceId(
        deps.logger,
        ctx,
        'check_deepl_interface',
        data.instanceId
      );
      const { checkDeepLLanguages, readConfiguredPluginTenantAccess } =
        await import('@sva/auth-runtime/server');
      const access = await readConfiguredPluginTenantAccess(instanceId, 'app-translations');
      if (!access.allowed)
        throw new Error(
          access.reason === 'inactive'
            ? 'deepl_requires_multilingual_module'
            : 'deepl_module_unavailable'
        );
      return checkDeepLLanguages(instanceId, data.id);
    },
  });
};
export const checkDeepLInterfaceServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => checkDeepLInterfaceForRequest(data));
