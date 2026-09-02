import type {
  PluginServerExecutionHandler,
  PluginServerHandlerRegistryEntry,
} from '@sva/plugin-sdk';

import type { PluginServerHandlerDispatcherDependencies } from './dispatcher.js';

const serviceRuntimeUnavailable = (): Response => new Response(null, { status: 503 });

export const dispatchPluginServiceHandler = async (input: {
  readonly request: Request;
  readonly descriptor: PluginServerHandlerRegistryEntry;
  readonly handler: PluginServerExecutionHandler;
  readonly serviceId: string;
  readonly tenantHeaderName: string;
  readonly dependencies: PluginServerHandlerDispatcherDependencies | undefined;
}): Promise<Response> => {
  const authenticateService = input.dependencies?.authenticateService;
  const bindServiceTenant = input.dependencies?.bindServiceTenant;
  if (!authenticateService || !bindServiceTenant) return serviceRuntimeUnavailable();

  const authentication = await authenticateService({
    request: input.request,
    descriptor: input.descriptor,
    serviceId: input.serviceId,
  });
  if (authentication.kind === 'rejected') return authentication.response;

  const binding = await bindServiceTenant({
    request: input.request,
    descriptor: input.descriptor,
    serviceId: input.serviceId,
    serviceSubject: authentication.subject,
    tenantHeaderName: input.tenantHeaderName,
  });
  if (binding.kind === 'rejected') return binding.response;

  const startedAt = performance.now();
  const response = await input.handler({
    request: input.request,
    pluginId: input.descriptor.ownerPluginId,
    handlerId: input.descriptor.id,
    scope: 'service',
    service: {
      id: input.serviceId,
      subject: authentication.subject,
      actionId: input.descriptor.actionId,
    },
    tenant: binding.tenant,
  });
  try {
    await input.dependencies?.observeServiceResponse?.({
      request: input.request,
      descriptor: input.descriptor,
      tenant: binding.tenant,
      response,
      durationMs: performance.now() - startedAt,
    });
  } catch {
    // Observability must not change an already determined service response.
  }
  return response;
};
