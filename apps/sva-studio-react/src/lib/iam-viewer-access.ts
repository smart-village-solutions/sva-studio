import { isIamAdminEnabled } from './iam-admin-access';

type UserWithRoles = {
  roles?: readonly string[] | null;
  instanceId?: string | null;
  permissionActions?: readonly string[] | null;
};

export type IamCockpitTabKey = 'rights' | 'governance' | 'dsr' | 'deletion-rules';

const RIGHTS_PERMISSIONS = new Set(['iam.user.read', 'iam.role.read', 'iam.org.read']);
const GOVERNANCE_PERMISSIONS = new Set(['iam.governance.read']);
const DSR_PERMISSIONS = new Set(['iam.dsr.read']);
const DELETION_RULES_PERMISSIONS = new Set(['iam.deletionRules.read']);
const GOVERNANCE_EXPORT_PERMISSIONS = new Set(['iam.governance.export']);

const readFlag = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const hasAnyPermission = (user: UserWithRoles | null | undefined, allowedPermissions: ReadonlySet<string>) =>
  Boolean(user?.permissionActions?.some((action) => allowedPermissions.has(action)));

export const isIamCockpitEnabled = () =>
  isIamAdminEnabled() || readFlag(import.meta.env.VITE_ENABLE_IAM_ADMIN_VIEWER, import.meta.env.DEV);

export const getAllowedIamCockpitTabs = (user: UserWithRoles | null | undefined): readonly IamCockpitTabKey[] => {
  const tabs: IamCockpitTabKey[] = [];
  if (hasAnyPermission(user, RIGHTS_PERMISSIONS)) {
    tabs.push('rights');
  }
  if (hasAnyPermission(user, GOVERNANCE_PERMISSIONS)) {
    tabs.push('governance');
  }
  if (hasAnyPermission(user, DSR_PERMISSIONS)) {
    tabs.push('dsr');
  }
  if (user?.instanceId && hasAnyPermission(user, DELETION_RULES_PERMISSIONS)) {
    tabs.push('deletion-rules');
  }
  return tabs;
};

export const hasIamCockpitAccessRole = (user: UserWithRoles | null | undefined) =>
  getAllowedIamCockpitTabs(user).length > 0;

export const hasGovernanceComplianceExportRole = (user: UserWithRoles | null | undefined) =>
  hasAnyPermission(user, GOVERNANCE_EXPORT_PERMISSIONS);

// Compatibility wrappers for existing imports/tests while the old names are still imported.
export const isIamViewerEnabled = isIamCockpitEnabled;
export const hasIamViewerAdminRole = hasIamCockpitAccessRole;
