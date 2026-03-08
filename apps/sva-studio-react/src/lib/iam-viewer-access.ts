type UserWithRoles = {
  roles?: readonly string[] | null;
};

const ADMIN_ROLES = new Set(['admin', 'iam_admin', 'system_admin', 'support_admin']);

export const isIamViewerEnabled = () =>
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_IAM_ADMIN_VIEWER === 'true';

export const hasIamViewerAdminRole = (user: UserWithRoles | null | undefined) =>
  Boolean(user?.roles?.some((role) => ADMIN_ROLES.has(role)));
