import { describe, expect, it, vi } from 'vitest';

import type {
  SvaMainserverEventItem,
  SvaMainserverGenericItem,
  SvaMainserverInstanceConfig,
  SvaMainserverNewsItem,
  SvaMainserverPoiItem,
} from '../../types.js';

import { createContentOwnershipTransferOperation } from './content-ownership-transfer.js';

const config: SvaMainserverInstanceConfig = {
  instanceId: 'instance-1',
  providerKey: 'sva_mainserver',
  graphqlBaseUrl: 'https://mainserver.test/graphql',
  oauthTokenUrl: 'https://mainserver.test/oauth/token',
  enabled: true,
};

const connection = {
  instanceId: 'instance-1',
  keycloakSubject: 'actor-1',
};

const createOperations = () => ({
  news: {
    getNewsWithConfig: vi.fn(),
    writeNewsWithConfig: vi.fn(),
  },
  event: {
    getEventWithConfig: vi.fn(),
    writeEventWithConfig: vi.fn(),
  },
  poi: {
    getPoiWithConfig: vi.fn(),
    writePoiWithConfig: vi.fn(),
  },
  genericItem: {
    getGenericItemWithConfig: vi.fn(),
    writeGenericItemWithConfig: vi.fn(),
  },
});

describe('createContentOwnershipTransferOperation', () => {
  it('performs a fresh source read and sends only the required News fields with the target provider', async () => {
    const operations = createOperations();
    operations.news.getNewsWithConfig.mockResolvedValue({
      id: 'news-1',
      title: 'Titel bleibt erhalten',
      publishedAt: '2026-08-27T08:00:00.000Z',
      dataProvider: { id: 'provider-source' },
    } as SvaMainserverNewsItem);
    operations.news.writeNewsWithConfig.mockResolvedValue({
      id: 'news-1',
      dataProvider: { id: 'provider-target' },
    } as SvaMainserverNewsItem);

    const transfer = createContentOwnershipTransferOperation(operations);
    await expect(
      transfer(
        {
          ...connection,
          content: { type: 'news', id: 'news-1' },
          expectedSourceDataProviderId: 'provider-source',
          targetDataProviderId: 'provider-target',
        },
        config
      )
    ).resolves.toEqual({
      contentType: 'news',
      contentId: 'news-1',
      sourceDataProviderId: 'provider-source',
      targetDataProviderId: 'provider-target',
    });

    expect(operations.news.getNewsWithConfig).toHaveBeenCalledBefore(
      operations.news.writeNewsWithConfig
    );
    expect(operations.news.writeNewsWithConfig).toHaveBeenCalledWith(
      {
        ...connection,
        newsId: 'news-1',
        news: {
          title: 'Titel bleibt erhalten',
          publishedAt: '2026-08-27T08:00:00.000Z',
        },
        forceCreate: false,
        dataProviderId: 'provider-target',
      },
      config
    );
  });

  it('uses the required mutation fields for Events, POI and Generic Items', async () => {
    const operations = createOperations();
    operations.event.getEventWithConfig.mockResolvedValue({
      id: 'event-1',
      title: 'Event',
      dataProvider: { id: 'provider-source' },
    } as SvaMainserverEventItem);
    operations.event.writeEventWithConfig.mockResolvedValue({
      id: 'event-1',
      dataProvider: { id: 'provider-target' },
    } as SvaMainserverEventItem);
    operations.poi.getPoiWithConfig.mockResolvedValue({
      id: 'poi-1',
      name: 'POI',
      dataProvider: { id: 'provider-source' },
    } as SvaMainserverPoiItem);
    operations.poi.writePoiWithConfig.mockResolvedValue({
      id: 'poi-1',
      dataProvider: { id: 'provider-target' },
    } as SvaMainserverPoiItem);
    operations.genericItem.getGenericItemWithConfig.mockResolvedValue({
      id: 'generic-1',
      title: 'FAQ',
      genericType: 'faq',
      dataProvider: { id: 'provider-source' },
    } as SvaMainserverGenericItem);
    operations.genericItem.writeGenericItemWithConfig.mockResolvedValue({
      id: 'generic-1',
      dataProvider: { id: 'provider-target' },
    } as SvaMainserverGenericItem);
    const transfer = createContentOwnershipTransferOperation(operations);

    await transfer(
      {
        ...connection,
        content: { type: 'event', id: 'event-1' },
        expectedSourceDataProviderId: 'provider-source',
        targetDataProviderId: 'provider-target',
      },
      config
    );
    await transfer(
      {
        ...connection,
        content: { type: 'poi', id: 'poi-1' },
        expectedSourceDataProviderId: 'provider-source',
        targetDataProviderId: 'provider-target',
      },
      config
    );
    await transfer(
      {
        ...connection,
        content: { type: 'generic-item', id: 'generic-1' },
        expectedSourceDataProviderId: 'provider-source',
        targetDataProviderId: 'provider-target',
      },
      config
    );

    expect(operations.event.writeEventWithConfig).toHaveBeenCalledWith(
      expect.objectContaining({ event: { title: 'Event' }, dataProviderId: 'provider-target' }),
      config
    );
    expect(operations.poi.writePoiWithConfig).toHaveBeenCalledWith(
      expect.objectContaining({ poi: { name: 'POI' }, dataProviderId: 'provider-target' }),
      config
    );
    expect(operations.genericItem.writeGenericItemWithConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        genericItem: { title: 'FAQ', genericType: 'faq' },
        dataProviderId: 'provider-target',
      }),
      config
    );
  });

  it('blocks the write when the fresh source owner changed', async () => {
    const operations = createOperations();
    operations.news.getNewsWithConfig.mockResolvedValue({
      id: 'news-1',
      title: 'News',
      publishedAt: '2026-08-27T08:00:00.000Z',
      dataProvider: { id: 'provider-other' },
    } as SvaMainserverNewsItem);
    const transfer = createContentOwnershipTransferOperation(operations);

    await expect(
      transfer(
        {
          ...connection,
          content: { type: 'news', id: 'news-1' },
          expectedSourceDataProviderId: 'provider-source',
          targetDataProviderId: 'provider-target',
        },
        config
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(operations.news.writeNewsWithConfig).not.toHaveBeenCalled();
  });

  it('rejects an unconfirmed target provider response', async () => {
    const operations = createOperations();
    operations.poi.getPoiWithConfig.mockResolvedValue({
      id: 'poi-1',
      name: 'POI',
      dataProvider: { id: 'provider-source' },
    } as SvaMainserverPoiItem);
    operations.poi.writePoiWithConfig.mockResolvedValue({
      id: 'poi-1',
      dataProvider: { id: 'provider-source' },
    } as SvaMainserverPoiItem);
    const transfer = createContentOwnershipTransferOperation(operations);

    await expect(
      transfer(
        {
          ...connection,
          content: { type: 'poi', id: 'poi-1' },
          expectedSourceDataProviderId: 'provider-source',
          targetDataProviderId: 'provider-target',
        },
        config
      )
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});
