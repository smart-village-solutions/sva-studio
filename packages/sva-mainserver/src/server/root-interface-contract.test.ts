import { beforeEach, describe, expect, it, vi } from 'vitest';

const access = {
  actorId: 'admin',
  listActiveInstances: vi.fn(),
  instanceExists: vi.fn(),
  recordSave: vi.fn(),
};
vi.mock('@sva/auth-runtime/server', () => ({
  withRootMainserverRegistryAccess: vi.fn(async (_request, _action, work) => work(access)),
}));
vi.mock('./settings.js', () => ({
  loadSvaMainserverSettings: vi.fn(),
  saveSvaMainserverSettings: vi.fn(),
}));
vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ error: vi.fn() }),
}));

import { withRootMainserverRegistryAccess } from '@sva/auth-runtime/server';
import { loadSvaMainserverSettings, saveSvaMainserverSettings } from './settings.js';
import { dispatchRootMainserverInterfacesRequest } from './root-interface-contract.js';

const base = 'https://studio.example.test/api/v1/iam/instances';
const config = {
  instanceId: 'bb-prenzlau',
  providerKey: 'sva_mainserver' as const,
  graphqlBaseUrl: 'https://server.example.test/graphql',
  oauthTokenUrl: 'https://server.example.test/oauth/token',
  enabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  access.listActiveInstances.mockResolvedValue([
    { instanceId: 'bb-prenzlau', displayName: 'Prenzlau' },
    { instanceId: 'bb-spremberg', displayName: 'Spremberg' },
  ]);
  access.instanceExists.mockResolvedValue(true);
  access.recordSave.mockResolvedValue(undefined);
  vi.mocked(loadSvaMainserverSettings).mockResolvedValue(null);
  vi.mocked(saveSvaMainserverSettings).mockResolvedValue(config);
});

describe('root Mainserver interface HTTP contract', () => {
  it('lists active instances and distinguishes missing, configured, and read errors', async () => {
    vi.mocked(loadSvaMainserverSettings)
      .mockResolvedValueOnce(config)
      .mockRejectedValueOnce(new Error('database down'));
    const response = await dispatchRootMainserverInterfacesRequest(new Request(`${base}/mainserver-interfaces`));
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ data: { entries: [
      { instanceId: 'bb-prenzlau', displayName: 'Prenzlau', status: 'configured', config },
      { instanceId: 'bb-spremberg', displayName: 'Spremberg', status: 'error', errorCode: 'mainserver_interface_read_failed', config: null },
    ] } });
    expect(withRootMainserverRegistryAccess).toHaveBeenCalledWith(expect.any(Request), 'instance.list', expect.any(Function));
  });

  it('returns a missing detail only for an active existing instance', async () => {
    const response = await dispatchRootMainserverInterfacesRequest(new Request(`${base}/bb-prenzlau/mainserver-interface`));
    expect(await response?.json()).toEqual({ data: { instanceId: 'bb-prenzlau', status: 'missing', config: null } });
    access.instanceExists.mockResolvedValueOnce(false);
    const absent = await dispatchRootMainserverInterfacesRequest(new Request(`${base}/bb-prenzlau/mainserver-interface`));
    expect(absent?.status).toBe(404);
  });

  it('reports a stored but disabled interface separately from a missing one', async () => {
    vi.mocked(loadSvaMainserverSettings).mockResolvedValueOnce({ ...config, enabled: false });
    const response = await dispatchRootMainserverInterfacesRequest(new Request(`${base}/bb-prenzlau/mainserver-interface`));
    expect(await response?.json()).toMatchObject({ data: { status: 'disabled', config: { enabled: false } } });
  });

  it('validates a targeted save, audits it, and returns database readback', async () => {
    vi.mocked(loadSvaMainserverSettings).mockResolvedValueOnce(config);
    const request = new Request(`${base}/bb-prenzlau/mainserver-interface`, {
      method: 'PUT',
      body: JSON.stringify({ graphqlBaseUrl: config.graphqlBaseUrl, oauthTokenUrl: config.oauthTokenUrl, enabled: true }),
    });
    const response = await dispatchRootMainserverInterfacesRequest(request);
    expect(response?.status).toBe(200);
    expect(saveSvaMainserverSettings).toHaveBeenCalledWith({ instanceId: 'bb-prenzlau', graphqlBaseUrl: config.graphqlBaseUrl, oauthTokenUrl: config.oauthTokenUrl, enabled: true });
    expect(access.recordSave).toHaveBeenCalledWith('bb-prenzlau', true);
    expect(await response?.json()).toEqual({ data: { instanceId: 'bb-prenzlau', status: 'configured', config } });
  });

  it('rejects extra fields before writing', async () => {
    const response = await dispatchRootMainserverInterfacesRequest(new Request(`${base}/bb-prenzlau/mainserver-interface`, {
      method: 'PUT', body: JSON.stringify({ graphqlBaseUrl: config.graphqlBaseUrl, oauthTokenUrl: config.oauthTokenUrl, enabled: true, secret: 'x' }),
    }));
    expect(response?.status).toBe(400);
    expect(saveSvaMainserverSettings).not.toHaveBeenCalled();
  });

  it('does not report save success when the stored record is absent on readback', async () => {
    const response = await dispatchRootMainserverInterfacesRequest(new Request(`${base}/bb-prenzlau/mainserver-interface`, {
      method: 'PUT',
      body: JSON.stringify({ graphqlBaseUrl: config.graphqlBaseUrl, oauthTokenUrl: config.oauthTokenUrl, enabled: true }),
    }));
    expect(response?.status).toBe(500);
    expect(await response?.json()).toEqual({ error: { code: 'mainserver_interface_readback_missing' } });
  });
});
