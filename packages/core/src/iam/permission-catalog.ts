export type PermissionAvailability =
  | { readonly kind: 'root' }
  | { readonly kind: 'tenant' }
  | { readonly kind: 'module'; readonly moduleId: string };

export type PermissionLifecycle = 'active' | 'deprecated';

export type PermissionDefinition = Readonly<{
  key: string;
  description: string;
  resourceType: string;
  availability: PermissionAvailability;
  systemAdminGrant?: boolean;
  lifecycle?: PermissionLifecycle;
}>;

export type ModulePermissionCatalogContribution = Readonly<{
  moduleId: string;
  permissionIds: readonly string[];
}>;

const tenantPermission = <const TKey extends string>(
  key: TKey,
  description: string
): PermissionDefinition & { readonly key: TKey } => ({
  key,
  description,
  resourceType: key.split('.')[0] ?? key,
  availability: { kind: 'tenant' },
});

export const corePermissionCatalog = [
  tenantPermission('iam.user.read', 'Read account data'),
  tenantPermission('iam.user.write', 'Modify account data'),
  tenantPermission('iam.role.read', 'Read role assignments'),
  tenantPermission('iam.role.write', 'Modify role assignments'),
  tenantPermission('iam.org.read', 'Read organization data'),
  tenantPermission('iam.org.write', 'Modify organization data'),
  tenantPermission('iam.legalText.read', 'Read legal text administration data'),
  tenantPermission('iam.legalText.write', 'Modify legal text administration data'),
  tenantPermission('iam.governance.read', 'Read governance workflows and audit trails'),
  tenantPermission('iam.governance.write', 'Execute governance workflows and decisions'),
  tenantPermission('iam.governance.export', 'Export governance and legal consent evidence'),
  tenantPermission('iam.dsr.read', 'Read tenant data-subject-rights cases'),
  tenantPermission('iam.dsr.write', 'Process tenant data-subject-rights cases'),
  tenantPermission('iam.dsr.export', 'Export tenant data-subject-rights payloads'),
  tenantPermission('iam.deletionRules.read', 'Read tenant deletion rules'),
  tenantPermission('iam.deletionRules.write', 'Modify tenant deletion rules'),
  tenantPermission('iam.monitoring.read', 'Read IAM monitoring and plugin operation status'),
  tenantPermission('iam.monitoring.write', 'Run IAM monitoring and plugin operations'),
  tenantPermission('iam.accounts.delete', 'Delete tenant accounts physically'),
  tenantPermission('experimental.read', 'Enable experimental shell features and placeholders'),
  tenantPermission('app.read', 'Show the app link in the sidebar'),
  tenantPermission('cockpit.read', 'Show the cockpit link in the sidebar'),
  tenantPermission('content.read', 'Read content'),
  tenantPermission('content.create', 'Create content'),
  tenantPermission('content.updateMetadata', 'Update content metadata'),
  tenantPermission('content.updatePayload', 'Update content payload'),
  tenantPermission('content.changeStatus', 'Change content status'),
  tenantPermission('content.publish', 'Publish content'),
  tenantPermission('content.archive', 'Archive content'),
  tenantPermission('content.restore', 'Restore content'),
  tenantPermission('content.readHistory', 'Read content history'),
  tenantPermission('content.manageRevisions', 'Manage content revisions'),
  tenantPermission('content.delete', 'Delete content'),
  tenantPermission('integration.manage', 'Manage integrations'),
  tenantPermission('feature.toggle', 'Toggle feature flags'),
  {
    key: 'instance.registry.manage',
    description: 'Manage instance registry and provisioning',
    resourceType: 'instance',
    availability: { kind: 'root' },
    systemAdminGrant: false,
    lifecycle: 'active',
  },
] as const satisfies readonly PermissionDefinition[];

export type CorePermissionKey = (typeof corePermissionCatalog)[number]['key'];

export const resolvesSystemAdminGrant = (definition: PermissionDefinition): boolean => {
  if (definition.availability.kind === 'root') {
    return false;
  }
  return definition.systemAdminGrant ?? true;
};

const assertNonBlank = (value: string, field: string, key: string): void => {
  if (value.trim().length === 0) {
    throw new Error(`invalid_permission_catalog_${field}:${key}`);
  }
};

export const validatePermissionCatalog = (
  definitions: readonly PermissionDefinition[]
): readonly PermissionDefinition[] => {
  const keys = new Set<string>();
  for (const definition of definitions) {
    assertNonBlank(definition.key, 'key', definition.key);
    assertNonBlank(definition.description, 'description', definition.key);
    assertNonBlank(definition.resourceType, 'resource_type', definition.key);
    if (keys.has(definition.key)) {
      throw new Error(`duplicate_permission_catalog_key:${definition.key}`);
    }
    keys.add(definition.key);
    if (definition.availability.kind === 'root' && definition.systemAdminGrant === true) {
      throw new Error(`root_permission_system_admin_grant:${definition.key}`);
    }
    if (definition.availability.kind === 'module') {
      assertNonBlank(definition.availability.moduleId, 'module_id', definition.key);
      if (!definition.key.startsWith(`${definition.availability.moduleId}.`)) {
        throw new Error(`module_permission_namespace_mismatch:${definition.key}`);
      }
    }
  }
  return definitions;
};

export const composePermissionCatalog = (
  coreDefinitions: readonly PermissionDefinition[],
  moduleContributions: readonly ModulePermissionCatalogContribution[]
): readonly PermissionDefinition[] =>
  validatePermissionCatalog([
    ...coreDefinitions,
    ...moduleContributions.flatMap((contribution) =>
      contribution.permissionIds.map((key): PermissionDefinition => ({
        key,
        description: `Module permission ${key}`,
        resourceType: key.split('.')[0] ?? key,
        availability: { kind: 'module', moduleId: contribution.moduleId },
      }))
    ),
  ]);

export const tenantCorePermissionCatalog = validatePermissionCatalog(corePermissionCatalog).filter(
  (definition) => definition.availability.kind === 'tenant' && definition.lifecycle !== 'deprecated'
);

export const tenantCoreSystemAdminPermissionKeys: readonly CorePermissionKey[] = tenantCorePermissionCatalog
  .filter(resolvesSystemAdminGrant)
  .map((definition) => definition.key as CorePermissionKey);

export const rootPermissionCatalog = corePermissionCatalog.filter(
  (definition) => definition.availability.kind === 'root' && definition.lifecycle !== 'deprecated'
);
