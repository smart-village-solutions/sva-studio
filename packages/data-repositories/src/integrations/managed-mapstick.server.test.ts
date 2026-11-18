import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalInterfaceRecord } from '@sva/core';
const state = vi.hoisted(() => ({
  existing: null as ExternalInterfaceRecord | null,
  currentDefault: null as ExternalInterfaceRecord | null,
  saved: null as ExternalInterfaceRecord | null,
  query: vi.fn(),
  transaction: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('./external-interfaces.db.js', () => ({
  createExecutor: () => ({}),
  withIamDb: async (input: { instanceId: string }, work: (client: unknown) => Promise<unknown>) => {
    state.transaction(input);
    return work({ query: state.query });
  },
}));
vi.mock('./external-interfaces.js', () => ({
  createExternalInterfaceRepository: () => ({
    getByAlias: async () => state.existing,
    getDefaultByTypeKey: async () => state.currentDefault,
    getById: async () => state.saved,
    upsert: async (record: ExternalInterfaceRecord) => {
      state.upsert(record);
      state.saved = record;
    },
  }),
}));
import { ensureManagedMapGeocodingInterface } from './external-interfaces.server.js';
const record = (patch: Partial<ExternalInterfaceRecord> = {}): ExternalInterfaceRecord => ({
  id: 'old-map',
  instanceId: 'tenant-a',
  typeKey: 'map_geocoding',
  ownerKind: 'host',
  ownerId: 'host',
  displayName: 'Map',
  alias: 'map',
  enabled: true,
  isDefault: true,
  category: 'api',
  statusCheckKind: 'map_geocoding',
  visibleStatus: 'unknown',
  publicConfig: { provider: 'geoapify' },
  ...patch,
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SVA_MANAGED_MAPSTICK_URL', '');
  state.existing = state.currentDefault = state.saved = null;
  state.query.mockResolvedValue({ rows: [{ id: 'tenant-a' }] });
});
describe('installation-owned Mapstick provisioning', () => {
  it('does nothing in installations without operator configuration', async () => {
    await ensureManagedMapGeocodingInterface('tenant-a');
    expect(state.transaction).not.toHaveBeenCalled();
    expect(state.upsert).not.toHaveBeenCalled();
  });
  it('creates a tenant-owned external interface and verifies its stored identity', async () => {
    await ensureManagedMapGeocodingInterface('tenant-a', {
      serviceUrl: 'https://maps.example/region',
    });
    expect(state.transaction).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'tenant-a' })
    );
    expect(state.query).toHaveBeenCalledWith(
      'SELECT id FROM iam.instances WHERE id=$1 FOR UPDATE',
      ['tenant-a']
    );
    expect(state.saved).toMatchObject({
      instanceId: 'tenant-a',
      isDefault: true,
      authMode: 'none',
      publicConfig: {
        provider: 'mapstick',
        geocodeEndpoint: 'https://maps.example/region/api/',
        reverseGeocodeEndpoint: 'https://maps.example/region/reverse',
      },
    });
  });
  it('preserves explicit disablement and settings on repeat setup', async () => {
    state.existing = record({ enabled: false, publicConfig: { provider: 'mapstick' } });
    await ensureManagedMapGeocodingInterface('tenant-a', { serviceUrl: 'https://maps.example' });
    expect(state.upsert).not.toHaveBeenCalled();
  });
  it('replaces the legacy default while preserving its safety switches', async () => {
    state.currentDefault = record({
      enabled: false,
      publicConfig: { provider: 'geoapify', killSwitchEnabled: true, rateLimitPerMinute: 12 },
    });
    await ensureManagedMapGeocodingInterface('tenant-a', { serviceUrl: 'https://maps.example' });
    expect(state.saved).toMatchObject({
      enabled: false,
      isDefault: true,
      publicConfig: { killSwitchEnabled: true, rateLimitPerMinute: 12 },
    });
  });
  it('does not displace an explicitly configured custom default or create an interface for a missing tenant', async () => {
    state.currentDefault = record({ publicConfig: { provider: 'custom' } });
    await ensureManagedMapGeocodingInterface('tenant-a', { serviceUrl: 'https://maps.example' });
    expect(state.saved?.isDefault).toBe(false);
    state.upsert.mockClear();
    state.query.mockResolvedValue({ rows: [] });
    await ensureManagedMapGeocodingInterface('missing-tenant', {
      serviceUrl: 'https://maps.example',
    });
    expect(state.upsert).not.toHaveBeenCalled();
  });
  it.each([
    'http://maps.example',
    'https://user:pass@maps.example',
    'https://maps.example?key=secret',
  ])('rejects invalid operator URL %s', async (serviceUrl) => {
    await expect(ensureManagedMapGeocodingInterface('tenant-a', { serviceUrl })).rejects.toThrow(
      'invalid_managed_mapstick_url'
    );
    expect(state.transaction).not.toHaveBeenCalled();
  });
});
