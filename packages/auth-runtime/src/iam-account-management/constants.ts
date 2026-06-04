export const ADMIN_ROLES = new Set(['system_admin', 'app_manager']);
export const SYSTEM_ADMIN_ROLES = new Set(['system_admin']);
export const PLATFORM_ROOT_ROLE = 'instance_registry_admin';
export const ROOT_ADMIN_ROLES = new Set([PLATFORM_ROOT_ROLE]);
export const PLATFORM_PROFILE_ROLES = new Set([PLATFORM_ROOT_ROLE]);
export const PLATFORM_ROLE_LEVEL_BY_NAME: Readonly<Record<string, number>> = {
  [PLATFORM_ROOT_ROLE]: 90,
};
export const PLATFORM_RATE_LIMIT_INSTANCE_ID = '__platform__';

export const READ_RATE_LIMIT = 60;
export const WRITE_RATE_LIMIT = 10;
export const BULK_RATE_LIMIT = 3;
export const RATE_WINDOW_MS = 60_000;
