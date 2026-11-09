import { describe, expect, it, vi } from 'vitest';
import { mapPoiItemDetail } from './poi-mappers.js';
import { createPoiService } from './service-poi.js';
import type { ServiceContext } from './service-context.js';
import { createPoiOperations } from './poi-operations.js';
import type { GraphqlExecutor } from './shared.js';
import type { SvaMainserverInstanceConfig } from '../../types.js';
const config = {} as SvaMainserverInstanceConfig;
const input = { instanceId: 'tenant', keycloakSubject: 'subject', poiId: '1' };
describe('POI visibility', () => {
  it.each([
    [true, false, 'published'],
    [false, true, 'draft'],
  ] as const)(
    'maps status from visibility %s independently of active %s',
    (visible, active, status) => {
      expect(mapPoiItemDetail({ id: '1', name: 'Ort', visible, active } as never).data.status).toBe(
        status
      );
    }
  );
  it('changes visibility without rewriting the POI or its vouchers', async () => {
    const execute = vi.fn().mockResolvedValue({ changeVisibility: { statusCode: 200 } });
    await createPoiService({
      executeGraphqlWithConfig: execute,
      loadValidatedInstanceConfig: async () => config,
    } as unknown as ServiceContext).changePoiVisibility({ ...input, visible: false });
    expect(execute).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        variables: { id: '1', recordType: 'PointOfInterest', visible: false },
        document: expect.stringContaining('changeVisibility'),
      }),
      config
    );
  });
  it.each([{}, { changeVisibility: { statusCode: 403 } }])(
    'rejects a failed visibility result',
    async (response) => {
      const execute = vi.fn().mockResolvedValue(response);
      await expect(
        createPoiService({
          executeGraphqlWithConfig: execute,
          loadValidatedInstanceConfig: async () => config,
        } as unknown as ServiceContext).changePoiVisibility({ ...input, visible: true })
      ).rejects.toMatchObject({ code: 'invalid_response' });
    }
  );
});
describe('POI voucher write guard', () => {
  it('blocks deletion before destructive mutation even without the plugin', async () => {
    const execute = vi.fn().mockResolvedValue({ pointOfInterest: { vouchers: [{ id: '2' }] } });
    const service = createPoiOperations(execute as GraphqlExecutor);
    await expect(service.destroyPoiWithConfig(input, config)).rejects.toThrow(
      'voucher_dedicated_editor_required'
    );
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][0].operationName).toBe('SvaMainserverPoiVoucherGuard');
  });
  it('fails closed on a degraded read', async () => {
    const execute = vi.fn().mockResolvedValue({ pointOfInterest: {} });
    await expect(
      createPoiOperations(execute as GraphqlExecutor).destroyPoiWithConfig(input, config)
    ).rejects.toThrow('voucher_snapshot_incomplete');
    expect(execute).toHaveBeenCalledOnce();
  });
});

it('updates only POI fields and leaves existing vouchers, quota and redemptions untouched', async () => {
  const vouchers = [
    {
      id: '2',
      dataProvider: { id: 'provider' },
      quota: { id: 'quota-1', redemptions: [{ id: 'redemption-1' }] },
    },
  ];
  const poi = { id: '1', name: 'Ort', dataProvider: { id: 'provider' }, vouchers };
  const execute = vi.fn().mockImplementation(async ({ operationName, variables }) => {
    if (operationName !== 'SvaMainserverCreatePoi')
      throw new Error('Unexpected aggregate read or write');
    expect(variables).not.toHaveProperty('vouchers');
    expect(variables).not.toHaveProperty('dataProviderId');
    return { createPointOfInterest: { ...poi, ...variables } };
  });
  const result = await createPoiOperations(execute as GraphqlExecutor).writePoiWithConfig(
    {
      ...input,
      poi: Object.assign({ name: 'Neu' }, { vouchers, dataProviderId: 'injected-owner' }),
    },
    config
  );
  expect(result).toMatchObject({ id: '1', name: 'Neu' });
  expect(poi.vouchers).toEqual(vouchers);
  expect(execute).toHaveBeenCalledOnce();
});

it('preserves existing lunch offers from the immediate server read on an ordinary POI save', async () => {
  const lunches = [
    {
      text: 'Mittag',
      pointOfInterestAttributes: null,
      lunchOffers: [{ name: 'Suppe', price: '5,00' }],
      dates: [
        {
          weekday: 'MO',
          dateStart: null,
          dateEnd: null,
          timeStart: '12:00',
          timeEnd: null,
          timeDescription: null,
          useOnlyTimeDescription: 'false',
        },
      ],
    },
  ];
  const execute = vi.fn().mockImplementation(async ({ operationName, variables }) => {
    if (operationName === 'SvaMainserverPoiDetail')
      return { pointOfInterest: { id: '1', name: 'Ort', lunches } };
    expect(variables).toMatchObject({
      lunches: [
        { ...lunches[0], dates: [{ ...lunches[0].dates[0], useOnlyTimeDescription: false }] },
      ],
    });
    expect(variables).not.toHaveProperty('vouchers');
    return { createPointOfInterest: { id: '1', name: 'Neu', lunches } };
  });
  const service = createPoiService({
    loadValidatedInstanceConfig: async () => config,
    poiOperations: createPoiOperations(execute as GraphqlExecutor),
  } as unknown as ServiceContext);
  await expect(service.updatePoi({ ...input, poi: Object.assign({ name: 'Neu' }, { lunches: [] }) })).resolves.toMatchObject({
    id: '1',
  });
  expect(execute).toHaveBeenCalledTimes(2);
});

it.each([undefined, [{ text: 'incomplete' }], 'invalid'])(
  'rejects an incomplete lunch read before writing (%j)',
  async (lunches) => {
    const execute = vi
      .fn()
      .mockResolvedValue({ pointOfInterest: { id: '1', name: 'Ort', lunches } });
    const service = createPoiService({
      loadValidatedInstanceConfig: async () => config,
      poiOperations: createPoiOperations(execute as GraphqlExecutor),
    } as unknown as ServiceContext);
    await expect(service.updatePoi({ ...input, poi: { name: 'Neu' } })).rejects.toThrow(
      'poi_lunch_snapshot_incomplete'
    );
    expect(execute).toHaveBeenCalledOnce();
  }
);
