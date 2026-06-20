import { fileURLToPath } from 'node:url';

import type { Page } from '@playwright/test';

import {
  ROOT_AUTH_SESSION_FILE,
  getRootPlaywrightBaseUrl,
  loadPlaywrightEnv,
  resolveAuthSessionFile,
  unauthenticatedStorageState,
} from '../src/lib/playwright-auth-session-config';
import { gotoHomeAsAuthenticatedUser as gotoShellHomeAsAuthenticatedUser, navigateClientSide, registerSharedIamRoutes } from './studio-shell.helpers';

export {
  ROOT_AUTH_SESSION_FILE,
  getRootPlaywrightBaseUrl,
  loadPlaywrightEnv,
  resolveAuthSessionFile,
  unauthenticatedStorageState,
  navigateClientSide,
};

export const appRoot = fileURLToPath(new URL('../', import.meta.url));

export const adminAuthPayload = {
  user: {
    id: 'kc-admin-1',
    name: 'Admin One',
    email: 'admin@example.com',
    instanceId: '11111111-1111-1111-8111-111111111111',
    roles: ['system_admin'],
    permissionActions: ['iam.user.read', 'iam.user.write', 'iam.role.read', 'iam.role.write', 'iam.org.read', 'iam.org.write', 'integration.manage', 'app.read', 'cockpit.read'],
  },
};

type AccountAdminAuthPayload = {
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
    permissionActions: string[];
    instanceId?: string;
  };
};

export const platformAuthPayload = {
  user: {
    id: 'kc-root-1',
    name: 'Root Admin',
    email: 'root@example.com',
    roles: ['instance_registry_admin'],
    permissionActions: [],
  },
};

export const privacyOverviewPayload = {
  data: {
    accountId: 'account-1',
    activityItems: [
      { id: 'request-1', source: 'dsr', type: 'request', canonicalStatus: 'queued', rawStatus: 'accepted', title: 'Auskunftsanfrage', summary: 'Ihre Anfrage wird vorbereitet.', createdAt: '2026-03-10T09:00:00.000Z' },
      { id: 'export-1', source: 'dsr', type: 'export_job', canonicalStatus: 'completed', rawStatus: 'completed', title: 'JSON-Export', summary: 'Der Export wurde erfolgreich erstellt.', createdAt: '2026-03-09T08:00:00.000Z', completedAt: '2026-03-09T08:05:00.000Z', format: 'json' },
    ],
    exportJobs: [{ id: 'export-1', type: 'export_job', canonicalStatus: 'completed', rawStatus: 'completed', title: 'JSON-Export', summary: 'Der Export wurde erfolgreich erstellt.', createdAt: '2026-03-09T08:00:00.000Z', completedAt: '2026-03-09T08:05:00.000Z', format: 'json' }],
    instanceId: 'de-musterhausen',
    legalHolds: [],
    nonEssentialProcessingAllowed: false,
    nonEssentialProcessingOptOutAt: '2026-03-07T06:00:00.000Z',
    processingRestrictedAt: '2026-03-08T07:00:00.000Z',
    processingRestrictionReason: 'pending_verification',
    requests: [{ id: 'request-1', type: 'request', canonicalStatus: 'queued', rawStatus: 'accepted', title: 'Auskunftsanfrage', summary: 'Ihre Anfrage wird vorbereitet.', createdAt: '2026-03-10T09:00:00.000Z' }],
  },
};

export const privacyDetailPayload = {
  data: {
    id: 'request-1',
    source: 'dsr',
    type: 'request',
    canonicalStatus: 'queued',
    rawStatus: 'accepted',
    title: 'Auskunftsanfrage',
    summary: 'Ihre Anfrage wird vorbereitet.',
    createdAt: '2026-03-10T09:00:00.000Z',
    metadata: { origin: 'self_service' },
  },
};

export const deletionRulesPayload = {
  instanceId: 'de-musterhausen',
  lastLoginAt: '2026-03-20T10:00:00.000Z',
  lifecycleState: 'active',
  rules: { instanceId: 'de-musterhausen', deactivateAfterDays: 90, pseudonymizeAfterDays: 180, deleteAfterDays: 365, defaultContentStrategy: 'retain', allowContentPreferenceOverride: true, canEdit: false },
  contentPreference: { isOverridden: false, effectiveStrategy: 'retain' },
};

export const gotoHomeAsAuthenticatedUser = async (page: Page, expectedUserName = 'Admin One') => {
  await gotoShellHomeAsAuthenticatedUser(page, expectedUserName);
};

export const registerSharedAccountAdminRoutes = async (page: Page) => {
  await registerSharedIamRoutes(page);
};

export const registerAccountAdminAuthRoute = async (page: Page, payload: AccountAdminAuthPayload = adminAuthPayload) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
};

export const registerPlatformAccountAdminAuthRoute = async (page: Page) => {
  await registerAccountAdminAuthRoute(page, platformAuthPayload);
};

export const registerInstanceListRoutes = async (page: Page, instances: readonly unknown[]) => {
  const fulfillInstanceList: Parameters<Page['route']>[1] = async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: instances, pagination: { page: 1, pageSize: instances.length, total: instances.length } }),
    });
  };
  await page.route('**/api/v1/iam/instances', fulfillInstanceList);
  await page.route('**/api/v1/iam/instances?**', fulfillInstanceList);
};

export const configureRootAccountAdminTest = (
  testApi: Pick<typeof import('@playwright/test').test, 'beforeEach' | 'use'>,
  options: { mockAdminAuth?: boolean } = {},
) => {
  loadPlaywrightEnv(appRoot);
  testApi.use({
    baseURL: getRootPlaywrightBaseUrl(process.env),
    storageState: resolveAuthSessionFile(appRoot, ROOT_AUTH_SESSION_FILE),
  });
  testApi.beforeEach(async ({ page }) => {
    await registerSharedAccountAdminRoutes(page);
    if (options.mockAdminAuth) {
      await registerAccountAdminAuthRoute(page);
    }
  });
};
