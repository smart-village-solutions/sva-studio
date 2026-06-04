type UserWithRoles = {
  roles?: readonly string[];
  permissionActions?: readonly string[];
};

const INTERFACES_PERMISSION = 'integration.manage';
const IAM_ADMIN_PERMISSIONS = new Set([
  'iam.user.read',
  'iam.user.write',
  'iam.role.read',
  'iam.role.write',
  'iam.org.read',
  'iam.org.write',
]);
const SYSTEM_ADMIN_ROLES = new Set(['system_admin']);
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

export const hasIamAdminRole = (user: UserWithRoles | null | undefined) =>
  Boolean(user?.permissionActions?.some((action) => IAM_ADMIN_PERMISSIONS.has(action)));

export const hasInterfacesAccessRole = (user: UserWithRoles | null | undefined) =>
  user?.permissionActions?.includes(INTERFACES_PERMISSION) === true;

export const hasSystemAdminRole = (user: UserWithRoles | null | undefined) =>
  Boolean(user?.roles?.some((role) => SYSTEM_ADMIN_ROLES.has(role)));

export const hasInstanceRegistryAdminRole = (user: UserWithRoles | null | undefined) =>
  Boolean(user?.roles?.some((role) => ROOT_ADMIN_ROLES.has(role)));
