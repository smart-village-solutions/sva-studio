import { hasSystemAdminRole as hasCoreSystemAdminRole } from '@sva/core';

type UserWithRoles = {
  roles?: readonly string[];
  permissionActions?: readonly string[];
};

const INTERFACES_PERMISSION = 'integration.manage';
const EXPERIMENTAL_PERMISSION = 'experimental.read';
const USER_ADMIN_PERMISSION = 'iam.user.read';
const ORGANIZATION_ADMIN_PERMISSION = 'iam.org.read';
const ROLE_ADMIN_PERMISSION = 'iam.role.read';
const LEGAL_TEXT_ADMIN_PERMISSION = 'iam.legalText.read';
const MONITORING_PERMISSION = 'iam.monitoring.read';
const IAM_GOVERNANCE_PERMISSIONS = new Set([
  'iam.user.read',
  'iam.governance.read',
  'iam.dsr.read',
  'iam.deletionRules.read',
]);
const ROOT_ADMIN_ROLES = new Set(['instance_registry_admin']);

const readFlag = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

export const isIamUiEnabled = () => readFlag(import.meta.env.VITE_IAM_UI_ENABLED, true);

export const isIamAdminEnabled = () => isIamUiEnabled() && readFlag(import.meta.env.VITE_IAM_ADMIN_ENABLED, true);

export const isIamBulkEnabled = () => isIamAdminEnabled() && readFlag(import.meta.env.VITE_IAM_BULK_ENABLED, true);

export const hasUserAdminAccess = (user: UserWithRoles | null | undefined) =>
  user?.permissionActions?.includes(USER_ADMIN_PERMISSION) === true;

export const hasOrganizationAdminAccess = (user: UserWithRoles | null | undefined) =>
  user?.permissionActions?.includes(ORGANIZATION_ADMIN_PERMISSION) === true;

export const hasRoleAdminAccess = (user: UserWithRoles | null | undefined) =>
  user?.permissionActions?.includes(ROLE_ADMIN_PERMISSION) === true;

export const hasLegalTextAdminAccess = (user: UserWithRoles | null | undefined) =>
  user?.permissionActions?.includes(LEGAL_TEXT_ADMIN_PERMISSION) === true;

export const hasIamGovernanceAccess = (user: UserWithRoles | null | undefined) =>
  Boolean(user?.permissionActions?.some((action) => IAM_GOVERNANCE_PERMISSIONS.has(action)));

export const hasInterfacesAccess = (user: UserWithRoles | null | undefined) =>
  user?.permissionActions?.includes(INTERFACES_PERMISSION) === true;

export const hasExperimentalAccess = (user: UserWithRoles | null | undefined) =>
  user?.permissionActions?.includes(EXPERIMENTAL_PERMISSION) === true;

export const hasMonitoringAccess = (user: UserWithRoles | null | undefined) =>
  user?.permissionActions?.includes(MONITORING_PERMISSION) === true;

export const hasSystemAdminRole = (user: UserWithRoles | null | undefined) => hasCoreSystemAdminRole(user?.roles);

export const hasPlatformInstanceAdminAccess = (user: UserWithRoles | null | undefined) =>
  Boolean(user?.roles?.some((role) => ROOT_ADMIN_ROLES.has(role)));
