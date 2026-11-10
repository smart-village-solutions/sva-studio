import { describe, expect, it, vi } from 'vitest';
import { getWasteEmailMonitoringInternal } from './email-monitoring.js';
import { wasteEmailMonitoringPermission } from '@sva/waste-management-contracts';

vi.unmock('./auth.js');

const ctx = { sessionId: 'session', user: { id: 'reader', instanceId: 'tenant-a', roles: [] } };
const data = { subscriptions: [], total: 0, deliveries: [], deliveryTotal: 0 };
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
});
