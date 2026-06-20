import type { Page, Route } from '@playwright/test';

import type { NewsRecord } from './news-plugin.fixtures';

export const createPagination = (total: number) => ({ page: 1, pageSize: 25, hasNextPage: false, total });

export const routeUnifiedContentOverview = async (page: Page, newsItems: readonly NewsRecord[]) => {
  await page.route('**/api/v1/iam/contents**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: newsItems.map((item) => ({ id: item.id, contentType: item.contentType, title: item.title, status: item.status, author: item.author, createdAt: item.createdAt, updatedAt: item.updatedAt, publishedAt: item.publishedAt, access: { state: 'editable', canRead: true, canCreate: true, canUpdate: true, organizationIds: ['org-1'], sourceKinds: ['direct_role'] } })),
        pagination: createPagination(newsItems.length),
      }),
    });
  });
};

export const routeNewsMediaRequests = async (route: Route) => {
  const path = new URL(route.request().url()).pathname;
  if (route.request().method() === 'GET' && (path === '/api/v1/iam/media' || path === '/api/v1/iam/media/references')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    return;
  }
  await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) });
};

export const openNewsDetailTab = async (page: Page, labelPattern: RegExp) => {
  await page.getByRole('tab', { name: labelPattern }).click();
};

export const fulfillContentRoute = async (route: Route, newsItems: NewsRecord[]) => {
  const request = route.request();
  const method = request.method();
  const path = new URL(request.url()).pathname;
  if (method === 'GET' && path === '/api/v1/mainserver/news') {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: newsItems, pagination: createPagination(newsItems.length) }) });
    return;
  }
  const visibilityMatch = path.match(/^\/api\/v1\/mainserver\/news\/([^/]+)\/visibility$/);
  if (visibilityMatch && method === 'PATCH') {
    const item = newsItems.find((entry) => entry.id === visibilityMatch[1]);
    if (!item) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) });
    item.visible = (request.postDataJSON() as { visible?: boolean }).visible !== false;
    item.updatedAt = '2026-04-13T12:15:00.000Z';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { status: 'ok' } }) });
    return;
  }
  const detailMatch = path.match(/^\/api\/v1\/mainserver\/news\/([^/]+)$/);
  if (!detailMatch) return route.fallback();
  const contentId = detailMatch[1];
  const item = newsItems.find((entry) => entry.id === contentId);
  if (method === 'GET') return route.fulfill({ status: item ? 200 : 404, contentType: 'application/json', body: JSON.stringify(item ? { data: item } : { error: 'not_found' }) });
  if (method === 'PATCH') {
    if (!item) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) });
    const body = request.postDataJSON() as Record<string, unknown>;
    item.title = String(body.title ?? item.title);
    item.updatedAt = '2026-04-13T12:20:00.000Z';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: item }) });
    return;
  }
  if (method === 'DELETE') {
    const index = newsItems.findIndex((entry) => entry.id === contentId);
    if (index >= 0) newsItems.splice(index, 1);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: contentId } }) });
  }
};
