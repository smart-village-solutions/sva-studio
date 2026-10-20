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

  it('dispatches preset changes and tour mutations against the same stored tours', async () => {
    const { harness, request } = await createHarness();
    const presets = [
      { id: 'monthly', name: 'Monatlich', intervalDays: 28 },
      { id: 'weekly', name: 'Wöchentlich', intervalDays: 7 },
    ];
    await request('PUT', 'settings', { customRecurrencePresets: presets });
    const body = {
      id: 'tour',
      name: 'Papier',
      wasteFractionIds: ['paper'],
      customRecurrenceId: 'monthly',
      firstDate: '2026-01-01',
      endDate: '2026-12-31',
    };
    expect((await request('POST', 'tours', body)).response?.status).toBe(201);
    expect(harness.requests.createdTours).toEqual([body]);
    const readTour = async () => {
      const result = await request('GET', 'tours');
      return JSON.parse(result.response?.body ?? '{}').data.tours[0];
    };
    expect(await readTour()).toMatchObject({
      customRecurrenceName: 'Monatlich',
      customRecurrenceIntervalDays: 28,
    });
    await request('PUT', 'settings', {
      customRecurrencePresets: [
        { ...presets[0], name: 'Alle 30 Tage', intervalDays: 30 },
        presets[1],
      ],
    });
    expect(await readTour()).toMatchObject({
      customRecurrenceName: 'Alle 30 Tage',
      customRecurrenceIntervalDays: 30,
    });
    const validity = {
      tourIds: ['tour'],
      firstDate: { mode: 'set', value: '2026-02-01' },
      endDate: { mode: 'clear' },
    };
    expect((await request('PUT', 'tours/bulk-validity', validity)).response?.status).toBe(200);
    expect(harness.requests.tourValidityUpdates).toEqual([validity]);
    expect(await readTour()).toMatchObject({ firstDate: '2026-02-01' });
    expect((await readTour()).endDate).toBeUndefined();
    const status = { tourIds: ['tour'], status: 'published' };
    expect((await request('PUT', 'tours/bulk-status', status)).response?.status).toBe(200);
    expect(harness.requests.tourStatusUpdates).toEqual([status]);
    expect((await readTour()).status).toBe('published');

    await request('PUT', 'settings', {
      customRecurrencePresets: [presets[1]],
      deletedPresetFallbacks: { monthly: { kind: 'preset', value: 'weekly' } },
    });
    expect(await readTour()).toMatchObject({
      customRecurrenceId: 'weekly',
      customRecurrenceName: 'Wöchentlich',
      customRecurrenceIntervalDays: 7,
    });
    await request('PUT', 'settings', {
      customRecurrencePresets: [],
      deletedPresetFallbacks: { weekly: { kind: 'recurrence', value: 'weekly' } },
    });
    expect(await readTour()).toMatchObject({ recurrence: 'weekly' });
    expect((await readTour()).customRecurrenceId).toBeUndefined();
  });

  it('rejects invalid bulk requests atomically and clears a removed preset without a fallback', async () => {
    const { request } = await createHarness();
    await request('POST', 'tours', { id: 'tour', name: 'On demand', recurrence: 'on-demand' });
    expect(
      (
        await request('PUT', 'tours/bulk-validity', {
          tourIds: ['tour'],
          firstDate: { mode: 'clear' },
        })
      ).response?.status
    ).toBe(400);
    expect(
      (await request('PUT', 'tours/bulk-validity', { tourIds: ['missing'] })).response?.status
    ).toBe(400);
    expect(
      (await request('PUT', 'tours/bulk-status', { tourIds: ['tour'], status: 'invalid' })).response
        ?.status
    ).toBe(400);
    expect(
      (await request('PUT', 'tours/bulk-status', { tourIds: ['missing'], status: 'published' }))
        .response?.status
    ).toBe(400);
    await request('POST', 'tours', { id: 'custom', name: 'Custom', customRecurrenceId: 'removed' });
    await request('PUT', 'settings', { customRecurrencePresets: [] });
    const result = await request('GET', 'tours');
    const tours = JSON.parse(result.response?.body ?? '{}').data.tours;
    expect(tours[0].customRecurrenceId).toBeUndefined();
    expect(tours[1]).toMatchObject({ id: 'tour', status: 'draft', recurrence: 'on-demand' });
    expect(tours[1].firstDate).toBeUndefined();
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
