import type { PluginNavigationItem, PluginRouteDefinition } from './plugin-definition-types.js';
import {
  assertPluginContributionAllowedKeys,
  assertPluginRoutePathAllowed,
  createPluginGuardrailError,
} from './guardrails.js';
import { normalizePluginIdentifier } from './plugin-identifiers.js';
import { hasMatchingPluginAccessRequirement } from './plugin-platform/access-requirements.js';
import { assertPluginRouteDocumentation } from './route-documentation.js';
import {
  assertOwnedPluginActionReference,
  assertPluginAccessRequirement,
  assertPluginPermissionReference,
  isStandardCrudPluginRoute,
  pluginUsesStandardContentAdminResource,
} from './plugin-definition-validation.js';
import type { PluginRegistryValidationContext } from './plugin-registry-actions.js';

const routeDefinitionAllowedKeys = new Set([
  'id',
  'path',
  'documentation',
  'layout',
  'editorLeaveGuard',
  'guard',
  'actionId',
  'serverHandlerId',
  'accessRequirement',
  'validateSearch',
  'component',
] as const);
const navigationItemAllowedKeys = new Set([
  'group',
  'id',
  'to',
  'href',
  'titleKey',
  'section',
  'icon',
  'actionId',
  'requiredAction',
  'accessRequirement',
] as const);
export const assertPluginRegistryRoutes = ({
  plugin,
  pluginNamespace,
  extensionTier,
}: PluginRegistryValidationContext): void => {
  for (const route of plugin.routes) {
    assertPluginContributionAllowedKeys(
      route,
      routeDefinitionAllowedKeys,
      pluginNamespace,
      normalizePluginIdentifier(route.id)
    );
    if (route.editorLeaveGuard !== undefined && route.editorLeaveGuard !== true) {
      throw new Error(`plugin_route_editor_guard_invalid:${pluginNamespace}:${route.id}`);
    }
    if (route.layout !== undefined && route.layout !== 'content-only') {
      throw new Error(`plugin_route_layout_invalid:${pluginNamespace}:${route.id}`);
    }
    assertPluginRoutePathAllowed(pluginNamespace, normalizePluginIdentifier(route.id), route.path);
    assertPluginPermissionReference(plugin, pluginNamespace, route.id, route.guard);
    assertPluginAccessRequirement(
      plugin,
      pluginNamespace,
      route.id,
      route.accessRequirement,
      route.guard,
      extensionTier,
      true
    );

    const routeActionId = normalizePluginIdentifier(route.actionId ?? '');
    if (routeActionId) {
      const action = assertOwnedPluginActionReference(
        plugin,
        pluginNamespace,
        routeActionId,
        `invalid_plugin_route_action_id:${pluginNamespace}:${route.id}:${routeActionId}`,
        `plugin_route_action_owner_mismatch:${pluginNamespace}:${route.id}:${routeActionId}`,
        `plugin_route_action_missing:${pluginNamespace}:${route.id}:${routeActionId}`
      );
      if (!route.accessRequirement) {
        throw new Error(
          `plugin_access_requirement_missing:${pluginNamespace}:${route.id}:${routeActionId}`
        );
      }
      if (route.guard !== action.requiredAction) {
        throw new Error(
          `plugin_route_action_guard_mismatch:${pluginNamespace}:${route.id}:${routeActionId}`
        );
      }
      if (!hasMatchingPluginAccessRequirement(route.accessRequirement, action.accessRequirement)) {
        throw new Error(
          `plugin_route_action_access_requirement_mismatch:${pluginNamespace}:${route.id}:${routeActionId}`
        );
      }
    }
    const serverHandlerId = normalizePluginIdentifier(route.serverHandlerId ?? '');
    if (serverHandlerId) {
      const serverHandler = plugin.serverHandlers?.find(
        (handler) => normalizePluginIdentifier(handler.id) === serverHandlerId
      );
      if (!serverHandler) {
        throw new Error(
          `plugin_route_server_handler_missing:${pluginNamespace}:${route.id}:${serverHandlerId}`
        );
      }
      if (serverHandler.accessRequirement.kind === 'service') {
        throw new Error(
          `plugin_route_service_handler_forbidden:${pluginNamespace}:${route.id}:${serverHandlerId}`
        );
      }
      if (!route.accessRequirement) {
        throw new Error(
          `plugin_access_requirement_missing:${pluginNamespace}:${route.id}:${serverHandlerId}`
        );
      }
      if (
        !hasMatchingPluginAccessRequirement(
          route.accessRequirement,
          serverHandler.accessRequirement
        )
      ) {
        throw new Error(
          `plugin_route_server_handler_access_requirement_mismatch:${pluginNamespace}:${route.id}:${serverHandlerId}`
        );
      }
    }
  }
};

export const normalizePluginRegistryRouteDocumentation = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): readonly PluginRouteDefinition[] =>
  plugin.routes.map((route) => ({
    ...route,
    documentation: assertPluginRouteDocumentation(pluginNamespace, route.id, route.documentation),
  }));

export const assertPluginRegistryStandardContentRouteGuardrails = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  if (pluginUsesStandardContentAdminResource(plugin) === false) {
    return;
  }

  for (const route of plugin.routes) {
    if (isStandardCrudPluginRoute(pluginNamespace, route.path)) {
      throw createPluginGuardrailError({
        code: 'plugin_guardrail_route_bypass',
        pluginNamespace,
        contributionId: normalizePluginIdentifier(route.id),
        fieldOrReason: 'path',
      });
    }
  }
};

export const assertPluginRegistryNavigation = ({
  plugin,
  pluginNamespace,
  extensionTier,
}: PluginRegistryValidationContext): void => {
  const groups = new Map<string, string>();
  for (const navigationItem of plugin.navigation ?? []) {
    assertPluginContributionAllowedKeys(
      navigationItem,
      navigationItemAllowedKeys,
      pluginNamespace,
      normalizePluginIdentifier(navigationItem.id)
    );
    if (
      Boolean(navigationItem.to) === Boolean(navigationItem.href) ||
      (navigationItem.href && !/^https:\/\/[^\s]+$/i.test(navigationItem.href))
    ) {
      throw new Error(`plugin_navigation_target_invalid:${pluginNamespace}:${navigationItem.id}`);
    }
    assertNavigationPresentation({ plugin, pluginNamespace }, navigationItem);
    if (navigationItem.group !== undefined) {
      const group = navigationItem.group;
      if (
        !group ||
        typeof group.id !== 'string' ||
        !group.id.startsWith(`${pluginNamespace}.`) ||
        !/^[a-z][a-z0-9.-]*$/u.test(group.id) ||
        typeof group.titleKey !== 'string' ||
        !group.titleKey.trim() ||
        Object.keys(group).some((key) => key !== 'id' && key !== 'titleKey') ||
        navigationItem.section !== 'applications' ||
        !navigationItem.to ||
        !navigationItem.accessRequirement ||
        !['tenant', 'platform'].includes(navigationItem.accessRequirement.kind)
      ) {
        throw new Error(`plugin_navigation_group_invalid:${pluginNamespace}:${navigationItem.id}`);
      }
      const route = plugin.routes.find((candidate) => candidate.path === navigationItem.to);
      if (
        !route ||
        !hasMatchingPluginAccessRequirement(
          route.accessRequirement,
          navigationItem.accessRequirement
        ) ||
        plugin.navigation?.some((candidate) => candidate.id === group.id)
      ) {
        throw new Error(
          `plugin_navigation_group_target_invalid:${pluginNamespace}:${navigationItem.id}`
        );
      }
      const identity = JSON.stringify([
        group.titleKey,
        navigationItem.section,
        navigationItem.accessRequirement.kind,
      ]);
      if (groups.has(group.id) && groups.get(group.id) !== identity) {
        throw new Error(`plugin_navigation_group_conflict:${pluginNamespace}:${group.id}`);
      }
      groups.set(group.id, identity);
    }

    assertPluginPermissionReference(
      plugin,
      pluginNamespace,
      navigationItem.id,
      navigationItem.requiredAction
    );
    assertPluginAccessRequirement(
      plugin,
      pluginNamespace,
      navigationItem.id,
      navigationItem.accessRequirement,
      navigationItem.requiredAction,
      extensionTier,
      true
    );

    const navigationActionId = normalizePluginIdentifier(navigationItem.actionId ?? '');
    if (!navigationActionId) {
      continue;
    }

    const action = assertOwnedPluginActionReference(
      plugin,
      pluginNamespace,
      navigationActionId,
      `invalid_plugin_navigation_action_id:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`,
      `plugin_navigation_action_owner_mismatch:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`,
      `plugin_navigation_action_missing:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`
    );
    if (!navigationItem.accessRequirement) {
      throw new Error(
        `plugin_access_requirement_missing:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`
      );
    }
    if (
      navigationItem.requiredAction &&
      action.requiredAction &&
      navigationItem.requiredAction !== action.requiredAction
    ) {
      throw new Error(
        `plugin_navigation_action_guard_mismatch:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`
      );
    }
    if (
      !hasMatchingPluginAccessRequirement(
        navigationItem.accessRequirement,
        action.accessRequirement
      )
    ) {
      throw new Error(
        `plugin_navigation_action_access_requirement_mismatch:${pluginNamespace}:${navigationItem.id}:${navigationActionId}`
      );
    }
  }
};

function assertNavigationPresentation(
  { plugin, pluginNamespace }: Pick<PluginRegistryValidationContext, 'plugin' | 'pluginNamespace'>,
  navigationItem: PluginNavigationItem
): void {
  if (navigationItem.section === 'header') {
    const route = plugin.routes.find((candidate) => candidate.path === navigationItem.to);
    if (
      !route ||
      navigationItem.href ||
      navigationItem.icon !== 'grid-dots' ||
      plugin.moduleIam?.moduleId !== pluginNamespace ||
      !route.actionId ||
      route.actionId !== navigationItem.actionId ||
      !hasMatchingPluginAccessRequirement(route.accessRequirement, navigationItem.accessRequirement)
    ) {
      throw new Error(`plugin_header_navigation_invalid:${pluginNamespace}:${navigationItem.id}`);
    }
  } else if (navigationItem.icon !== undefined) {
    throw new Error(`plugin_navigation_icon_invalid:${pluginNamespace}:${navigationItem.id}`);
  }
}
