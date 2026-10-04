import { describe, expect, it, vi } from 'vitest';

import type { SvaMainserverConnectionInput, SvaMainserverInstanceConfig } from '../../types.js';
import { CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE, createWasteOperations } from './waste-operations.js';

const connection: SvaMainserverConnectionInput = {
  instanceId: 'de-musterhausen',
  keycloakSubject: 'subject-1',
};

const config: SvaMainserverInstanceConfig = {
  instanceId: 'de-musterhausen',
  providerKey: 'sva_mainserver',
  graphqlBaseUrl: 'https://mainserver.example/graphql',
  oauthTokenUrl: 'https://mainserver.example/oauth/token',
  enabled: true,
};

describe('waste-operations', () => {
  it('reads pickup times without tour assignments', async () => {
    const executeGraphqlWithConfig = vi
      .fn()
      .mockResolvedValueOnce({
        wasteAddresses: [
          {
            id: 'address-1',
            street: 'Hauptstraße',
            zip: '16928',
            city: 'Musterhausen',
            wasteLocationTypes: [
              {
                id: 'location-type-1',
                wasteType: 'RM-60-1100',
                pickUpTimes: [
                  { id: 'pickup-1', pickupDate: '2026-01-10', note: 'Vorverlegt' },
                ],
              },
            ],
          },
        ],
      });

    const operations = createWasteOperations(executeGraphqlWithConfig);
    const result = await operations.listWasteSyncSnapshotWithConfig(connection, config);

    expect(result.pickupTimes).toEqual([
      expect.objectContaining({
        id: 'pickup-1',
        pickupDate: '2026-01-10',
        wasteType: 'RM-60-1100',
        street: 'Hauptstraße',
        zip: '16928',
        city: 'Musterhausen',
        note: 'Vorverlegt',
      }),
    ]);
    expect(executeGraphqlWithConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        operationName: 'SvaMainserverWasteAddresses',
        variables: { limit: 25, skip: 0 },
      }),
      config
    );
  });

  it('reads pickup times from later address pages', async () => {
    const executeGraphqlWithConfig = vi
      .fn()
      .mockResolvedValueOnce({
        wasteAddresses: Array.from({ length: 25 }, (_, index) => ({
          id: String(index + 1),
          street: `Straße ${index + 1}`,
          wasteLocationTypes: [],
        })),
      })
      .mockResolvedValueOnce({
        wasteAddresses: [{
          id: '26',
          street: 'Straße 26',
          wasteLocationTypes: [{
            wasteType: 'RM-60-1100',
            pickUpTimes: [{ id: 'pickup-101', pickupDate: '2026-01-10' }],
          }],
        }],
      });

    const result = await createWasteOperations(executeGraphqlWithConfig)
      .listWasteSyncSnapshotWithConfig(connection, config);

    expect(result.pickupTimes).toHaveLength(1);
    expect(executeGraphqlWithConfig).toHaveBeenCalledTimes(2);
    expect(executeGraphqlWithConfig).toHaveBeenLastCalledWith(
      expect.objectContaining({ variables: { limit: 25, skip: 25 } }),
      config
    );
  });

  it('rejects an incomplete snapshot before it can drive a sync', async () => {
    const executeGraphqlWithConfig = vi.fn().mockResolvedValue({
      wasteAddresses: [{ id: 'address-1', street: 'Hauptstraße', wasteLocationTypes: null }],
    });

    await expect(
      createWasteOperations(executeGraphqlWithConfig)
        .listWasteSyncSnapshotWithConfig(connection, config)
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('creates waste pickup times in a single simplified batch payload', async () => {
    const executeGraphqlWithConfig = vi.fn().mockResolvedValue({
      createWastePickUpTimes: {
        success: true,
        errors: [],
      },
    });
    const operations = createWasteOperations(executeGraphqlWithConfig);

    await operations.createWastePickupTimesWithConfig(
      {
        ...connection,
        items: [
          {
            pickupDate: '2026-01-10',
            wasteType: 'Restmüll',
            street: 'Hauptstraße',
            zip: '16928',
            city: 'Musterhausen',
          },
        ],
      },
      config
    );

    expect(executeGraphqlWithConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        operationName: 'SvaMainserverCreateWastePickUpTimes',
        variables: {
          inputs: [
            {
              pickupDate: '2026-01-10',
              wasteType: 'Restmüll',
              street: 'Hauptstraße',
              zip: '16928',
              city: 'Musterhausen',
            },
          ],
        },
      }),
      config
    );
  });

  it('chunks waste pickup time creates into multiple upstream requests when more than one batch is written', async () => {
    const executeGraphqlWithConfig = vi.fn().mockResolvedValue({
      createWastePickUpTimes: {
        success: true,
        errors: [],
      },
    });
    const operations = createWasteOperations(executeGraphqlWithConfig);
    const batchSize = CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE;
    const items = Array.from({ length: 205 }, (_, index) => ({
      pickupDate: `2026-02-${String((index % 28) + 1).padStart(2, '0')}`,
      wasteType: 'Restmüll',
      street: `Hauptstraße ${index + 1}`,
      zip: '16928',
      city: 'Musterhausen',
    }));

    await operations.createWastePickupTimesWithConfig(
      {
        ...connection,
        items,
      },
      config
    );

    expect(executeGraphqlWithConfig).toHaveBeenCalledTimes(3);
    expect(executeGraphqlWithConfig).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operationName: 'SvaMainserverCreateWastePickUpTimes',
        variables: {
          inputs: items.slice(0, batchSize),
        },
      }),
      config
    );
    expect(executeGraphqlWithConfig).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        operationName: 'SvaMainserverCreateWastePickUpTimes',
        variables: {
          inputs: items.slice(batchSize, batchSize * 2),
        },
      }),
      config
    );
    expect(executeGraphqlWithConfig).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        operationName: 'SvaMainserverCreateWastePickUpTimes',
        variables: {
          inputs: items.slice(batchSize * 2),
        },
      }),
      config
    );
  });

  it('prefers deleting pickup times by ids and falls back to pickupDate plus wasteLocationType', async () => {
    const executeGraphqlWithConfig = vi.fn().mockResolvedValue({
      destroyWastePickUpTime: {
        id: 'pickup-1',
      },
    });
    const operations = createWasteOperations(executeGraphqlWithConfig);

    await operations.deleteWastePickupTimesWithConfig(
      {
        ...connection,
        items: [
          {
            id: ' pickup-1 ',
            pickupDate: '2026-01-10',
            wasteType: 'Restmüll',
            street: 'Hauptstraße',
            zip: '16928',
            city: 'Musterhausen',
          },
          {
            pickupDate: '2026-01-17',
            wasteType: 'Biomüll',
            street: 'Nebenstraße',
            city: 'Musterhausen',
          },
        ],
      },
      config
    );

    expect(executeGraphqlWithConfig).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operationName: 'SvaMainserverDestroyWastePickUpTimeByIds',
        variables: { ids: ['pickup-1'] },
      }),
      config
    );
    expect(executeGraphqlWithConfig).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        operationName: 'SvaMainserverDestroyWastePickUpTimeByValue',
        variables: {
          pickupDate: '2026-01-17',
          wasteLocationType: {
            wasteType: 'Biomüll',
            address: {
              street: 'Nebenstraße',
              city: 'Musterhausen',
            },
          },
        },
      }),
      config
    );
  });
});
