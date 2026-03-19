import { getRuntimeProfileFromEnv, isMockAuthRuntimeProfile } from '@sva/sdk';

import type { SessionUser } from './types';

const DEFAULT_MOCK_AUTH_ROLES = [
  'system_admin',
  'iam_admin',
  'support_admin',
  'security_admin',
  'interface_manager',
  'app_manager',
  'editor',
] as const;

const splitRoles = (value: string | undefined) =>
  value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is string => entry.length > 0) ?? [];

export const isMockAuthEnabled = () => {
  const runtimeProfile = getRuntimeProfileFromEnv(process.env);

  return (
    process.env.SVA_MOCK_AUTH === 'true' ||
    process.env.VITE_MOCK_AUTH === 'true' ||
    (runtimeProfile !== null && isMockAuthRuntimeProfile(runtimeProfile))
  );
};

export const createMockSessionUser = (): SessionUser => {
  const configuredRoles = splitRoles(process.env.SVA_MOCK_AUTH_ROLES);

  return {
    id: process.env.SVA_MOCK_AUTH_USER_ID ?? 'seed:system_admin',
    name: process.env.SVA_MOCK_AUTH_USER_NAME ?? 'Mock User',
    email: process.env.SVA_MOCK_AUTH_USER_EMAIL ?? 'mock.user@sva.local',
    instanceId: process.env.SVA_MOCK_AUTH_INSTANCE_ID ?? 'de-musterhausen',
    roles: configuredRoles.length > 0 ? configuredRoles : [...DEFAULT_MOCK_AUTH_ROLES],
  };
};
