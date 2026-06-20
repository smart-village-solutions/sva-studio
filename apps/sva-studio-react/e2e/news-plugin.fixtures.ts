import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { gotoHomeAsAuthenticatedUser, gotoShellRoot, navigateClientSide, registerSharedIamRoutes } from './studio-shell.helpers';

export { gotoHomeAsAuthenticatedUser, gotoShellRoot, navigateClientSide };

export type NewsRecord = {
  id: string;
  title: string;
  contentType: 'news.article';
  status: 'published';
  author: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  visible?: boolean;
  categories?: readonly { readonly name: string }[];
  sourceUrl?: { readonly url?: string; readonly description?: string };
  categoryName?: string;
  payload: { teaser?: string; body?: string; imageUrl?: string; externalUrl?: string; category?: string };
  contentBlocks?: readonly { readonly title?: string; readonly intro?: string; readonly body?: string }[];
};

export const authenticatedUser = { user: { id: 'kc-editor-1', name: 'Editor One', email: 'editor@example.com', instanceId: 'de-musterhausen', assignedModules: ['news'], roles: ['editor'], permissionActions: ['news.read', 'news.create', 'news.update', 'news.delete'] } };
export const permissionPayload = { instanceId: 'de-musterhausen', permissions: [{ action: 'news.read', resourceType: 'news' }, { action: 'news.create', resourceType: 'news' }, { action: 'news.update', resourceType: 'news' }, { action: 'news.delete', resourceType: 'news' }], subject: { actorUserId: 'kc-editor-1', effectiveUserId: 'kc-editor-1', isImpersonating: false }, evaluatedAt: '2026-04-13T12:00:00.000Z' };

export const expectPluginPageHeading = async (page: Page, pattern: RegExp) => {
  await expect(page.locator('main h1').filter({ hasText: pattern })).toBeVisible();
};

export const expectNewsEditorReady = async (page: Page, mode: 'create' | 'edit') => {
  await expectPluginPageHeading(page, mode === 'create' ? /News-Eintrag anlegen|news\.editor\.createTitle/ : /News-Eintrag bearbeiten|news\.editor\.editTitle/);
  await expect(page.locator('#news-title')).toBeVisible();
};

export const expectContentOverviewReady = async (page: Page) => {
  await expect(page).toHaveURL(/\/admin\/content(?:\?.*)?$/);
  await expect(page.locator('#main-content')).toBeVisible();
};

export const expectLoginRedirect = async (page: Page, returnToPattern: RegExp) => {
  await page.waitForFunction(() => {
    const { pathname, search } = window.location;
    return pathname === '/' || pathname === '/auth/login' || search.startsWith('?auth=login&returnTo=') || search.startsWith('?auth=dev-login&returnTo=') || search.startsWith('?auth=mock-login&returnTo=');
  });
  const loginUrl = new URL(page.url());
  if (loginUrl.pathname !== '/') {
    await expect(page).toHaveURL(/\/(?:\?auth=(?:login|dev-login|mock-login)&returnTo=|auth\/login\?returnTo=)/);
    expect(loginUrl.searchParams.get('returnTo')).toMatch(returnToPattern);
  }
};

export const mockSharedShellRequests = async (page: Page) => {
  await registerSharedIamRoutes(page);
};
