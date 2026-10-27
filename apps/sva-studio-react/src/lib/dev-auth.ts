import type { RouteGuardUser } from '@sva/routing';
import { isMockAuthRuntimeProfile, parseRuntimeProfile } from '@sva/core';

export const DEV_AUTH_LOGIN_ENDPOINT = '/auth/dev-login';
export const DEV_AUTH_LOGOUT_ENDPOINT = '/auth/dev-logout';
const DEV_AUTH_COOKIE_NAME = 'sva_dev_auth';

const readCookieValue = (cookieHeader: string, name: string): string | null => {
  const cookieName = `${encodeURIComponent(name)}=`;

  for (const rawPart of cookieHeader.split(';')) {
    const part = rawPart.trim();
    if (!part.startsWith(cookieName)) {
      continue;
    }

    return decodeURIComponent(part.slice(cookieName.length));
  }

  return null;
};

export const isDevAuthAvailable = (): boolean => {
  const runtimeProfile = parseRuntimeProfile(import.meta.env.VITE_SVA_RUNTIME_PROFILE);

  return (
    import.meta.env.VITE_SVA_DEV_AUTH === true ||
    import.meta.env.VITE_SVA_DEV_AUTH === 'true' ||
    import.meta.env.VITE_MOCK_AUTH === true ||
    import.meta.env.VITE_MOCK_AUTH === 'true' ||
    (runtimeProfile !== null && isMockAuthRuntimeProfile(runtimeProfile))
  );
};

export const hasActiveDevAuthSessionCookie = (cookieHeader: string | null | undefined): boolean =>
  typeof cookieHeader === 'string' && readCookieValue(cookieHeader, DEV_AUTH_COOKIE_NAME) === '1';

export const hasActiveDevAuthSession = (): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }

  return hasActiveDevAuthSessionCookie(document.cookie);
};

export const createMockRouteGuardUser = (): RouteGuardUser => ({
  instanceId: 'de-musterhausen',
  assignedModules: [
    'categories',
    'cockpit-cards',
    'events',
    'media',
    'news',
    'poi',
    'waste-management',
  ],
  roles: ['system_admin'],
  permissionActions: [
    'iam.user.read',
    'iam.user.write',
    'iam.invitationTemplate.manage',
    'iam.role.read',
    'iam.role.write',
    'iam.org.read',
    'iam.org.write',
    'iam.legalText.read',
    'iam.legalText.write',
    'iam.governance.read',
    'iam.governance.write',
    'iam.governance.export',
    'iam.dsr.read',
    'iam.dsr.write',
    'iam.dsr.export',
    'iam.deletionRules.read',
    'iam.deletionRules.write',
    'iam.monitoring.read',
    'iam.monitoring.write',
    'experimental.read',
    'app.read',
    'cockpit.read',
    'content.read',
    'content.create',
    'content.updateMetadata',
    'content.updatePayload',
    'content.changeStatus',
    'content.publish',
    'content.archive',
    'content.restore',
    'content.readHistory',
    'content.manageRevisions',
    'content.delete',
    'media.read',
    'media.create',
    'media.update',
    'media.reference.manage',
    'media.delete',
    'media.deliver.protected',
    'categories.read',
    'categories.create',
    'categories.update',
    'categories.delete',
    'cockpit-cards.read',
    'cockpit-cards.create',
    'cockpit-cards.update',
    'cockpit-cards.delete',
    'news.read',
    'events.read',
    'poi.read',
    'waste-management.read',
    'waste-management.master-data.manage',
    'waste-management.tours.manage',
    'waste-management.scheduling.manage',
    'waste-management.import.execute',
    'waste-management.export.execute',
    'waste-management.seed.execute',
    'waste-management.reset.execute',
    'waste-management.settings.manage',
    'integration.manage',
    'feature.toggle',
  ],
});
