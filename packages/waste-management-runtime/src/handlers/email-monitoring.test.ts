import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { getWasteEmailMonitoringInternal } from './email-monitoring.js';
import { wasteEmailMonitoringPermission } from '@sva/waste-management-contracts';

vi.unmock('./auth.js');

const ctx = { sessionId: 'session', user: { id: 'reader', instanceId: 'tenant-a', roles: [] } };
const data = { subscriptions: [], total: 0, deliveries: [], deliveryTotal: 0 };
const searchRequest = (body: unknown) => new Request('https://studio.test/email-monitoring/search?instanceId=tenant-b', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  body: JSON.stringify(body),
});
describe('email monitoring authorization', () => {
  it('requires the separate permission even for normal monitoring or waste readers', async () => {
    const loadWasteEmailMonitoring = vi.fn();
    const authorizeAction = vi.fn(async ({ action }: { action: string }) =>
      action === 'iam.monitoring.read' || action === 'waste-management.read'
        ? null
        : new Response(null, { status: 403 })
    );
    const response = await getWasteEmailMonitoringInternal(
      new Request('https://studio.test/?instanceId=tenant-b'),
      ctx,
      { authorizeAction, loadWasteEmailMonitoring }
    );
    expect(response.status).toBe(403);
    expect(loadWasteEmailMonitoring).not.toHaveBeenCalled();
    expect(authorizeAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: wasteEmailMonitoringPermission, instanceId: 'tenant-a' })
    );
  });
  it('loads only the authenticated tenant and prevents browser caching', async () => {
    const loadWasteEmailMonitoring = vi.fn(async () => data);
    const response = await getWasteEmailMonitoringInternal(
      new Request('https://studio.test/?instanceId=tenant-b&pageSize=25'),
      ctx,
      { authorizeAction: async () => null, loadWasteEmailMonitoring }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(loadWasteEmailMonitoring).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({ page: 1, pageSize: 25 })
    );
  });
  it.each([
    'subscriptionId=invalid',
    'page=0',
    'page=-1',
    'pageSize=101',
    'deliveryPage=1.5',
    'status=bogus',
  ])('rejects invalid filters %s before querying', async (query) => {
    const loadWasteEmailMonitoring = vi.fn();
    const response = await getWasteEmailMonitoringInternal(
      new Request(`https://studio.test/?${query}`),
      ctx,
      { authorizeAction: async () => null, loadWasteEmailMonitoring }
    );
    expect(response.status).toBe(400);
    expect(loadWasteEmailMonitoring).not.toHaveBeenCalled();
  });
  it('does not disclose database errors in failed responses', async () => {
    const response = await getWasteEmailMonitoringInternal(
      new Request('https://studio.test/'),
      ctx,
      {
        authorizeAction: async () => null,
        loadWasteEmailMonitoring: async () => {
          throw new Error('private@example.de token=secret');
        },
      }
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/private|secret/);
  });
  it('rejects missing tenant context without querying', async () => {
    const loadWasteEmailMonitoring = vi.fn();
    const response = await getWasteEmailMonitoringInternal(
      new Request('https://studio.test/'),
      { ...ctx, user: { ...ctx.user, instanceId: undefined } },
      { authorizeAction: async () => null, loadWasteEmailMonitoring }
    );
    expect(response.status).toBe(400);
    expect(loadWasteEmailMonitoring).not.toHaveBeenCalled();
  });
  it('queries only active subscriptions for a normalized complete address in the authenticated tenant', async () => {
    const loadWasteEmailMonitoring = vi.fn(async () => data);
    const authorizeAction = vi.fn(async () => null);
    const digest = `sha256:${createHash('sha256').update('fixture@example.invalid').digest('hex')}`;
    const response = await getWasteEmailMonitoringInternal(
      searchRequest({ email: ' Fixture@EXAMPLE.invalid ', page: 2, pageSize: 50, deliveryPage: 3 }),
      ctx,
      { authorizeAction, loadWasteEmailMonitoring }
    );
    expect(authorizeAction).toHaveBeenCalledWith(expect.objectContaining({
      action: wasteEmailMonitoringPermission, instanceId: 'tenant-a',
    }));
    expect(loadWasteEmailMonitoring).toHaveBeenCalledWith('tenant-a', {
      status: 'active', emailHash: digest, page: 2, pageSize: 50, deliveryPage: 3,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).not.toMatch(/fixture|example\.invalid|sha256/);
  });

  it('finds complete internationalized addresses accepted by the public signup', async () => {
    const loadWasteEmailMonitoring = vi.fn(async () => data);
    const response = await getWasteEmailMonitoringInternal(searchRequest({ email: ' Übergabe@Beispiel.Invalid ' }), ctx, {
      authorizeAction: async () => null,
      loadWasteEmailMonitoring,
    });
    expect(response.status).toBe(200);
    expect(loadWasteEmailMonitoring).toHaveBeenCalledWith('tenant-a', expect.objectContaining({
      emailHash: `sha256:${createHash('sha256').update('übergabe@beispiel.invalid').digest('hex')}`,
    }));
  });

  it.each([
    { email: 'example.invalid' },
    { email: '@example.invalid' },
    { email: 'fixture@' },
    { email: 'fixture@example.' },
    { email: 'fixture@.invalid' },
    { email: 'fixture@some where.invalid' },
    { email: 'fixture@@example.invalid' },
    { email: 'fixture@example.invalid', status: 'pending' },
    { email: 'fixture@example.invalid', instanceId: 'tenant-b' },
  ])('rejects incomplete addresses and additional parameters before reading', async (query) => {
    const loadWasteEmailMonitoring = vi.fn();
    const response = await getWasteEmailMonitoringInternal(
      searchRequest(query), ctx, { authorizeAction: async () => null, loadWasteEmailMonitoring }
    );
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).not.toMatch(/fixture|example\.invalid|tenant-b/);
    expect(loadWasteEmailMonitoring).not.toHaveBeenCalled();
  });

  it('rejects searches without the monitoring permission before parsing the body', async () => {
    const request = searchRequest({ email: 'fixture@example.invalid' });
    const loadWasteEmailMonitoring = vi.fn();
    const response = await getWasteEmailMonitoringInternal(request, ctx, {
      authorizeAction: async () => new Response(null, { status: 403 }),
      loadWasteEmailMonitoring,
    });
    expect(response.status).toBe(403);
    expect(request.bodyUsed).toBe(false);
    expect(loadWasteEmailMonitoring).not.toHaveBeenCalled();
  });
});
