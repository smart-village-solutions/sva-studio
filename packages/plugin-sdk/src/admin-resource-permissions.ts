import { normalizePluginIdentifier } from './plugin-identifiers.js';
import type { AdminResourceGuard } from './admin-resource-list-contracts.js';
import type {
  AdminResourceViewPermissions,
  AdminResourceContentUiDefinition,
} from './admin-resource-contracts.js';
import {
  ADMIN_RESOURCE_ACTION_ID_PATTERN,
  assertAllowedCapabilityKeys,
  validateContentResourceBindingDefinition,
} from './admin-resource-validation-shared.js';

const adminResourcePermissionsAllowedKeys = new Set([
  'list',
  'create',
  'detail',
  'history',
] as const);
const adminResourceContentUiAllowedKeys = new Set(['contentType', 'bindings'] as const);
const adminResourceContentUiBindingsAllowedKeys = new Set(['list', 'detail', 'editor'] as const);
export const normalizeAdminResourcePermissions = (
  resourceId: string,
  permissions: AdminResourceViewPermissions | undefined
): AdminResourceViewPermissions | undefined => {
  if (!permissions) {
    return undefined;
  }

  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.permissions`,
    permissions,
    adminResourcePermissionsAllowedKeys
  );

  const normalizePermissionList = (
    viewName: keyof AdminResourceViewPermissions,
    values: readonly string[] | undefined
  ): readonly string[] | undefined => {
    if (values === undefined) {
      return undefined;
    }
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(`invalid_admin_resource_permissions:${resourceId}:${String(viewName)}`);
    }

    const normalizedValues = values.map((value) => {
      const normalized = normalizePluginIdentifier(value);
      if (!ADMIN_RESOURCE_ACTION_ID_PATTERN.test(normalized)) {
        throw new Error(
          `invalid_admin_resource_action_id:${resourceId}:permissions.${String(viewName)}:${normalized}`
        );
      }
      return normalized;
    });

    return [...new Set(normalizedValues)];
  };

  const normalizedPermissions = {
    list: normalizePermissionList('list', permissions.list),
    create: normalizePermissionList('create', permissions.create),
    detail: normalizePermissionList('detail', permissions.detail),
    history: normalizePermissionList('history', permissions.history),
  } as const;

  return Object.values(normalizedPermissions).some((value) => value !== undefined)
    ? normalizedPermissions
    : undefined;
};

export const normalizeAdminResourceContentUi = (
  resourceId: string,
  guard: AdminResourceGuard,
  contentUi: AdminResourceContentUiDefinition | undefined
): AdminResourceContentUiDefinition | undefined => {
  if (!contentUi) {
    return undefined;
  }

  if (guard !== 'content') {
    throw new Error(`invalid_admin_resource_content_ui_guard:${resourceId}:${guard}`);
  }

  assertAllowedCapabilityKeys(
    resourceId,
    `${resourceId}.contentUi`,
    contentUi,
    adminResourceContentUiAllowedKeys
  );

  const normalizedContentType = normalizePluginIdentifier(contentUi.contentType);
  if (normalizedContentType.length === 0) {
    throw new Error(`invalid_admin_resource_content_type:${resourceId}`);
  }

  const bindings = contentUi.bindings
    ? (() => {
        assertAllowedCapabilityKeys(
          resourceId,
          `${resourceId}.contentUi.bindings`,
          contentUi.bindings,
          adminResourceContentUiBindingsAllowedKeys
        );

        return {
          list: validateContentResourceBindingDefinition(
            resourceId,
            'list',
            contentUi.bindings.list
          ),
          detail: validateContentResourceBindingDefinition(
            resourceId,
            'detail',
            contentUi.bindings.detail
          ),
          editor: validateContentResourceBindingDefinition(
            resourceId,
            'editor',
            contentUi.bindings.editor
          ),
        };
      })()
    : undefined;

  return {
    contentType: normalizedContentType,
    bindings,
  };
};
