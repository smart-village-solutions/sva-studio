import type {
  SvaMainserverConnectionInput,
  SvaMainserverEventInput,
  SvaMainserverEventItem,
  SvaMainserverGenericItem,
  SvaMainserverGenericItemInput,
  SvaMainserverInstanceConfig,
  SvaMainserverNewsInput,
  SvaMainserverNewsItem,
  SvaMainserverOwnershipTransferInput,
  SvaMainserverOwnershipTransferResult,
  SvaMainserverPoiInput,
  SvaMainserverPoiItem,
} from '../../types.js';

import { toSvaMainserverError } from './shared.js';

type Operations = Readonly<{
  news: Readonly<{
    getNewsWithConfig: (
      input: SvaMainserverConnectionInput & { readonly newsId: string },
      config: SvaMainserverInstanceConfig
    ) => Promise<SvaMainserverNewsItem>;
    writeNewsWithConfig: (
      input: SvaMainserverConnectionInput & {
        readonly newsId: string;
        readonly news: SvaMainserverNewsInput;
        readonly forceCreate: false;
        readonly dataProviderId: string;
      },
      config: SvaMainserverInstanceConfig
    ) => Promise<SvaMainserverNewsItem>;
  }>;
  event: Readonly<{
    getEventWithConfig: (
      input: SvaMainserverConnectionInput & { readonly eventId: string },
      config: SvaMainserverInstanceConfig
    ) => Promise<SvaMainserverEventItem>;
    writeEventWithConfig: (
      input: SvaMainserverConnectionInput & {
        readonly eventId: string;
        readonly event: SvaMainserverEventInput;
        readonly forceCreate: false;
        readonly dataProviderId: string;
      },
      config: SvaMainserverInstanceConfig
    ) => Promise<SvaMainserverEventItem>;
  }>;
  poi: Readonly<{
    getPoiWithConfig: (
      input: SvaMainserverConnectionInput & { readonly poiId: string },
      config: SvaMainserverInstanceConfig
    ) => Promise<SvaMainserverPoiItem>;
    writePoiWithConfig: (
      input: SvaMainserverConnectionInput & {
        readonly poiId: string;
        readonly poi: SvaMainserverPoiInput;
        readonly forceCreate: false;
        readonly dataProviderId: string;
      },
      config: SvaMainserverInstanceConfig
    ) => Promise<SvaMainserverPoiItem>;
  }>;
  genericItem: Readonly<{
    getGenericItemWithConfig: (
      input: SvaMainserverConnectionInput & { readonly genericItemId: string },
      config: SvaMainserverInstanceConfig
    ) => Promise<SvaMainserverGenericItem>;
    writeGenericItemWithConfig: (
      input: SvaMainserverConnectionInput & {
        readonly genericItemId: string;
        readonly genericItem: SvaMainserverGenericItemInput;
        readonly forceCreate: false;
        readonly dataProviderId: string;
      },
      config: SvaMainserverInstanceConfig
    ) => Promise<SvaMainserverGenericItem>;
  }>;
}>;

const assertProvider = (input: {
  readonly actualDataProviderId?: string;
  readonly expectedDataProviderId: string;
  readonly phase: 'source' | 'target';
}) => {
  if (input.actualDataProviderId === input.expectedDataProviderId) {
    return;
  }

  throw toSvaMainserverError({
    code: 'invalid_response',
    message:
      input.phase === 'source'
        ? 'Der aktuelle Mainserver-Inhaber stimmt nicht mehr mit dem erwarteten Quellinhaber überein.'
        : 'Der Mainserver hat den angeforderten Zielinhaber nicht bestätigt.',
    statusCode: input.phase === 'source' ? 409 : 502,
  });
};

const connectionFrom = (input: SvaMainserverOwnershipTransferInput) => ({
  instanceId: input.instanceId,
  keycloakSubject: input.keycloakSubject,
  ...(input.activeOrganizationId ? { activeOrganizationId: input.activeOrganizationId } : {}),
  ...(input.actingPrincipalType ? { actingPrincipalType: input.actingPrincipalType } : {}),
  ...(input.credentialFingerprint ? { credentialFingerprint: input.credentialFingerprint } : {}),
});

export const createContentOwnershipTransferOperation = (operations: Operations) =>
  async function transferContentOwnershipWithConfig(
    input: SvaMainserverOwnershipTransferInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverOwnershipTransferResult> {
    const connection = connectionFrom(input);
    let confirmedTargetDataProviderId: string | undefined;

    switch (input.content.type) {
      case 'news': {
        const current = await operations.news.getNewsWithConfig(
          { ...connection, newsId: input.content.id },
          config
        );
        assertProvider({
          actualDataProviderId: current.dataProvider?.id,
          expectedDataProviderId: input.expectedSourceDataProviderId,
          phase: 'source',
        });
        const updated = await operations.news.writeNewsWithConfig(
          {
            ...connection,
            newsId: input.content.id,
            news: { title: current.title, publishedAt: current.publishedAt },
            forceCreate: false,
            dataProviderId: input.targetDataProviderId,
          },
          config
        );
        confirmedTargetDataProviderId = updated.dataProvider?.id;
        break;
      }
      case 'event': {
        const current = await operations.event.getEventWithConfig(
          { ...connection, eventId: input.content.id },
          config
        );
        assertProvider({
          actualDataProviderId: current.dataProvider?.id,
          expectedDataProviderId: input.expectedSourceDataProviderId,
          phase: 'source',
        });
        const updated = await operations.event.writeEventWithConfig(
          {
            ...connection,
            eventId: input.content.id,
            event: { title: current.title },
            forceCreate: false,
            dataProviderId: input.targetDataProviderId,
          },
          config
        );
        confirmedTargetDataProviderId = updated.dataProvider?.id;
        break;
      }
      case 'poi': {
        const current = await operations.poi.getPoiWithConfig(
          { ...connection, poiId: input.content.id },
          config
        );
        assertProvider({
          actualDataProviderId: current.dataProvider?.id,
          expectedDataProviderId: input.expectedSourceDataProviderId,
          phase: 'source',
        });
        const updated = await operations.poi.writePoiWithConfig(
          {
            ...connection,
            poiId: input.content.id,
            poi: { name: current.name },
            forceCreate: false,
            dataProviderId: input.targetDataProviderId,
          },
          config
        );
        confirmedTargetDataProviderId = updated.dataProvider?.id;
        break;
      }
      case 'generic-item': {
        const current = await operations.genericItem.getGenericItemWithConfig(
          { ...connection, genericItemId: input.content.id },
          config
        );
        assertProvider({
          actualDataProviderId: current.dataProvider?.id,
          expectedDataProviderId: input.expectedSourceDataProviderId,
          phase: 'source',
        });
        const updated = await operations.genericItem.writeGenericItemWithConfig(
          {
            ...connection,
            genericItemId: input.content.id,
            genericItem: { title: current.title, genericType: current.genericType },
            forceCreate: false,
            dataProviderId: input.targetDataProviderId,
          },
          config
        );
        confirmedTargetDataProviderId = updated.dataProvider?.id;
        break;
      }
    }

    assertProvider({
      actualDataProviderId: confirmedTargetDataProviderId,
      expectedDataProviderId: input.targetDataProviderId,
      phase: 'target',
    });

    return {
      contentType: input.content.type,
      contentId: input.content.id,
      sourceDataProviderId: input.expectedSourceDataProviderId,
      targetDataProviderId: input.targetDataProviderId,
    };
  };
