type UserWithRoles = {
  roles?: readonly string[];
};

const ADMIN_ROLES = new Set(['system_admin', 'app_manager']);
const SYSTEM_ADMIN_ROLES = new Set(['system_admin']);

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
  Boolean(user?.roles.some((role) => ADMIN_ROLES.has(role)));

export const hasSystemAdminRole = (user: UserWithRoles | null | undefined) =>
  Boolean(user?.roles.some((role) => SYSTEM_ADMIN_ROLES.has(role)));
