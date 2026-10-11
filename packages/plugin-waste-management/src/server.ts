import { wasteManagementHttpRuntime } from '@sva/waste-management-runtime/server';
import type { PluginServerExecutionHandler, PluginServerHandlerExecutionContext } from '@sva/plugin-sdk';
import { createWastePluginServerDependencies, type WastePluginServerCapabilities } from './server-context.js';

export type { WastePluginServerCapabilities } from './server-context.js';
import { wasteManagementServerRoutes } from './server-routes.js';

export { createPluginJobExecutionHandlers } from '@sva/waste-management-runtime/server';

export const createPluginServerHandlers = (capabilities: WastePluginServerCapabilities): Readonly<Record<string, PluginServerExecutionHandler>> => {
  const { loaders, ...serverContext } = createWastePluginServerDependencies(capabilities);
  return Object.fromEntries(
    wasteManagementServerRoutes.map(([, method, handlerName]) => [
      `waste-management.${handlerName}.${method.toLowerCase()}`,
      (executionContext: PluginServerHandlerExecutionContext) => {
        if (executionContext.scope !== 'tenant') return new Response(null, { status: 403 });
        const ctx = {
          sessionId: executionContext.sessionId,
          activeOrganizationId: executionContext.activeOrganizationId,
          user: {
            id: executionContext.actor.id,
            instanceId: executionContext.actor.instanceId,
            roles: [...executionContext.actor.roles],
            email: executionContext.actor.email,
            displayName: executionContext.actor.displayName,
          },
        };
        const wasteManagementHandlers = wasteManagementHttpRuntime.createWasteManagementHandlers({
          host: serverContext.sharedWasteManagementDeps,
          withAuthenticatedHandler: (request, handler) =>
            serverContext.withAuthenticatedWasteManagementHandler(ctx, request, (currentRequest, current) =>
              handler(currentRequest, current),
            ),
          loaders,
        });
        return wasteManagementHandlers[handlerName](executionContext.request);
      },
    ])
  );
};
