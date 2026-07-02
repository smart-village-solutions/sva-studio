import type {
  SvaMainserverConnectionInput,
  SvaMainserverEventInput,
  SvaMainserverEventItem,
  SvaMainserverInstanceConfig,
  SvaMainserverListResult,
} from '../../types.js';
import {
  svaMainserverCreateEventDocument,
  svaMainserverDestroyRecordDocument,
  svaMainserverEventDetailDocument,
  svaMainserverEventListDocument,
  type SvaMainserverCreateEventMutation,
  type SvaMainserverDestroyRecordMutation,
  type SvaMainserverEventDetailQuery,
  type SvaMainserverEventFragment,
  type SvaMainserverEventListQuery,
} from '../../generated/events-poi.js';

import { mapEventItem, mapOptionalEventItem } from './event-mappers.js';
import { toSvaMainserverError, type GraphqlExecutor, type SvaMainserverListInput } from './shared.js';
import { listVisibleRecordsWithConfig } from './visible-list.js';

const buildEventMutationVariables = (input: {
  readonly event: SvaMainserverEventInput;
  readonly eventId?: string;
  readonly forceCreate?: boolean;
}) => ({
  ...(input.eventId ? { id: input.eventId } : {}),
  ...(input.forceCreate === undefined ? {} : { forceCreate: input.forceCreate }),
  title: input.event.title,
  ...(input.eventId ? {} : { pushNotification: input.event.pushNotification ?? false }),
  ...(input.event.parentId === undefined ? {} : { parentId: input.event.parentId }),
  ...(input.event.keywords ? { keywords: input.event.keywords } : {}),
  ...(input.event.description ? { description: input.event.description } : {}),
  ...(input.event.externalId ? { externalId: input.event.externalId } : {}),
  ...(input.event.dates ? { dates: input.event.dates } : {}),
  ...(input.event.repeat === undefined ? {} : { repeat: input.event.repeat }),
  ...(input.event.repeatDuration ? { repeatDuration: input.event.repeatDuration } : {}),
  ...(input.event.categoryName ? { categoryName: input.event.categoryName } : {}),
  ...(input.event.categories ? { categories: input.event.categories } : {}),
  ...(input.event.addresses ? { addresses: input.event.addresses } : {}),
  ...(input.event.location ? { location: input.event.location } : {}),
  ...(input.event.contacts ? { contacts: input.event.contacts } : {}),
  ...(input.event.urls ? { urls: input.event.urls } : {}),
  ...(input.event.mediaContents ? { mediaContents: input.event.mediaContents } : {}),
  ...(input.event.organizer ? { organizer: input.event.organizer } : {}),
  ...(input.event.priceInformations ? { priceInformations: input.event.priceInformations } : {}),
  ...(input.event.accessibilityInformation ? { accessibilityInformation: input.event.accessibilityInformation } : {}),
  ...(input.event.tags ? { tags: input.event.tags } : {}),
  ...(input.event.recurring ? { recurring: input.event.recurring } : {}),
  ...(input.event.recurringWeekdays ? { recurringWeekdays: input.event.recurringWeekdays } : {}),
  ...(input.event.recurringType ? { recurringType: input.event.recurringType } : {}),
  ...(input.event.recurringInterval ? { recurringInterval: input.event.recurringInterval } : {}),
  ...(input.event.pointOfInterestId ? { pointOfInterestId: input.event.pointOfInterestId } : {}),
});

export const createEventOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  listEventsWithConfig: async (
    input: SvaMainserverListInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverListResult<SvaMainserverEventItem>> =>
    listVisibleRecordsWithConfig<SvaMainserverEventListQuery, SvaMainserverEventFragment, SvaMainserverEventItem>(
      input,
      config,
      executeGraphqlWithConfig,
      {
        document: svaMainserverEventListDocument,
        operationName: 'SvaMainserverEventList',
        order: 'updatedAt_DESC',
        readItems: (response) => response.eventRecords ?? [],
        isVisible: (item) => input.includeInvisible === true || item.visible !== false,
        mapItem: mapEventItem,
      }
    ),

  getEventWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly eventId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverEventItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverEventDetailQuery>(
      {
        ...input,
        document: svaMainserverEventDetailDocument,
        operationName: 'SvaMainserverEventDetail',
        variables: { id: input.eventId },
      },
      config
    );

    return mapOptionalEventItem(response.eventRecord);
  },

  writeEventWithConfig: async (
    input: SvaMainserverConnectionInput & {
      readonly event: SvaMainserverEventInput;
      readonly eventId?: string;
      readonly forceCreate?: boolean;
    },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverEventItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverCreateEventMutation>(
      {
        ...input,
        document: svaMainserverCreateEventDocument,
        operationName: 'SvaMainserverCreateEvent',
        variables: buildEventMutationVariables(input),
      },
      config
    );

    return mapOptionalEventItem(response.createEventRecord);
  },

  destroyEventWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly eventId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<{ readonly id: string }> => {
    const response = await executeGraphqlWithConfig<SvaMainserverDestroyRecordMutation>(
      {
        ...input,
        document: svaMainserverDestroyRecordDocument,
        operationName: 'SvaMainserverDestroyRecord',
        variables: { id: input.eventId, recordType: 'EventRecord' },
      },
      config
    );

    if (!response.destroyRecord || (response.destroyRecord.statusCode ?? 200) >= 400) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte das Event nicht löschen.',
        statusCode: 502,
      });
    }

    return { id: input.eventId };
  },
});
