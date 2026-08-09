import type {
  SvaMainserverConnectionInput,
  SvaMainserverInstanceConfig,
  SvaMainserverGenericTypeOwnership,
  SvaMainserverListQuery,
  SvaMainserverProjectionContentType,
  SvaMainserverProjectionListItem,
  SvaMainserverProjectionListResult,
} from '../../types.js';
import {
  svaMainserverEventProjectionListDocument,
  svaMainserverGenericItemProjectionListDocument,
  svaMainserverNewsProjectionListDocument,
  svaMainserverPoiProjectionListDocument,
  svaMainserverSurveyProjectionListDocument,
} from '../../generated/projection-lists.js';
import { normalizeVisibleListQuery, type GraphqlExecutor } from './shared.js';

type RawItem = Record<string, unknown>;

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const localizedTitle = (value: unknown): string | undefined => {
  if (typeof value === 'string') return stringValue(value);
  if (!value || typeof value !== 'object') return undefined;
  for (const candidate of Object.values(value)) {
    const title = stringValue(candidate);
    if (title) return title;
  }
  return undefined;
};

const mapProvider = (value: unknown): SvaMainserverProjectionListItem['dataProvider'] => {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as RawItem;
  const id = stringValue(source.id);
  const name = stringValue(source.name);
  return id || name ? { ...(id ? { id } : {}), ...(name ? { name } : {}) } : undefined;
};

const firstContentBlockTitle = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return undefined;
  const firstBlock = value[0];
  if (!firstBlock || typeof firstBlock !== 'object') return undefined;
  return localizedTitle((firstBlock as RawItem).title);
};

const resolveTitle = (
  source: RawItem,
  contentType: SvaMainserverProjectionContentType,
  titleField: 'title' | 'name'
): string | undefined =>
  localizedTitle(source[titleField]) ??
  (contentType === 'news.article' ? firstContentBlockTitle(source.contentBlocks) : undefined);

const mapItem = (
  value: unknown,
  contentType: SvaMainserverProjectionContentType,
  titleField: 'title' | 'name'
): SvaMainserverProjectionListItem | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as RawItem;
  const id = stringValue(source.id);
  if (!id) return null;
  const createdAt =
    stringValue(source.createdAt) ?? stringValue(source.updatedAt) ?? new Date(0).toISOString();
  const updatedAt = stringValue(source.updatedAt) ?? createdAt;
  const title = resolveTitle(source, contentType, titleField) ?? id;
  const publication = stringValue(source.publishedAt) ?? stringValue(source.publicationDate);
  const provider = mapProvider(source.dataProvider);
  return {
    id,
    contentType,
    title,
    createdAt,
    updatedAt,
    ...(stringValue(source.author) ? { author: stringValue(source.author) } : {}),
    ...(publication ? { publishedAt: publication } : {}),
    ...(typeof source.visible === 'boolean' ? { visible: source.visible } : {}),
    ...(typeof source.active === 'boolean' ? { active: source.active } : {}),
    ...(stringValue(source.status) ? { status: stringValue(source.status) } : {}),
    ...(provider ? { dataProvider: provider } : {}),
  };
};

type ProjectionDefinition = Readonly<{
  document: string;
  operationName: string;
  responseField: string;
  contentType: SvaMainserverProjectionContentType;
  titleField: 'title' | 'name';
  order: string;
  paginated: boolean;
}>;

const definitions: Record<SvaMainserverProjectionContentType, ProjectionDefinition> = {
  'news.article': {
    document: svaMainserverNewsProjectionListDocument,
    operationName: 'SvaMainserverNewsProjectionList',
    responseField: 'newsItems',
    contentType: 'news.article',
    titleField: 'title',
    order: 'updatedAt_DESC',
    paginated: true,
  },
  'events.event-record': {
    document: svaMainserverEventProjectionListDocument,
    operationName: 'SvaMainserverEventProjectionList',
    responseField: 'eventRecords',
    contentType: 'events.event-record',
    titleField: 'title',
    order: 'updatedAt_DESC',
    paginated: true,
  },
  'poi.point-of-interest': {
    document: svaMainserverPoiProjectionListDocument,
    operationName: 'SvaMainserverPoiProjectionList',
    responseField: 'pointsOfInterest',
    contentType: 'poi.point-of-interest',
    titleField: 'name',
    order: 'updatedAt_DESC',
    paginated: true,
  },
  'generic-items.generic-item': {
    document: svaMainserverGenericItemProjectionListDocument,
    operationName: 'SvaMainserverGenericItemProjectionList',
    responseField: 'genericItems',
    contentType: 'generic-items.generic-item',
    titleField: 'title',
    order: 'updatedAt_DESC',
    paginated: true,
  },
  'faq.faq': {
    document: svaMainserverGenericItemProjectionListDocument,
    operationName: 'SvaMainserverGenericItemProjectionList',
    responseField: 'genericItems',
    contentType: 'faq.faq',
    titleField: 'title',
    order: 'updatedAt_DESC',
    paginated: true,
  },
  'cockpit-cards.cockpit-card': {
    document: svaMainserverGenericItemProjectionListDocument,
    operationName: 'SvaMainserverGenericItemProjectionList',
    responseField: 'genericItems',
    contentType: 'cockpit-cards.cockpit-card',
    titleField: 'title',
    order: 'updatedAt_DESC',
    paginated: true,
  },
  'projects.project': {
    document: svaMainserverGenericItemProjectionListDocument,
    operationName: 'SvaMainserverGenericItemProjectionList',
    responseField: 'genericItems',
    contentType: 'projects.project',
    titleField: 'title',
    order: 'updatedAt_DESC',
    paginated: true,
  },
  'surveys.survey': {
    document: svaMainserverSurveyProjectionListDocument,
    operationName: 'SvaMainserverSurveyProjectionList',
    responseField: 'surveys',
    contentType: 'surveys.survey',
    titleField: 'title',
    order: 'updatedAt_DESC',
    paginated: false,
  },
};

const matchesProjectionContentType = (
  item: unknown,
  contentType: SvaMainserverProjectionContentType,
  genericTypeOwnership: SvaMainserverGenericTypeOwnership
): boolean => {
  const isGenericItemProjection = definitions[contentType].responseField === 'genericItems';
  if (!isGenericItemProjection) return true;
  if (item === null || typeof item !== 'object') return false;
  const record = item as Record<string, unknown>;
  if (typeof record.genericType !== 'string') return false;
  const resolvedContentType =
    genericTypeOwnership[record.genericType] ?? 'generic-items.generic-item';
  if (resolvedContentType !== contentType) return false;
  if (contentType !== 'projects.project') return true;
  const payload = record.payload;
  return !(
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    (payload as Record<string, unknown>).deleted === true
  );
};

const MAX_GENERIC_ITEM_PROJECTION_SCAN_ITEMS = 5_000;
const loadPaginatedProjectionItems = async (input: {
  executeGraphqlWithConfig: GraphqlExecutor;
  definition: ProjectionDefinition;
  connectionInput: SvaMainserverConnectionInput & SvaMainserverListQuery;
  config: SvaMainserverInstanceConfig;
  page: number;
  pageSize: number;
  genericTypeOwnership: SvaMainserverGenericTypeOwnership;
}): Promise<Readonly<{ items: readonly unknown[]; hasNextPage: boolean }>> => {
  const requestedEnd = input.page * input.pageSize + 1;
  const requestedStart = (input.page - 1) * input.pageSize;
  const requestLimit = input.pageSize + 1;
  const matchingItems: unknown[] = [];
  let upstreamSkip = 0;

  while (matchingItems.length < requestedEnd) {
    const response = await input.executeGraphqlWithConfig<Record<string, unknown>>(
      {
        ...input.connectionInput,
        document: input.definition.document,
        operationName: input.definition.operationName,
        variables: {
          limit: requestLimit,
          skip: upstreamSkip,
          order: input.definition.order,
        },
      },
      input.config
    );
    const responseItems = response[input.definition.responseField];
    if (!Array.isArray(responseItems)) {
      throw new Error(`Invalid projection page structure for ${input.definition.responseField}.`);
    }
    matchingItems.push(
      ...responseItems.filter((item) =>
        matchesProjectionContentType(item, input.definition.contentType, input.genericTypeOwnership)
      )
    );
    upstreamSkip += responseItems.length;
    if (responseItems.length < requestLimit) break;
    if (matchingItems.length >= requestedEnd) break;
    if (upstreamSkip >= MAX_GENERIC_ITEM_PROJECTION_SCAN_ITEMS) {
      throw new Error(
        `GenericItem projection scan limit exceeded for ${input.definition.contentType}.`
      );
    }
  }
  const requestedItems = matchingItems.slice(requestedStart, requestedEnd);
  return {
    items: requestedItems.slice(0, input.pageSize),
    hasNextPage: requestedItems.length > input.pageSize,
  };
};

export const createProjectionListOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  listProjectionWithConfig: async (
    contentType: SvaMainserverProjectionContentType,
    input: SvaMainserverConnectionInput & SvaMainserverListQuery,
    config: SvaMainserverInstanceConfig,
    genericTypeOwnership: SvaMainserverGenericTypeOwnership
  ): Promise<SvaMainserverProjectionListResult> => {
    const definition = definitions[contentType];
    const query = normalizeVisibleListQuery(input);
    if (definition.paginated && definition.responseField === 'genericItems') {
      const page = await loadPaginatedProjectionItems({
        executeGraphqlWithConfig,
        definition,
        connectionInput: input,
        config,
        page: query.page,
        pageSize: query.pageSize,
        genericTypeOwnership,
      });
      const mapped = page.items.map((item) => mapItem(item, contentType, definition.titleField));
      const skippedInvalidCount = mapped.filter((item) => item === null).length;
      return {
        data: mapped.filter((item): item is SvaMainserverProjectionListItem => item !== null),
        skippedInvalidCount,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          hasNextPage: page.hasNextPage,
        },
      };
    }
    const response = await executeGraphqlWithConfig<Record<string, unknown>>(
      {
        ...input,
        document: definition.document,
        operationName: definition.operationName,
        variables: definition.paginated
          ? {
              limit: query.pageSize + 1,
              skip: (query.page - 1) * query.pageSize,
              order: definition.order,
            }
          : { archived: true, order: definition.order },
      },
      config
    );
    const responseItems = response[definition.responseField];
    if (!Array.isArray(responseItems)) {
      throw new Error(`Invalid projection page structure for ${definition.responseField}.`);
    }
    const upstreamPageItems = definition.paginated
      ? responseItems.slice(0, query.pageSize)
      : responseItems;
    const rawItems: readonly unknown[] = upstreamPageItems;
    const mapped = rawItems.map((item) => mapItem(item, contentType, definition.titleField));
    const skippedInvalidCount = mapped.filter((item) => item === null).length;
    const data = mapped.filter((item): item is SvaMainserverProjectionListItem => item !== null);
    const pageData = definition.paginated ? data.slice(0, query.pageSize) : data;
    return {
      data: pageData,
      skippedInvalidCount,
      pagination: {
        page: query.page,
        pageSize: definition.paginated ? query.pageSize : Math.max(1, data.length),
        hasNextPage: definition.paginated && responseItems.length > query.pageSize,
        ...(!definition.paginated ? { total: data.length } : {}),
      },
    };
  },
});
