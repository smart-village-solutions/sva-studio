import { assertPluginContributionAllowedKeys } from './guardrails.js';
import { normalizePluginIdentifier } from './plugin-identifiers.js';
import type {
  AdminResourceViews,
  AdminResourceViewDefinition,
} from './admin-resource-list-contracts.js';
import type {
  AdminResourceContentUiBindings,
  ContentResourceViewBindingDefinition,
} from './admin-resource-contracts.js';

export const adminResourceDefinitionAllowedKeys = new Set([
  'resourceId',
  'basePath',
  'titleKey',
  'guard',
  'moduleId',
  'views',
  'permissions',
  'accessRequirements',
  'capabilities',
  'contentUi',
] as const);
const adminResourceViewAllowedKeys = new Set(['bindingKey'] as const);
const ADMIN_RESOURCE_PARAM_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
export const ADMIN_RESOURCE_ACTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z][A-Za-z0-9-]*$/;

export const normalizeBasePath = (value: string): string => {
  const trimmed = value.trim();
  let start = 0;
  let end = trimmed.length;

  while (start < end && trimmed[start] === '/') {
    start += 1;
  }
  while (end > start && trimmed[end - 1] === '/') {
    end -= 1;
  }

  const normalized = trimmed.slice(start, end);
  if (normalized.length === 0) {
    throw new Error('invalid_admin_resource_base_path');
  }
  if (normalized.includes('/')) {
    throw new Error(`invalid_admin_resource_base_path:${normalized}`);
  }
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) === false) {
    throw new Error(`invalid_admin_resource_base_path:${normalized}`);
  }

  return normalized;
};

export const validateViewDefinition = (
  resourceId: string,
  viewName: keyof AdminResourceViews,
  view: AdminResourceViewDefinition | undefined
): AdminResourceViewDefinition => {
  if (view) {
    assertPluginContributionAllowedKeys(
      view,
      adminResourceViewAllowedKeys,
      normalizePluginIdentifier(resourceId).split('.')[0] ?? 'host',
      `${resourceId}.${String(viewName)}`
    );
  }

  const bindingKey = normalizePluginIdentifier(view?.bindingKey ?? '');
  if (bindingKey.length === 0) {
    throw new Error(`invalid_admin_resource_view:${resourceId}:${viewName}`);
  }

  return { bindingKey };
};

export const validateContentResourceBindingDefinition = (
  resourceId: string,
  viewName: keyof AdminResourceContentUiBindings,
  view: ContentResourceViewBindingDefinition | undefined
): ContentResourceViewBindingDefinition | undefined => {
  if (!view) {
    return undefined;
  }

  assertPluginContributionAllowedKeys(
    view,
    adminResourceViewAllowedKeys,
    normalizePluginIdentifier(resourceId).split('.')[0] ?? 'host',
    `${resourceId}.contentUi.bindings.${String(viewName)}`
  );

  const bindingKey = normalizePluginIdentifier(view.bindingKey);
  if (bindingKey.length === 0) {
    throw new Error(`invalid_admin_resource_view:${resourceId}:contentUi.${viewName}`);
  }

  return { bindingKey };
};

export const normalizeLabelKey = (resourceId: string, fieldName: string, value: string): string => {
  const normalized = normalizePluginIdentifier(value);
  if (normalized.length === 0) {
    throw new Error(`invalid_admin_resource_capability:${resourceId}:${fieldName}`);
  }
  return normalized;
};

export const normalizeBindingKey = (
  resourceId: string,
  fieldName: string,
  value: string
): string => {
  const normalized = normalizePluginIdentifier(value);
  if (normalized.length === 0) {
    throw new Error(`invalid_admin_resource_capability:${resourceId}:${fieldName}`);
  }
  return normalized;
};

export const normalizeModuleId = (
  resourceId: string,
  value: string | undefined
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) === false) {
    throw new Error(`invalid_admin_resource_module_id:${resourceId}:${normalized}`);
  }

  return normalized;
};

export const normalizeCapabilityId = (
  resourceId: string,
  fieldName: string,
  value: string
): string => {
  const normalized = normalizePluginIdentifier(value);
  if (normalized.length === 0) {
    throw new Error(`invalid_admin_resource_capability:${resourceId}:${fieldName}`);
  }
  return normalized;
};

export const normalizeSearchParamName = (
  resourceId: string,
  fieldName: string,
  value: string
): string => {
  const normalized = value.trim();
  if (ADMIN_RESOURCE_PARAM_PATTERN.test(normalized) === false) {
    throw new Error(`invalid_admin_resource_search_param:${resourceId}:${fieldName}:${normalized}`);
  }
  return normalized;
};

export const assertAllowedCapabilityKeys = (
  resourceId: string,
  contributionId: string,
  value: object,
  allowedKeys: ReadonlySet<string>
) => {
  assertPluginContributionAllowedKeys(
    value,
    allowedKeys,
    resourceId.split('.')[0] ?? 'host',
    contributionId
  );
};

export const assertUniqueValues = (
  resourceId: string,
  conflictCode: string,
  values: readonly string[]
) => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`${conflictCode}:${resourceId}:${value}`);
    }
    seen.add(value);
  }
};

export const normalizeActionId = (resourceId: string, fieldName: string, value: string): string => {
  const normalized = normalizePluginIdentifier(value);
  if (ADMIN_RESOURCE_ACTION_ID_PATTERN.test(normalized) === false) {
    throw new Error(`invalid_admin_resource_action_id:${resourceId}:${fieldName}:${normalized}`);
  }
  return normalized;
};
