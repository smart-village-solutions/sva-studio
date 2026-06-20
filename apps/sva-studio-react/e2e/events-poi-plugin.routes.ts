import type { Page, Route } from '@playwright/test';

import { createdAt, type EventRecord, type PoiRecord } from './events-poi-plugin.fixtures';

const createPagination = (total: number) => ({ page: 1, pageSize: 25, hasNextPage: false, total });
const mapEventToUnifiedContent = (events: readonly EventRecord[]) => events.map((item) => ({ id: item.id, contentType: item.contentType, title: item.title, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt, publishedAt: item.dates?.[0]?.dateStart, access: { state: 'editable', canRead: true, canCreate: true, canUpdate: true, organizationIds: ['org-1'], sourceKinds: ['direct_role'] } }));
const mapPoiToUnifiedContent = (pois: readonly PoiRecord[]) => pois.map((item) => ({ id: item.id, contentType: item.contentType, title: item.name, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt, access: { state: 'editable', canRead: true, canCreate: true, canUpdate: true, organizationIds: ['org-1'], sourceKinds: ['direct_role'] } }));

export const routeUnifiedContentOverview = async (page: Page, getEvents: () => readonly EventRecord[], getPois: () => readonly PoiRecord[]) => {
  await page.route('**/api/v1/iam/contents**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [...mapEventToUnifiedContent(getEvents()), ...mapPoiToUnifiedContent(getPois())], pagination: createPagination(getEvents().length + getPois().length) }) }));
  await page.route('**/api/v1/mainserver/news**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], pagination: createPagination(0) }) }));
};

export const routeEvents = async (route: Route, events: EventRecord[]) => {
  const request = route.request();
  const method = request.method();
  const path = new URL(request.url()).pathname;
  if (path === '/api/v1/mainserver/events' || path === '/api/v1/mainserver/events/') {
    if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: events, pagination: createPagination(events.length) }) });
    if (method === 'POST') {
      const body = request.postDataJSON() as Partial<EventRecord>;
      const item: EventRecord = { id: 'event-1', title: String(body.title), contentType: 'events.event-record', status: 'published', createdAt, updatedAt: createdAt, description: body.description, categoryName: body.categoryName, dates: body.dates, addresses: body.addresses, contact: body.contact, urls: body.urls, pointOfInterestId: body.pointOfInterestId, repeat: body.repeat };
      events.push(item);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: item }) });
    }
  }
  const detailMatch = path.match(/^\/api\/v1\/mainserver\/events\/([^/]+)\/?$/);
  if (!detailMatch) return route.fallback();
  const item = events.find((entry) => entry.id === detailMatch[1]);
  if (method === 'GET') return route.fulfill({ status: item ? 200 : 404, contentType: 'application/json', body: JSON.stringify(item ? { data: item } : { error: 'not_found' }) });
  if (method === 'PATCH' && item) { const body = request.postDataJSON() as Partial<EventRecord>; item.title = String(body.title ?? item.title); item.categoryName = body.categoryName ?? item.categoryName; item.updatedAt = '2026-04-13T12:20:00.000Z'; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: item }) }); }
  if (method === 'DELETE') { const index = events.findIndex((entry) => entry.id === detailMatch[1]); if (index >= 0) events.splice(index, 1); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: detailMatch[1] } }) }); }
  await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) });
};

export const routePoi = async (route: Route, pois: PoiRecord[]) => {
  const request = route.request();
  const method = request.method();
  const path = new URL(request.url()).pathname;
  if (path === '/api/v1/mainserver/poi' || path === '/api/v1/mainserver/poi/') {
    if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: pois, pagination: createPagination(pois.length) }) });
    if (method === 'POST') { const body = request.postDataJSON() as Partial<PoiRecord>; const item: PoiRecord = { id: 'poi-1', name: String(body.name), contentType: 'poi.point-of-interest', status: 'published', createdAt, updatedAt: createdAt, description: body.description, mobileDescription: body.mobileDescription, active: body.active, categoryName: body.categoryName, addresses: body.addresses, contact: body.contact, openingHours: body.openingHours, webUrls: body.webUrls, payload: body.payload }; pois.push(item); return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: item }) }); }
  }
  const detailMatch = path.match(/^\/api\/v1\/mainserver\/poi\/([^/]+)\/?$/);
  if (!detailMatch) return route.fallback();
  const item = pois.find((entry) => entry.id === detailMatch[1]);
  if (method === 'GET') return route.fulfill({ status: item ? 200 : 404, contentType: 'application/json', body: JSON.stringify(item ? { data: item } : { error: 'not_found' }) });
  if (method === 'PATCH' && item) { const body = request.postDataJSON() as Partial<PoiRecord>; item.name = String(body.name ?? item.name); item.categoryName = body.categoryName ?? item.categoryName; item.updatedAt = '2026-04-13T12:20:00.000Z'; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: item }) }); }
  if (method === 'DELETE') { const index = pois.findIndex((entry) => entry.id === detailMatch[1]); if (index >= 0) pois.splice(index, 1); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: detailMatch[1] } }) }); }
  await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not_found' }) });
};

export const prepareEventAndPoiA11yViews = async (page: Page) => {
  const events: EventRecord[] = [{ id: 'event-1', title: 'A11y Event', contentType: 'events.event-record', status: 'published', createdAt, updatedAt: createdAt, dates: [{ dateStart: '2026-04-14T09:30:00.000Z' }] }];
  const pois: PoiRecord[] = [{ id: 'poi-1', name: 'A11y POI', contentType: 'poi.point-of-interest', status: 'published', createdAt, updatedAt: createdAt, active: true }];
  await page.route('**/api/v1/mainserver/events**', async (route) => routeEvents(route, events));
  await page.route('**/api/v1/mainserver/poi**', async (route) => routePoi(route, pois));
  await routeUnifiedContentOverview(page, () => events, () => pois);
};
