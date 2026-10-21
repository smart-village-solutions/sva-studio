import { describe, expect, it, vi } from 'vitest';
import { createMediaHttpHandlers } from './core.js';
const id = '00000000-0000-4000-8000-000000000001';
const setup = () => {
  const scheduleInventoryScan = vi.fn(async () => ({ id, status: 'queued' }));
  const getInventoryScan = vi.fn(async () => ({
    id,
    status: 'succeeded',
    report: { entries: [], nextCursor: null, completedAt: '2026-10-21T00:00:00Z' },
  }));
  const authorizeAction = vi.fn(async () => ({ ok: true }) as const);
  const handlers = createMediaHttpHandlers({
    withMediaService: vi.fn(),
    storagePort: {} as never,
    scheduleInventoryScan,
    getInventoryScan,
    authorizeAction,
    createId: () => id,
    now: () => '',
    emitAuditEvent: vi.fn(),
  });
  const ctx = { user: { id: 'subject', instanceId: 'tenant-a' } } as never;
  const request = (
    body: unknown,
    headers = { origin: 'http://localhost', 'x-requested-with': 'XMLHttpRequest' }
  ) =>
    new Request('http://localhost/api/v1/iam/media/inventory-scans', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  return { handlers, ctx, request, scheduleInventoryScan, getInventoryScan, authorizeAction };
};
describe('inventory scan HTTP boundaries', () => {
  it('requires CSRF before authorizing or creating a job', async () => {
    const s = setup();
    expect((await s.handlers.startInventoryScan(s.request({}, {} as never), s.ctx)).status).toBe(
      403
    );
    expect(s.authorizeAction).not.toHaveBeenCalled();
    expect(s.scheduleInventoryScan).not.toHaveBeenCalled();
  });
  it.each([{ limit: 26 }, { limit: 0 }, { limit: 1.5 }, { instanceId: 'tenant-b' }])(
    'rejects invalid or cross-instance input %j',
    async (body) => {
      const s = setup();
      const response = await s.handlers.startInventoryScan(s.request(body), s.ctx);
      expect([400, 403]).toContain(response.status);
      expect(s.scheduleInventoryScan).not.toHaveBeenCalled();
    }
  );
  it('requires both existing read and update rights and returns a queued job', async () => {
    const s = setup();
    expect(
      (await s.handlers.startInventoryScan(s.request({ limit: 5, cursor: 'next' }), s.ctx)).status
    ).toBe(202);
    expect(s.authorizeAction.mock.calls.map(([input]) => input.action)).toEqual([
      'media.read',
      'media.update',
    ]);
    expect(s.scheduleInventoryScan).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'tenant-a', limit: 5, cursor: 'next' })
    );
  });
  it('denies jobs before side effects when permission is missing', async () => {
    const s = setup();
    s.authorizeAction.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Denied',
    } as never);
    expect((await s.handlers.startInventoryScan(s.request({}), s.ctx)).status).toBe(403);
    expect(s.scheduleInventoryScan).not.toHaveBeenCalled();
  });
  it('rejects malformed report IDs and unauthorized report reads before lookup', async () => {
    const s = setup();
    expect(
      (
        await s.handlers.getInventoryScan(
          new Request('http://localhost/api/v1/iam/media/inventory-scans/invalid'),
          s.ctx
        )
      ).status
    ).toBe(400);
    s.authorizeAction.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Denied',
    } as never);
    expect(
      (
        await s.handlers.getInventoryScan(
          new Request(`http://localhost/api/v1/iam/media/inventory-scans/${id}`),
          s.ctx
        )
      ).status
    ).toBe(403);
    expect(s.getInventoryScan).not.toHaveBeenCalled();
  });
  it('does not reveal absent or unrelated job IDs', async () => {
    const s = setup();
    s.getInventoryScan.mockResolvedValue(null as never);
    expect(
      (
        await s.handlers.getInventoryScan(
          new Request(`http://localhost/api/v1/iam/media/inventory-scans/${id}`),
          s.ctx
        )
      ).status
    ).toBe(404);
  });
  it('reads only a valid report in the authenticated instance', async () => {
    const s = setup();
    const response = await s.handlers.getInventoryScan(
      new Request(`http://localhost/api/v1/iam/media/inventory-scans/${id}`),
      s.ctx
    );
    expect(response.status).toBe(200);
    expect(s.getInventoryScan).toHaveBeenCalledWith('tenant-a', id);
    expect(
      (
        await s.handlers.getInventoryScan(
          new Request(
            `http://localhost/api/v1/iam/media/inventory-scans/${id}?instanceId=tenant-b`
          ),
          s.ctx
        )
      ).status
    ).toBe(403);
    expect(s.getInventoryScan).toHaveBeenCalledTimes(1);
  });
});
