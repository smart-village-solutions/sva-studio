import type { Page, Route } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';

import { mockWasteFacade } from '../../e2e/waste-management-plugin.helpers';

const createHarness = async (allowFractionCreate = true) => {
  let dispatch!: (route: Route) => Promise<void>;
  const page = {
    route: async (_pattern: string, handler: typeof dispatch) => {
      dispatch = handler;
    },
  } as unknown as Page;
  const harness = await mockWasteFacade(page, {
    instanceId: 'fixture',
    settings: {
      provider: 'postgresql',
      schemaName: 'fixture',
      enabled: true,
      databaseUrlConfigured: true,
      visibleStatus: 'ok',
    },
    fractions: [],
    tours: [],
    allowFractionCreate,
  });
  const request = async (method: string, path: string, body: unknown = {}) => {
    const fulfill = vi.fn<(response: { status: number; body: string }) => Promise<void>>();
    const fallback = vi.fn<() => Promise<void>>();
    const route = {
      request: () => ({
        method: () => method,
        url: () => `https://fixture.invalid/api/v1/waste-management/${path}`,
        postDataJSON: () => body,
        postDataBuffer: () => Buffer.from('fixture'),
      }),
      fulfill,
      fallback,
    } as unknown as Route;
    await dispatch(route);
    return { fulfill, fallback, response: fulfill.mock.calls[0]?.[0] };
  };
  return { harness, request };
};

describe('waste E2E facade dispatch', () => {
  it('matches method and pathname while ignoring the query string', async () => {
    const { request } = await createHarness();
    const result = await request('GET', 'settings?instanceId=fixture');
    expect(result.response?.status).toBe(200);
    expect(JSON.parse(result.response?.body ?? '{}').data.schemaName).toBe('fixture');
    expect(result.fallback).not.toHaveBeenCalled();
    for (const [method, path] of [
      ['POST', 'history'],
      ['GET', 'settings/'],
      ['GET', 'unknown'],
    ] as const) {
      const missing = await request(method, path);
      expect(missing.fulfill).not.toHaveBeenCalled();
      expect(missing.fallback).toHaveBeenCalledExactlyOnceWith();
    }
  });

  it('keeps mutation capture and state shared across endpoint handlers', async () => {
    const { harness, request } = await createHarness();
    const fraction = { id: 'paper', name: 'Papier', color: '#ffffff', active: true };
    expect((await request('POST', 'fractions', fraction)).response?.status).toBe(201);
    expect(harness.requests.createdFractions).toEqual([fraction]);
    const masterData = await request('GET', 'master-data');
    expect(JSON.parse(masterData.response?.body ?? '{}').data.fractions).toEqual([
      { ...fraction, createdAt: '2026-05-10T12:15:00.000Z', updatedAt: '2026-05-10T12:15:00.000Z' },
    ]);
    await request('PUT', 'settings', { schemaName: 'changed' });
    const settings = await request('GET', 'settings');
    expect(JSON.parse(settings.response?.body ?? '{}').data.schemaName).toBe('changed');
    expect(harness.requests.settingsUpdates).toEqual([{ schemaName: 'changed' }]);
    expect((await request('POST', 'tools/seed')).response?.status).toBe(201);
    expect(harness.requests.startedJobTypes).toEqual(['waste-management.seed-data']);
  });

  it('preserves forbidden creation without mutating master data', async () => {
    const { harness, request } = await createHarness(false);
    const result = await request('POST', 'fractions', { id: 'forbidden' });
    expect(result.response?.status).toBe(403);
    expect(harness.requests.createdFractions).toEqual([]);
    const masterData = await request('GET', 'master-data');
    expect(JSON.parse(masterData.response?.body ?? '{}').data.fractions).toEqual([]);
  });
});
