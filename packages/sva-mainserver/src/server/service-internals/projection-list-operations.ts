import type {
  SvaMainserverConnectionInput,
  SvaMainserverInstanceConfig,
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

const mapItem = (
  value: unknown,
  contentType: SvaMainserverProjectionContentType,
  titleField: 'title' | 'name'
): SvaMainserverProjectionListItem | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as RawItem;
  const id = stringValue(source.id);
  if (!id) return null;
  const createdAt = stringValue(source.createdAt) ?? stringValue(source.updatedAt) ?? new Date(0).toISOString();
  const updatedAt = stringValue(source.updatedAt) ?? createdAt;
  const title = localizedTitle(source[titleField]) ?? id;
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
  'news.article': { document: svaMainserverNewsProjectionListDocument, operationName: 'SvaMainserverNewsProjectionList', responseField: 'newsItems', contentType: 'news.article', titleField: 'title', order: 'updatedAt_DESC', paginated: true },
  'events.event-record': { document: svaMainserverEventProjectionListDocument, operationName: 'SvaMainserverEventProjectionList', responseField: 'eventRecords', contentType: 'events.event-record', titleField: 'title', order: 'updatedAt_DESC', paginated: true },
  'poi.point-of-interest': { document: svaMainserverPoiProjectionListDocument, operationName: 'SvaMainserverPoiProjectionList', responseField: 'pointsOfInterest', contentType: 'poi.point-of-interest', titleField: 'name', order: 'updatedAt_DESC', paginated: true },
  'generic-items.generic-item': { document: svaMainserverGenericItemProjectionListDocument, operationName: 'SvaMainserverGenericItemProjectionList', responseField: 'genericItems', contentType: 'generic-items.generic-item', titleField: 'title', order: 'updatedAt_DESC', paginated: true },
  'faq.faq': { document: svaMainserverGenericItemProjectionListDocument, operationName: 'SvaMainserverGenericItemProjectionList', responseField: 'genericItems', contentType: 'faq.faq', titleField: 'title', order: 'updatedAt_DESC', paginated: true },
  'surveys.survey': { document: svaMainserverSurveyProjectionListDocument, operationName: 'SvaMainserverSurveyProjectionList', responseField: 'surveys', contentType: 'surveys.survey', titleField: 'title', order: 'updatedAt_DESC', paginated: false },
};

export const createProjectionListOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  listProjectionWithConfig: async (
    contentType: SvaMainserverProjectionContentType,
    input: SvaMainserverConnectionInput & SvaMainserverListQuery,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverProjectionListResult> => {
    const definition = definitions[contentType];
    const query = normalizeVisibleListQuery(input);
    const response = await executeGraphqlWithConfig<Record<string, unknown>>(
      {
        ...input,
        document: definition.document,
        operationName: definition.operationName,
        variables: definition.paginated
          ? { limit: query.pageSize + 1, skip: (query.page - 1) * query.pageSize, order: definition.order }
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
    const rawItems: readonly unknown[] = upstreamPageItems.filter((item) => {
      if (contentType !== 'faq.faq' && contentType !== 'generic-items.generic-item') {
        return true;
      }
      const isFaq =
        item !== null &&
        typeof item === 'object' &&
        (item as Record<string, unknown>).genericType === 'FAQ';
      return contentType === 'faq.faq' ? isFaq : !isFaq;
    });
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
