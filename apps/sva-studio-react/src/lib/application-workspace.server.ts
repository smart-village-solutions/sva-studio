/** Host-owned persistence binding; configuration and audit commit in one transaction. */
import { readApplicationWorkspace, saveApplicationWorkspace } from '@sva/data-repositories/server';
import { pluginServerHost } from '@sva/auth-runtime/plugin-server-host';
import { isTablerIconName } from '@sva/studio-ui-react/tabler-icon-catalog';
import type { PluginServerHandlerExecutionContext } from '@sva/plugin-sdk';
type StoredApplicationWorkspace = Awaited<ReturnType<typeof readApplicationWorkspace>>;
type WorkspaceContext = Extract<PluginServerHandlerExecutionContext, { scope: 'tenant' | 'platform' }>;
export const applicationWorkspaceHost = {
  isIconName: isTablerIconName,
  read: (instanceId: string) =>
    pluginServerHost.withInstanceDb(instanceId, (client) =>
      readApplicationWorkspace(client, instanceId)
    ),
  save: (context: WorkspaceContext, configuration: StoredApplicationWorkspace) => {
    const instanceId = context.actor.instanceId;
    if (!instanceId) throw new Error('invalid_instance_context');
    return pluginServerHost.withInstanceDb(instanceId, async (client) => {
      const previous = await readApplicationWorkspace(client, instanceId);
      const result = await saveApplicationWorkspace(client, instanceId, configuration);
      await pluginServerHost.insertActivityLog(client, {
        eventType: 'plugin_action_authorized',
        instanceId,
        actorUserId: context.actor.id,
        outcome: 'success',
        pluginAction: {
          actionId: 'application-workspace.settings.update',
          actionNamespace: 'application-workspace',
          actionOwner: 'application-workspace',
          result: 'success',
          resourceType: 'application-workspace.settings',
          resourceId: String(result.version),
        },
      });
      const ids = new Set(
        [...previous.tiles, ...configuration.tiles].flatMap((tile) =>
          typeof tile === 'object' && tile && 'id' in tile && typeof tile.id === 'string'
            ? [tile.id]
            : []
        )
      );
      for (const id of ids)
        await pluginServerHost.insertActivityLog(client, {
          eventType: 'plugin_action_authorized',
          instanceId,
          actorUserId: context.actor.id,
          outcome: 'success',
          pluginAction: {
            actionId: 'application-workspace.settings.update',
            actionNamespace: 'application-workspace',
            actionOwner: 'application-workspace',
            result: 'success',
            resourceType: 'application-workspace.application',
            resourceId: id,
          },
        });
      return result;
    });
  },
};
