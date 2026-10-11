import { useRoles } from '../../../hooks/use-roles';
import { t } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/translate';

export type PermissionAccessScope = 'all' | 'own' | 'organization';

export const ASSIGNABLE_PERMISSION_ACCESS_SCOPES: readonly PermissionAccessScope[] = [
  'all',
  'own',
  'organization',
];

export const ROLE_PERMISSION_ACTION_LABELS = {
  read: 'admin.roles.permissionActions.read',
  create: 'admin.roles.permissionActions.create',
  write: 'admin.roles.permissionActions.write',
  update: 'admin.roles.permissionActions.update',
  updatemetadata: 'admin.roles.permissionActions.updateMetadata',
  updatepayload: 'admin.roles.permissionActions.updatePayload',
  changestatus: 'admin.roles.permissionActions.changeStatus',
  publish: 'admin.roles.permissionActions.publish',
  archive: 'admin.roles.permissionActions.archive',
  restore: 'admin.roles.permissionActions.restore',
  readhistory: 'admin.roles.permissionActions.readHistory',
  managerevisions: 'admin.roles.permissionActions.manageRevisions',
  delete: 'admin.roles.permissionActions.delete',
  configure: 'admin.roles.permissionActions.configure',
  export: 'admin.roles.permissionActions.export',
  manage: 'admin.roles.permissionActions.manage',
  execute: 'admin.roles.permissionActions.execute',
  moderate: 'admin.roles.permissionActions.moderate',
  pushnotification: 'admin.roles.permissionActions.pushNotification',
  transferownership: 'admin.roles.permissionActions.transferOwnership',
  toggle: 'admin.roles.permissionActions.toggle',
  deliver: 'admin.roles.permissionActions.deliver',
} as const;

export const ROLE_PERMISSION_DESCRIPTION_LABELS: Readonly<Record<string, TranslationKey>> = {
  'iam.user.read': 'admin.roles.permissionDescriptions.iamUserRead',
  'iam.user.write': 'admin.roles.permissionDescriptions.iamUserWrite',
  'iam.invitationTemplate.manage': 'admin.roles.permissionDescriptions.iamInvitationTemplateManage',
  'iam.role.read': 'admin.roles.permissionDescriptions.iamRoleRead',
  'iam.role.write': 'admin.roles.permissionDescriptions.iamRoleWrite',
  'iam.org.read': 'admin.roles.permissionDescriptions.iamOrgRead',
  'iam.org.write': 'admin.roles.permissionDescriptions.iamOrgWrite',
  'iam.legalText.read': 'admin.roles.permissionDescriptions.iamLegalTextRead',
  'iam.legalText.write': 'admin.roles.permissionDescriptions.iamLegalTextWrite',
  'iam.governance.read': 'admin.roles.permissionDescriptions.iamGovernanceRead',
  'iam.governance.write': 'admin.roles.permissionDescriptions.iamGovernanceWrite',
  'iam.governance.export': 'admin.roles.permissionDescriptions.iamGovernanceExport',
  'iam.dsr.read': 'admin.roles.permissionDescriptions.iamDsrRead',
  'iam.dsr.write': 'admin.roles.permissionDescriptions.iamDsrWrite',
  'iam.dsr.export': 'admin.roles.permissionDescriptions.iamDsrExport',
  'iam.deletionRules.read': 'admin.roles.permissionDescriptions.iamDeletionRulesRead',
  'iam.deletionRules.write': 'admin.roles.permissionDescriptions.iamDeletionRulesWrite',
  'iam.monitoring.read': 'admin.roles.permissionDescriptions.iamMonitoringRead',
  'iam.monitoring.write': 'admin.roles.permissionDescriptions.iamMonitoringWrite',
  'iam.accounts.delete': 'admin.roles.permissionDescriptions.iamAccountsDelete',
  'experimental.read': 'admin.roles.permissionDescriptions.experimentalRead',
  'app.read': 'admin.roles.permissionDescriptions.appRead',
  'cockpit.read': 'admin.roles.permissionDescriptions.cockpitRead',
  'modules.read': 'admin.roles.permissionDescriptions.modulesRead',
  'content.read': 'admin.roles.permissionDescriptions.contentRead',
  'content.create': 'admin.roles.permissionDescriptions.contentCreate',
  'content.updateMetadata': 'admin.roles.permissionDescriptions.contentUpdateMetadata',
  'content.updatePayload': 'admin.roles.permissionDescriptions.contentUpdatePayload',
  'content.transferOwnership': 'admin.roles.permissionDescriptions.contentTransferOwnership',
  'content.publish': 'admin.roles.permissionDescriptions.contentPublish',
  'content.changeStatus': 'admin.roles.permissionDescriptions.contentChangeStatus',
  'content.archive': 'admin.roles.permissionDescriptions.contentArchive',
  'content.restore': 'admin.roles.permissionDescriptions.contentRestore',
  'content.readHistory': 'admin.roles.permissionDescriptions.contentReadHistory',
  'content.manageRevisions': 'admin.roles.permissionDescriptions.contentManageRevisions',
  'content.delete': 'admin.roles.permissionDescriptions.contentDelete',
  'integration.manage': 'admin.roles.permissionDescriptions.integrationManage',
  'feature.toggle': 'admin.roles.permissionDescriptions.featureToggle',
  'instance.registry.manage': 'admin.roles.permissionDescriptions.instanceRegistryManage',
  'media.read': 'admin.roles.permissionDescriptions.mediaRead',
  'media.create': 'admin.roles.permissionDescriptions.mediaCreate',
  'media.update': 'admin.roles.permissionDescriptions.mediaUpdate',
  'media.reference.manage': 'admin.roles.permissionDescriptions.mediaReferenceManage',
  'media.delete': 'admin.roles.permissionDescriptions.mediaDelete',
  'media.deliver.protected': 'admin.roles.permissionDescriptions.mediaDeliverProtected',
  'news.pushNotification': 'admin.roles.permissionDescriptions.newsPushNotification',
  'surveys.moderate': 'admin.roles.permissionDescriptions.surveysModerate',
  'surveys.export': 'admin.roles.permissionDescriptions.surveysExport',
  'ssf.configuration.tenant.read': 'admin.roles.permissionDescriptions.ssfTenantRead',
  'ssf.configuration.tenant.manage': 'admin.roles.permissionDescriptions.ssfTenantManage',
  'waste-management.read': 'admin.roles.permissionDescriptions.wasteRead',
  'waste-management.master-data.manage': 'admin.roles.permissionDescriptions.wasteMasterDataManage',
  'waste-management.tours.manage': 'admin.roles.permissionDescriptions.wasteToursManage',
  'waste-management.scheduling.manage': 'admin.roles.permissionDescriptions.wasteSchedulingManage',
  'waste-management.import.execute': 'admin.roles.permissionDescriptions.wasteImportExecute',
  'waste-management.export.execute': 'admin.roles.permissionDescriptions.wasteExportExecute',
  'waste-management.seed.execute': 'admin.roles.permissionDescriptions.wasteSeedExecute',
  'waste-management.reset.execute': 'admin.roles.permissionDescriptions.wasteResetExecute',
  'waste-management.settings.manage': 'admin.roles.permissionDescriptions.wasteSettingsManage',
};

const STANDARD_PERMISSION_SUBJECT_LABELS: Readonly<Record<string, TranslationKey>> = {
  categories: 'admin.roles.permissionSubjects.categories',
  news: 'admin.roles.permissionSubjects.news',
  events: 'admin.roles.permissionSubjects.events',
  poi: 'admin.roles.permissionSubjects.poi',
  'generic-items': 'admin.roles.permissionSubjects.genericItems',
  faq: 'admin.roles.permissionSubjects.faq',
  'cockpit-cards': 'admin.roles.permissionSubjects.cockpitCards',
  projects: 'admin.roles.permissionSubjects.projects',
  surveys: 'admin.roles.permissionSubjects.surveys',
};

const STANDARD_PERMISSION_ACTION_DESCRIPTION_LABELS: Readonly<Record<string, TranslationKey>> = {
  read: 'admin.roles.permissionDescriptions.standardRead',
  create: 'admin.roles.permissionDescriptions.standardCreate',
  update: 'admin.roles.permissionDescriptions.standardUpdate',
  delete: 'admin.roles.permissionDescriptions.standardDelete',
};

export const describeRolePermission = (permissionKey: string, fallback?: string | null): string => {
  const descriptionKey = ROLE_PERMISSION_DESCRIPTION_LABELS[permissionKey];
  if (descriptionKey) return t(descriptionKey);

  const [subject, action, extra] = permissionKey.split('.');
  const subjectKey = subject && STANDARD_PERMISSION_SUBJECT_LABELS[subject];
  const actionKey = action && STANDARD_PERMISSION_ACTION_DESCRIPTION_LABELS[action];
  if (subjectKey && actionKey && !extra) {
    return t(actionKey, { subject: t(subjectKey) });
  }

  return fallback?.trim() || t('admin.roles.detail.permissions.permissionDescriptionFallback');
};

export const ROLE_PERMISSION_SCOPE_LABELS: Record<PermissionAccessScope, TranslationKey> = {
  all: 'admin.roles.permissionScopes.all',
  own: 'admin.roles.permissionScopes.own',
  organization: 'admin.roles.permissionScopes.organization',
};

export const ROLE_PERMISSION_RESOURCE_LABELS = {
  content: 'admin.roles.permissionResources.content',
  iam: 'admin.roles.permissionResources.iam',
  users: 'admin.roles.permissionResources.users',
  user: 'admin.roles.permissionResources.users',
  roles: 'admin.roles.permissionResources.roles',
  role: 'admin.roles.permissionResources.roles',
  groups: 'admin.roles.permissionResources.groups',
  group: 'admin.roles.permissionResources.groups',
  organizations: 'admin.roles.permissionResources.organizations',
  organization: 'admin.roles.permissionResources.organizations',
  legal: 'admin.roles.permissionResources.legal',
  app: 'admin.roles.permissionResources.app',
  cockpit: 'admin.roles.permissionResources.cockpit',
  interfaces: 'admin.roles.permissionResources.interfaces',
  media: 'admin.roles.permissionResources.media',
  news: 'admin.roles.permissionResources.news',
  events: 'admin.roles.permissionResources.events',
  poi: 'admin.roles.permissionResources.poi',
  'waste-management': 'admin.roles.permissionResources.wasteManagement',
  categories: 'admin.roles.permissionResources.categories',
  'generic-items': 'admin.roles.permissionResources.genericItems',
  faq: 'admin.roles.permissionResources.faq',
  'cockpit-cards': 'admin.roles.permissionResources.cockpitCards',
  projects: 'admin.roles.permissionResources.projects',
  surveys: 'admin.roles.permissionResources.surveys',
  ssf: 'admin.roles.permissionResources.ssf',
  modules: 'admin.roles.permissionResources.modules',
  experimental: 'admin.roles.permissionResources.experimental',
} as const;

export const humanizePermissionSegment = (value: string): string =>
  value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export const mapPermissionActionLabel = (action: string): string => {
  const normalizedAction = action.toLowerCase() as keyof typeof ROLE_PERMISSION_ACTION_LABELS;
  return normalizedAction in ROLE_PERMISSION_ACTION_LABELS
    ? t(ROLE_PERMISSION_ACTION_LABELS[normalizedAction])
    : humanizePermissionSegment(action);
};

export const mapPermissionResourceLabel = (resource: string): string => {
  const normalizedResource = resource.toLowerCase() as keyof typeof ROLE_PERMISSION_RESOURCE_LABELS;
  return normalizedResource in ROLE_PERMISSION_RESOURCE_LABELS
    ? t(ROLE_PERMISSION_RESOURCE_LABELS[normalizedResource])
    : humanizePermissionSegment(resource);
};

export const summarizePermission = (permissionKey: string) => {
  const segments = permissionKey.split('.');
  const resourceSegment = segments[0] ?? permissionKey;
  const actionSegment =
    permissionKey === 'media.deliver.protected' ? 'deliver' : (segments.at(-1) ?? 'access');
  return {
    resourceLabel: mapPermissionResourceLabel(resourceSegment),
    actionLabel: mapPermissionActionLabel(actionSegment),
    detailLabel: `${mapPermissionActionLabel(actionSegment)} ${mapPermissionResourceLabel(resourceSegment)}`,
  };
};

export type RolePermissionTableRow = Readonly<{
  id: string;
  permissionKey: string;
  description: string;
  resourceLabel: string;
  actionLabel: string;
  detailLabel: string;
  isAssigned: boolean;
  isScopeAssignable: boolean;
  supportedAccessScopes: readonly PermissionAccessScope[];
  accessScope: PermissionAccessScope;
}>;

export const normalizePermissionSearch = (value: string) => value.trim().toLowerCase();

export const sortPermissionIdsByCatalog = (
  permissionIds: readonly string[],
  catalog: readonly { id: string; permissionKey: string }[]
) => {
  const permissionKeyById = new Map(
    catalog.map((permission) => [permission.id, permission.permissionKey] as const)
  );

  return [...permissionIds].sort((left, right) => {
    const leftKey = permissionKeyById.get(left) ?? left;
    const rightKey = permissionKeyById.get(right) ?? right;
    return leftKey.localeCompare(rightKey);
  });
};

export const sortPermissionAssignmentsByCatalog = (
  permissionIds: readonly string[],
  assignments: Readonly<Record<string, PermissionAccessScope>>,
  catalog: readonly {
    id: string;
    permissionKey: string;
    isScopeAssignable?: boolean;
    supportedAccessScopes?: readonly PermissionAccessScope[];
  }[]
) => {
  const permissionById = new Map(catalog.map((permission) => [permission.id, permission] as const));

  return sortPermissionIdsByCatalog(permissionIds, catalog).map((permissionId) => {
    const permission = permissionById.get(permissionId);
    const accessScope = normalizePermissionAccessScope(assignments[permissionId], permission);
    return permission?.isScopeAssignable ? { permissionId, accessScope } : { permissionId };
  });
};

export const normalizeSupportedAccessScopes = (
  scopes: readonly PermissionAccessScope[] | undefined
): readonly PermissionAccessScope[] => {
  const normalized = (scopes ?? []).filter((scope, index, values) => {
    return ASSIGNABLE_PERMISSION_ACCESS_SCOPES.includes(scope) && values.indexOf(scope) === index;
  });

  return normalized.length > 0 ? normalized : ['all'];
};

export const normalizePermissionAccessScope = (
  accessScope: PermissionAccessScope | undefined,
  permission:
    | {
        isScopeAssignable?: boolean;
        supportedAccessScopes?: readonly PermissionAccessScope[];
      }
    | undefined
): PermissionAccessScope => {
  if (!permission?.isScopeAssignable) {
    return 'all';
  }

  const supportedAccessScopes = normalizeSupportedAccessScopes(permission.supportedAccessScopes);
  return accessScope && supportedAccessScopes.includes(accessScope) ? accessScope : 'all';
};

export const buildPermissionScopeDraft = (
  role: NonNullable<ReturnType<typeof useRoles>['roles'][number]>,
  catalog: readonly {
    id: string;
    permissionKey: string;
    isScopeAssignable?: boolean;
    supportedAccessScopes?: readonly PermissionAccessScope[];
  }[]
): Record<string, PermissionAccessScope> => {
  const byAssignment = Object.fromEntries(
    (role.permissionAssignments ?? []).map(
      (assignment) => [assignment.permissionId, assignment.accessScope] as const
    )
  ) as Record<string, PermissionAccessScope>;
  const permissionById = new Map(catalog.map((permission) => [permission.id, permission] as const));

  return role.permissions.reduce<Record<string, PermissionAccessScope>>(
    (acc, permission) => {
      acc[permission.id] = normalizePermissionAccessScope(
        byAssignment[permission.id] ?? permission.accessScope ?? 'all',
        {
          isScopeAssignable:
            permission.isScopeAssignable ?? permissionById.get(permission.id)?.isScopeAssignable,
          supportedAccessScopes:
            permission.supportedAccessScopes ??
            permissionById.get(permission.id)?.supportedAccessScopes,
        }
      );
      return acc;
    },
    { ...Object.fromEntries(catalog.map((permission) => [permission.id, 'all'] as const)) }
  );
};
