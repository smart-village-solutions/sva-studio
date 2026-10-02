import type { PluginDefinition } from './plugin-definition-types.js';
import type { PluginAccessTransitionDiagnostic } from './plugin-registry-types.js';
import { normalizePluginNamespace } from './plugin-identifiers.js';

const collectAdminResourceAccessDiagnostics = (
  plugin: PluginDefinition,
  pluginId: string
): PluginAccessTransitionDiagnostic[] => {
  const diagnostics: PluginAccessTransitionDiagnostic[] = [];
  for (const resource of plugin.adminResources ?? []) {
    for (const [view, permissionIds] of Object.entries(resource.permissions ?? {})) {
      if (permissionIds === undefined) {
        continue;
      }
      if (!resource.accessRequirements?.[view as keyof typeof resource.accessRequirements]) {
        diagnostics.push({
          pluginId,
          contributionType: 'adminResource',
          contributionId: `${resource.resourceId}.${view}`,
          code: 'missing_access_requirement',
        });
      }
    }
  }
  return diagnostics;
};

export const collectPluginAccessTransitionDiagnostics = (
  plugins: readonly PluginDefinition[]
): readonly PluginAccessTransitionDiagnostic[] =>
  plugins.flatMap((plugin) => {
    const pluginId = normalizePluginNamespace(plugin.id);
    const diagnostics: PluginAccessTransitionDiagnostic[] = [];
    for (const action of plugin.actions ?? []) {
      if (!action.accessRequirement) {
        diagnostics.push({
          pluginId,
          contributionType: 'action',
          contributionId: action.id,
          code: 'missing_access_requirement',
        });
      }
    }
    for (const route of plugin.routes) {
      if ((route.guard || route.actionId || route.serverHandlerId) && !route.accessRequirement) {
        diagnostics.push({
          pluginId,
          contributionType: 'route',
          contributionId: route.id,
          code: 'missing_access_requirement',
        });
      }
    }
    for (const navigationItem of plugin.navigation ?? []) {
      if (
        (navigationItem.requiredAction || navigationItem.actionId) &&
        !navigationItem.accessRequirement
      ) {
        diagnostics.push({
          pluginId,
          contributionType: 'navigation',
          contributionId: navigationItem.id,
          code: 'missing_access_requirement',
        });
      }
    }
    diagnostics.push(...collectAdminResourceAccessDiagnostics(plugin, pluginId));
    return diagnostics;
  });
