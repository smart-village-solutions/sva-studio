import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { unauthenticatedStorageState } from '../src/lib/playwright-auth-session-config';
import { gotoHomeAsAuthenticatedUser, gotoShellRoot, navigateClientSide, registerSharedIamRoutes } from './studio-shell.helpers';

export { gotoHomeAsAuthenticatedUser, gotoShellRoot, navigateClientSide, unauthenticatedStorageState };

export type EventRecord = { readonly id: string; title: string; readonly contentType: 'events.event-record'; readonly status: 'published'; readonly createdAt: string; updatedAt: string; description?: string; categoryName?: string; dates?: readonly { readonly dateStart?: string; readonly dateEnd?: string }[]; addresses?: readonly { readonly street?: string; readonly city?: string }[]; contact?: { readonly email?: string }; urls?: readonly { readonly url: string; readonly description?: string }[]; pointOfInterestId?: string; repeat?: boolean };
export type PoiRecord = { readonly id: string; name: string; readonly contentType: 'poi.point-of-interest'; readonly status: 'published'; readonly createdAt: string; updatedAt: string; description?: string; mobileDescription?: string; active?: boolean; categoryName?: string; addresses?: readonly { readonly street?: string; readonly city?: string }[]; contact?: { readonly email?: string }; openingHours?: readonly { readonly weekday?: string; readonly timeFrom?: string; readonly open?: boolean }[]; webUrls?: readonly { readonly url: string; readonly description?: string }[]; payload?: Record<string, unknown> };

export const createdAt = '2026-04-13T12:10:00.000Z';
export const authenticatedUser = { user: { id: 'kc-editor-1', name: 'Editor One', email: 'editor@example.com', instanceId: 'de-musterhausen', assignedModules: ['events', 'poi'], roles: ['editor'], permissionActions: ['events.read', 'events.create', 'events.update', 'events.delete', 'poi.read', 'poi.create', 'poi.update', 'poi.delete'] } };
export const permissionPayload = { instanceId: 'de-musterhausen', permissions: [{ action: 'events.read', resourceType: 'events' }, { action: 'events.create', resourceType: 'events' }, { action: 'events.update', resourceType: 'events' }, { action: 'events.delete', resourceType: 'events' }, { action: 'poi.read', resourceType: 'poi' }, { action: 'poi.create', resourceType: 'poi' }, { action: 'poi.update', resourceType: 'poi' }, { action: 'poi.delete', resourceType: 'poi' }], subject: { actorUserId: 'kc-editor-1', effectiveUserId: 'kc-editor-1', isImpersonating: false }, evaluatedAt: '2026-04-13T12:00:00.000Z' };

export const expectPluginPageHeading = async (page: Page, pattern: RegExp) => {
  await Promise.any([page.locator('main h1').filter({ hasText: pattern }).waitFor({ state: 'visible' }), page.getByRole('navigation', { name: /Brotkrumen-Navigation/ }).getByText(pattern).waitFor({ state: 'visible' })]);
};
export const expectEventOrPoiEditorReady = async (page: Page, path: '/admin/events/new' | '/admin/poi/new') => {
  if (path === '/admin/events/new') {
    await expectPluginPageHeading(page, /Event anlegen|events\.detail\.createTitle|events\.editor\.createTitle/);
    await expect(page.locator('#event-title')).toBeVisible();
  } else {
    await expectPluginPageHeading(page, /Ort anlegen|POI anlegen|poi\.detail\.createTitle|poi\.editor\.createTitle/);
    await expect(page.locator('#poi-name')).toBeVisible();
  }
};
export const expectContentOverviewReady = async (page: Page) => {
  await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/);
  await expect(page.locator('#main-content')).toBeVisible();
};
export const expectCreateContentActionReady = async (page: Page) => {
  await expect(page.getByRole('link', { name: /Neuer Inhalt|content\.actions\.create/ })).toBeVisible();
};
export const expectLoginRedirect = async (page: Page, returnToPattern: RegExp) => {
  await Promise.any([
    page.waitForFunction(() => {
      const { pathname, search } = window.location;
      return (
        pathname === '/' ||
        pathname === '/auth/login' ||
        search.startsWith('?auth=login&returnTo=') ||
        search.startsWith('?auth=dev-login&returnTo=') ||
        search.startsWith('?auth=mock-login&returnTo=')
      );
    }),
    page.getByRole('heading', { name: /Sign in to your account/i }).waitFor({ state: 'visible' }),
  ]);
  const loginUrl = new URL(page.url());
  if (loginUrl.pathname !== '/') {
    const returnTo = loginUrl.searchParams.get('returnTo');
    if (returnTo !== null) {
      expect(returnTo).toMatch(returnToPattern);
    }
  }
};

export const mockSharedShellRequests = async (page: Page) => {
  await page.route('**/auth/me', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authenticatedUser) }));
  await page.route('**/iam/me/permissions?**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(permissionPayload) }));
  await registerSharedIamRoutes(page);
  await page.route('**/api/v1/iam/media**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }));
};

export const expectNoSeriousAccessibilityViolations = async (page: Page) => {
  const result = await new AxeBuilder({ page }).include('#main-content').analyze();
  expect(result.violations.filter((entry) => ['serious', 'critical'].includes(entry.impact ?? ''))).toEqual([]);
};
