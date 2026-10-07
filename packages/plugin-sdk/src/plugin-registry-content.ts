import { validateContentTypeMutations } from './content-type-mutations.js';
import { assertPluginContributionAllowedKeys } from './guardrails.js';
import {
  normalizePluginIdentifier,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';
import {
  permissionDefinitionAllowedKeys,
  auditEventDefinitionAllowedKeys,
  definePluginModuleIamContract,
  normalizePluginPermissionDefinition,
} from './plugin-iam-definitions.js';
import { assertPluginAccessRequirement } from './plugin-definition-validation.js';
import type { PluginRegistryValidationContext } from './plugin-registry-actions.js';

const contentTypeDefinitionAllowedKeys = new Set([
  'contentType',
  'displayName',
  'titleKey',
  'mainserverGenericType',
  'studioContentType',
  'editorFields',
  'listColumns',
  'actions',
  'validatePayload',
  'mutations',
] as const);
const adminResourceDefinitionAllowedKeys = new Set([
  'resourceId',
  'basePath',
  'titleKey',
  'guard',
  'moduleId',
  'views',
  'permissions',
  'capabilities',
  'contentUi',
  'accessRequirements',
] as const);
const contentHistoryContractAllowedKeys = new Set(['mode', 'coverage', 'reasonCode'] as const);
export const assertPluginRegistryPermissions = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  for (const permission of plugin.permissions ?? []) {
    assertPluginContributionAllowedKeys(
      permission,
      permissionDefinitionAllowedKeys,
      pluginNamespace,
      normalizePluginIdentifier(permission.id)
    );
    const normalizedPermission = normalizePluginPermissionDefinition(permission);
    const parsed = parseNamespacedPluginIdentifier(normalizedPermission.id);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_permission_id:${normalizedPermission.id}`);
    }
    if (parsed.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_permission_namespace_mismatch:${pluginNamespace}:${parsed.namespace}:${normalizedPermission.id}`
      );
    }
  }
};

export const assertPluginRegistryContentTypes = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  const pluginPermissionIds = new Set(
    (plugin.permissions ?? []).map((permission) => normalizePluginIdentifier(permission.id))
  );

  for (const contentTypeDefinition of plugin.contentTypes ?? []) {
    const contributionId = normalizePluginIdentifier(contentTypeDefinition.contentType);
    assertPluginContributionAllowedKeys(
      contentTypeDefinition,
      contentTypeDefinitionAllowedKeys,
      pluginNamespace,
      contributionId
    );
    const normalizedContentType = normalizePluginIdentifier(contentTypeDefinition.contentType);
    const parsed = parseNamespacedPluginIdentifier(normalizedContentType);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_content_type:${normalizedContentType}`);
    }
    if (parsed.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_content_type_namespace_mismatch:${pluginNamespace}:${parsed.namespace}:${normalizedContentType}`
      );
    }

    validateContentTypeMutations(contentTypeDefinition);
    for (const capability of Object.values(contentTypeDefinition.mutations ?? {})) {
      const action = plugin.actions?.find((entry) => entry.id === capability.requiredAction);
      if (
        !action ||
        action.requiredAction !== capability.requiredAction ||
        !pluginPermissionIds.has(capability.requiredAction)
      ) {
        throw new Error(
          `plugin_content_mutation_action_missing:${pluginNamespace}:${contributionId}:${capability.requiredAction}`
        );
      }
    }

    const studioContentType = contentTypeDefinition.studioContentType;
    if (!studioContentType) {
      continue;
    }

    const requiredReadAction = normalizePluginIdentifier(studioContentType.requiredReadAction);
    const requiredCreateAction = normalizePluginIdentifier(studioContentType.requiredCreateAction);
    const requiredReadIdentifier = parseNamespacedPluginIdentifier(requiredReadAction);
    const requiredCreateIdentifier = parseNamespacedPluginIdentifier(requiredCreateAction);

    if (requiredReadIdentifier?.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_content_type_read_action_namespace_mismatch:${pluginNamespace}:${requiredReadAction}:${normalizedContentType}`
      );
    }
    if (requiredCreateIdentifier?.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_content_type_create_action_namespace_mismatch:${pluginNamespace}:${requiredCreateAction}:${normalizedContentType}`
      );
    }
    if (!pluginPermissionIds.has(requiredReadAction)) {
      throw new Error(
        `plugin_content_type_read_action_missing:${pluginNamespace}:${requiredReadAction}:${normalizedContentType}`
      );
    }
    if (!pluginPermissionIds.has(requiredCreateAction)) {
      throw new Error(
        `plugin_content_type_create_action_missing:${pluginNamespace}:${requiredCreateAction}:${normalizedContentType}`
      );
    }
  }
};

export const assertPluginRegistryContentHistory = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  const hasEditableContent = (plugin.contentTypes ?? []).some(
    (definition) => definition.studioContentType !== undefined
  );
  const contract = plugin.contentHistory;

  if (hasEditableContent && !contract) {
    throw new Error(`plugin_content_history_binding_missing:${pluginNamespace}`);
  }
  if (!contract) {
    return;
  }

  assertPluginContributionAllowedKeys(
    contract,
    contentHistoryContractAllowedKeys,
    pluginNamespace,
    `${pluginNamespace}.contentHistory`
  );

  if (hasEditableContent && contract.mode !== 'host') {
    throw new Error(`plugin_content_history_classification_invalid:${pluginNamespace}`);
  }

  if (contract.mode === 'host' && contract.coverage !== 'studio_mutations') {
    throw new Error(`invalid_plugin_content_history_coverage:${pluginNamespace}`);
  }
  if (contract.mode === 'domain' && contract.reasonCode !== 'domain_history') {
    throw new Error(`invalid_plugin_content_history_reason:${pluginNamespace}`);
  }
};

export const assertPluginRegistryAdminResources = ({
  plugin,
  pluginNamespace,
  extensionTier,
}: PluginRegistryValidationContext): void => {
  for (const adminResource of plugin.adminResources ?? []) {
    const contributionId = normalizePluginIdentifier(adminResource.resourceId);
    assertPluginContributionAllowedKeys(
      adminResource,
      adminResourceDefinitionAllowedKeys,
      pluginNamespace,
      contributionId
    );
    const normalizedResourceId = normalizePluginIdentifier(adminResource.resourceId);
    const parsed = parseNamespacedPluginIdentifier(normalizedResourceId);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_admin_resource:${normalizedResourceId}`);
    }
    if (parsed.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_admin_resource_namespace_mismatch:${pluginNamespace}:${parsed.namespace}:${normalizedResourceId}`
      );
    }
    for (const [view, permissionIds] of Object.entries(adminResource.permissions ?? {})) {
      if (permissionIds === undefined) {
        continue;
      }
      if (
        !adminResource.accessRequirements?.[view as keyof typeof adminResource.accessRequirements]
      ) {
        throw new Error(
          `plugin_access_requirement_missing:${pluginNamespace}:${normalizedResourceId}.${view}:${permissionIds[0] ?? 'missing'}`
        );
      }
    }
    for (const [view, requirement] of Object.entries(adminResource.accessRequirements ?? {})) {
      assertPluginAccessRequirement(
        plugin,
        pluginNamespace,
        `${normalizedResourceId}.${view}`,
        requirement,
        adminResource.permissions?.[view as keyof typeof adminResource.permissions]?.[0],
        extensionTier,
        false
      );
    }
  }
};

export const assertPluginRegistryAuditEvents = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  for (const eventDefinition of plugin.auditEvents ?? []) {
    const contributionId = normalizePluginIdentifier(eventDefinition.eventType);
    assertPluginContributionAllowedKeys(
      eventDefinition,
      auditEventDefinitionAllowedKeys,
      pluginNamespace,
      contributionId
    );
    const normalizedEventType = normalizePluginIdentifier(eventDefinition.eventType);
    const parsed = parseNamespacedPluginIdentifier(normalizedEventType);
    if (parsed === undefined) {
      throw new Error(`invalid_plugin_audit_event_type:${normalizedEventType}`);
    }
    if (parsed.namespace !== pluginNamespace) {
      throw new Error(
        `plugin_audit_event_namespace_mismatch:${pluginNamespace}:${parsed.namespace}:${normalizedEventType}`
      );
    }
  }
};

export const assertPluginRegistryModuleIam = ({
  plugin,
  pluginNamespace,
}: PluginRegistryValidationContext): void => {
  if (plugin.moduleIam) {
    definePluginModuleIamContract(pluginNamespace, plugin.moduleIam);
  }
  const requirements = plugin.requiredTenantModuleIds ?? [];
  const normalized = requirements.map((moduleId) => normalizePluginIdentifier(moduleId));
  if (normalized.some((moduleId) => !moduleId) || new Set(normalized).size !== normalized.length) {
    throw new Error(`invalid_plugin_tenant_module_requirements:${pluginNamespace}`);
  }
  if (normalized.includes(pluginNamespace)) {
    throw new Error(`self_plugin_tenant_module_requirement:${pluginNamespace}`);
  }
};
