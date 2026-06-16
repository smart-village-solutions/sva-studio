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
  it('maps waste tours, location types and pickup times into a stable sync snapshot', async () => {
    const executeGraphqlWithConfig = vi
      .fn()
      .mockResolvedValueOnce({
        wasteTours: [
          {
            id: 'tour-1',
            title: 'Restmüll Tour',
            wasteType: 'Restmüll',
          },
        ],
      })
      .mockResolvedValueOnce({
        wasteLocationTypes: [
          {
            id: 'location-type-1',
            wasteType: 'Restmüll',
            address: {
              street: 'Hauptstraße',
              zip: '16928',
              city: 'Musterhausen',
            },
            pickUpTimes: [
              {
                id: 'pickup-1',
                pickupDate: '2026-01-10',
                note: 'Vorverlegt',
                wasteLocationTypeId: 'location-type-1',
              },
            ],
          },
        ],
      });

    const operations = createWasteOperations(executeGraphqlWithConfig);
    const result = await operations.listWasteSyncSnapshotWithConfig(connection, config);

    expect(result.tours).toEqual([
      {
        id: 'tour-1',
        title: 'Restmüll Tour',
        wasteType: 'Restmüll',
      },
    ]);
    expect(result.pickupTimes).toEqual([
      expect.objectContaining({
        id: 'pickup-1',
        pickupDate: '2026-01-10',
        wasteType: 'Restmüll',
        street: 'Hauptstraße',
        zip: '16928',
        city: 'Musterhausen',
        note: 'Vorverlegt',
      }),
    ]);
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
