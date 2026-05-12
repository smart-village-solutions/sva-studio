import { getRuntimeProfileFromEnv, isMockAuthRuntimeProfile } from '@sva/core';

import { readCookieFromRequest } from './cookies.js';
import type { SessionUser } from './types.js';

const DEFAULT_MOCK_AUTH_ROLES = [
  'system_admin',
  'iam_admin',
  'support_admin',
  'security_admin',
  'instance_registry_admin',
  'interface_manager',
  'app_manager',
  'editor',
] as const;

export const DEV_AUTH_COOKIE_NAME = 'sva_dev_auth';

const splitRoles = (value: string | undefined) =>
  value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is string => entry.length > 0) ?? [];

const isExplicitDevAuthOptIn = (): boolean =>
  process.env.SVA_DEV_AUTH === 'true' || process.env.SVA_MOCK_AUTH === 'true';

export const isMockAuthEnabled = () => {
  const runtimeProfile = getRuntimeProfileFromEnv(process.env);
  const runtimeProfileAllowsMockAuth = runtimeProfile !== null && isMockAuthRuntimeProfile(runtimeProfile);
  const mockAuthOptIn = isExplicitDevAuthOptIn();

  if (process.env.NODE_ENV === 'production') {
    return mockAuthOptIn && runtimeProfileAllowsMockAuth;
  }

  return mockAuthOptIn || runtimeProfileAllowsMockAuth;
};

export const hasActiveMockAuthSession = (request: Request): boolean =>
  readCookieFromRequest(request, DEV_AUTH_COOKIE_NAME) === '1';

export const createMockSessionUser = (): SessionUser => {
  const configuredRoles = splitRoles(process.env.SVA_MOCK_AUTH_ROLES);

  return {
    id: process.env.SVA_MOCK_AUTH_USER_ID ?? 'dev:local-admin',
    instanceId: process.env.SVA_MOCK_AUTH_INSTANCE_ID ?? 'de-musterhausen',
    roles: configuredRoles.length > 0 ? configuredRoles : [...DEFAULT_MOCK_AUTH_ROLES],
  };
};
