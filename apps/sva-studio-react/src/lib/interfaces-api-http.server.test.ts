import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  list: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock('@sva/server-runtime', () => ({ createSdkLogger: () => state.logger }));
vi.mock('./interfaces-api', () => ({
  deleteInstanceInterfaceForRequest: state.remove,
  upsertInstanceInterfaceForRequest: state.upsert,
}));
vi.mock('./interfaces-api-list', () => ({ listInstanceInterfaces: state.list }));

describe('personal interface HTTP routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('serves the sanitized tenant-owned interface list without the Mainserver contract', async () => {
    state.list.mockResolvedValue({
      instanceId: 'tenant-a',
      availableTypes: ['s3'],
      entries: [
        {
          id: 's3-1',
          status: 'error',
          statusMessage: 'postgres://db-user:private-value@db.example/wm',
        },
      ],
    });
    const { dispatchInterfacesApiRequest } = await import('./interfaces-api-http.server');
    const request = new Request('https://tenant-a.example/api/v1/interfaces');

    const response = await dispatchInterfacesApiRequest(request);

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({
      data: {
        instanceId: 'tenant-a',
        availableTypes: ['s3'],
        entries: [{ id: 's3-1', status: 'error' }],
      },
    });
    expect(state.list).toHaveBeenCalledWith(request, { includeMainserver: false });
  });

  it('validates and dispatches an upsert through the existing interface operation', async () => {
    state.upsert.mockResolvedValue({
      id: 's3-1',
      type: 's3',
      statusMessage: 's3://account:private-value@storage.example',
    });
    const { dispatchInterfacesApiRequest } = await import('./interfaces-api-http.server');
    const request = new Request('https://tenant-a.example/api/v1/interfaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        draft: {
          type: 's3',
          name: 'Uploads',
          enabled: true,
          config: {
            endpoint: 'https://s3.example',
            region: 'eu-central-1',
            bucket: 'uploads',
            accessKeyId: 'access-id',
            secretAccessKey: '',
            forcePathStyle: false,
          },
        },
      }),
    });

    const response = await dispatchInterfacesApiRequest(request);

    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ data: { id: 's3-1', type: 's3' } });
    expect(state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ draft: expect.objectContaining({ type: 's3' }) }),
      request
    );
  });

  it('rejects malformed inputs before invoking interface mutations', async () => {
    const { dispatchInterfacesApiRequest } = await import('./interfaces-api-http.server');
    const request = new Request('https://tenant-a.example/api/v1/interfaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draft: { type: 'mainserver', config: {} } }),
    });

    const response = await dispatchInterfacesApiRequest(request);

    expect(response?.status).toBe(400);
    expect(await response?.json()).toEqual({ error: { code: 'invalid_request' } });
    expect(state.upsert).not.toHaveBeenCalled();
  });

  it('supports DELETE by interface id and rejects other methods', async () => {
    state.remove.mockResolvedValue({ deleted: true });
    const { dispatchInterfacesApiRequest } = await import('./interfaces-api-http.server');
    const deletion = new Request('https://tenant-a.example/api/v1/interfaces/s3-1', {
      method: 'DELETE',
    });
    const deleted = await dispatchInterfacesApiRequest(deletion);

    expect(deleted?.status).toBe(200);
    expect(await deleted?.json()).toEqual({ data: { deleted: true } });
    expect(state.remove).toHaveBeenCalledWith({ id: 's3-1' }, deletion);

    const unsupported = await dispatchInterfacesApiRequest(
      new Request('https://tenant-a.example/api/v1/interfaces', { method: 'DELETE' })
    );
    expect(unsupported?.status).toBe(405);
  });

  it('keeps raw exception details out of HTTP errors and logs', async () => {
    state.upsert.mockRejectedValue(new Error('postgres://db-user:private-value@db.example/wm'));
    const { dispatchInterfacesApiRequest } = await import('./interfaces-api-http.server');
    const request = new Request('https://tenant-a.example/api/v1/interfaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        draft: {
          type: 's3',
          name: 'Uploads',
          enabled: true,
          config: {
            endpoint: '',
            region: '',
            bucket: '',
            accessKeyId: '',
            secretAccessKey: '',
            forcePathStyle: false,
          },
        },
      }),
    });

    const response = await dispatchInterfacesApiRequest(request);
    const visible = JSON.stringify({
      body: await response?.json(),
      logs: state.logger.error.mock.calls,
    });

    expect(response?.status).toBe(500);
    expect(visible).not.toContain('private-value');
    expect(visible).toContain('interface_request_failed');
  });
});
