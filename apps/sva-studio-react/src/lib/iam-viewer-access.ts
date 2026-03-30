import { isIamAdminEnabled } from './iam-admin-access';

type UserWithRoles = {
  roles?: readonly string[] | null;
};

export type IamCockpitTabKey = 'rights' | 'governance' | 'dsr';

const RIGHTS_ROLES = new Set(['iam_admin', 'support_admin', 'system_admin']);
const GOVERNANCE_ROLES = new Set(['iam_admin', 'support_admin', 'system_admin', 'security_admin', 'compliance_officer']);
const DSR_ROLES = new Set(['iam_admin', 'support_admin', 'system_admin']);
const LEGACY_ADMIN_ROLES = new Set(['admin']);

const readFlag = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const hasRole = (user: UserWithRoles | null | undefined, allowedRoles: ReadonlySet<string>) =>
  Boolean(user?.roles?.some((role) => allowedRoles.has(role) || LEGACY_ADMIN_ROLES.has(role)));

export const isIamCockpitEnabled = () =>
  isIamAdminEnabled() || readFlag(import.meta.env.VITE_ENABLE_IAM_ADMIN_VIEWER, import.meta.env.DEV);

export const getAllowedIamCockpitTabs = (user: UserWithRoles | null | undefined): readonly IamCockpitTabKey[] => {
  const tabs: IamCockpitTabKey[] = [];
  if (hasRole(user, RIGHTS_ROLES)) {
    tabs.push('rights');
  }
  if (hasRole(user, GOVERNANCE_ROLES)) {
    tabs.push('governance');
  }
  if (hasRole(user, DSR_ROLES)) {
    tabs.push('dsr');
  }
  return tabs;
};

export const hasIamCockpitAccessRole = (user: UserWithRoles | null | undefined) =>
  getAllowedIamCockpitTabs(user).length > 0;

// Compatibility wrappers for existing imports/tests, including the legacy `admin` role alias.
export const isIamViewerEnabled = isIamCockpitEnabled;
export const hasIamViewerAdminRole = hasIamCockpitAccessRole;
