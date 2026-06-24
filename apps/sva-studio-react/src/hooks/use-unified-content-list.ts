import type {
  ApiPagination,
  ContentJsonValue,
  IamContentAccessSummary,
  IamContentListItem,
  IamContentListQuery,
} from '@sva/core';
import { listEvents, type EventContentItem } from '@sva/plugin-events';
import { listNews, type NewsContentItem } from '@sva/plugin-news';
import { listPoi, type PoiContentItem } from '@sva/plugin-poi';
import React from 'react';

import type { IamHttpError } from '../lib/iam-api';

type UnifiedContentListResult = {
  readonly contents: readonly IamContentListItem[];
  readonly pagination: ApiPagination;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly refetch: () => Promise<void>;
  readonly supportsBulkActions: boolean;
};

const MAINSERVER_FETCH_PAGE_SIZE = 100;

const studioContentTypeIds = ['news.article', 'events.event-record', 'poi.point-of-interest'] as const;

const toSearchableText = (item: IamContentListItem): string =>
  [item.title, item.contentType, item.author, JSON.stringify(item.payload)]
    .join(' ')
    .toLowerCase();

const normalizeTitle = (value: string | undefined, fallback: string): string => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
};

const resolveNewsTitle = (item: NewsContentItem): string =>
  normalizeTitle(item.title, normalizeTitle(item.contentBlocks?.[0]?.title, item.id));

const deriveUpdateAction = (contentType: string): string | null => {
  const namespace = contentType.split('.')[0]?.trim();
  return namespace ? `${namespace}.update` : null;
};

const deriveCreateAction = (contentType: string): string | null => {
  const namespace = contentType.split('.')[0]?.trim();
  return namespace ? `${namespace}.create` : null;
};

const createMainserverItemAccess = (
  contentType: string,
  permissionActions: readonly string[]
): IamContentAccessSummary => {
  const updateAction = deriveUpdateAction(contentType);
  const createAction = deriveCreateAction(contentType);
  const canUpdate = updateAction ? permissionActions.includes(updateAction) : false;
  const canCreate = createAction ? permissionActions.includes(createAction) : false;

  return canUpdate
    ? {
        state: 'editable',
        canRead: true,
        canCreate,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: [],
      }
    : {
        state: 'read_only',
        canRead: true,
        canCreate,
        canUpdate: false,
        reasonCode: 'content_update_missing',
        organizationIds: [],
        sourceKinds: [],
      };
};

const toContentJsonValue = (value: unknown): ContentJsonValue =>
  JSON.parse(JSON.stringify(value ?? null)) as ContentJsonValue;

const mapNewsItem = (
  item: NewsContentItem,
  instanceId: string,
  permissionActions: readonly string[]
): IamContentListItem => ({
  id: item.id,
  instanceId,
  contentType: item.contentType,
  title: resolveNewsTitle(item),
  createdAt: item.createdAt,
  createdBy: item.author,
  updatedAt: item.updatedAt,
  updatedBy: item.author,
  author: item.author,
  payload: toContentJsonValue(item.payload),
  status: 'published',
  validationState: 'valid',
  historyRef: `mainserver:news:${item.id}`,
  publishedAt: item.publishedAt,
  access: createMainserverItemAccess(item.contentType, permissionActions),
});

const mapEventItem = (
  item: EventContentItem,
  instanceId: string,
  permissionActions: readonly string[]
): IamContentListItem => ({
  id: item.id,
  instanceId,
  contentType: item.contentType,
  title: normalizeTitle(item.title, item.id),
  createdAt: item.createdAt,
  createdBy: 'mainserver',
  updatedAt: item.updatedAt,
  updatedBy: 'mainserver',
  author: 'mainserver',
  payload: toContentJsonValue({
    description: item.description,
    categoryName: item.categoryName,
    dates: item.dates,
    addresses: item.addresses,
    contacts: item.contacts,
    urls: item.urls,
    tags: item.tags,
    pointOfInterestId: item.pointOfInterestId,
  }),
  status: 'published',
  validationState: 'valid',
  historyRef: `mainserver:events:${item.id}`,
  access: createMainserverItemAccess(item.contentType, permissionActions),
});

const mapPoiItem = (
  item: PoiContentItem,
  instanceId: string,
  permissionActions: readonly string[]
): IamContentListItem => ({
  id: item.id,
  instanceId,
  contentType: item.contentType,
  title: normalizeTitle(item.name, item.id),
  createdAt: item.createdAt,
  createdBy: 'mainserver',
  updatedAt: item.updatedAt,
  updatedBy: 'mainserver',
  author: 'mainserver',
  payload: toContentJsonValue({
    description: item.description,
    mobileDescription: item.mobileDescription,
    active: item.active,
    categoryName: item.categoryName,
    payload: item.payload,
    addresses: item.addresses,
    contact: item.contact,
    openingHours: item.openingHours,
    webUrls: item.webUrls,
    tags: item.tags,
  }),
  status: 'published',
  validationState: 'valid',
  historyRef: `mainserver:poi:${item.id}`,
  access: createMainserverItemAccess(item.contentType, permissionActions),
});

const compareItemsBySortField = (
  left: IamContentListItem,
  right: IamContentListItem,
  sortBy: IamContentListQuery['sortBy'],
  collator: Intl.Collator
): number => {
  switch (sortBy) {
    case 'contentType':
      return collator.compare(left.contentType, right.contentType);
    case 'title':
      return collator.compare(left.title, right.title);
    case 'status':
      return collator.compare(left.status, right.status);
    default:
      return collator.compare(left.updatedAt, right.updatedAt);
  }
};

const sortItems = (
  items: readonly IamContentListItem[],
  sortBy: IamContentListQuery['sortBy'],
  sortDirection: IamContentListQuery['sortDirection']
): readonly IamContentListItem[] => {
  const direction = sortDirection === 'asc' ? 1 : -1;
  const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

  return [...items].sort((left, right) => {
    const result = compareItemsBySortField(left, right, sortBy, collator);

    if (result !== 0) {
      return result * direction;
    }

    return collator.compare(left.id, right.id) * direction;
  });
};

const filterItems = (items: readonly IamContentListItem[], query: IamContentListQuery): readonly IamContentListItem[] => {
  const normalizedSearch = query.q?.trim().toLowerCase();

  return items.filter((item) => {
    if (query.type && item.contentType !== query.type) {
      return false;
    }
    if (query.status && item.status !== query.status) {
      return false;
    }
    if (normalizedSearch && !toSearchableText(item).includes(normalizedSearch)) {
      return false;
    }
    return true;
  });
};

const paginateItems = (items: readonly IamContentListItem[], page: number, pageSize: number): readonly IamContentListItem[] => {
  const offset = Math.max(0, (page - 1) * pageSize);
  return items.slice(offset, offset + pageSize);
};

const fetchAllPages = async <TItem>(
  loadPage: (query: { readonly page: number; readonly pageSize: number }) => Promise<{
    readonly data: readonly TItem[];
    readonly pagination: { readonly hasNextPage: boolean };
  }>
): Promise<readonly TItem[]> => {
  const items: TItem[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await loadPage({ page, pageSize: MAINSERVER_FETCH_PAGE_SIZE });
    items.push(...response.data);
    hasNextPage = response.pagination.hasNextPage;
    page += 1;
  }

  return items;
};

const loadItemsForContentType = async (
  contentType: (typeof studioContentTypeIds)[number],
  instanceId: string,
  permissionActions: readonly string[]
): Promise<readonly IamContentListItem[]> => {
  switch (contentType) {
    case 'news.article':
      return (await fetchAllPages(listNews)).map((item) => mapNewsItem(item, instanceId, permissionActions));
    case 'events.event-record':
      return (await fetchAllPages(listEvents)).map((item) => mapEventItem(item, instanceId, permissionActions));
    case 'poi.point-of-interest':
      return (await fetchAllPages(listPoi)).map((item) => mapPoiItem(item, instanceId, permissionActions));
  }
};

const toIamHttpError = (error: unknown): IamHttpError =>
  ({
    name: 'IamHttpError',
    message: error instanceof Error ? error.message : String(error),
    status: 500,
    code: 'internal_error',
  }) as IamHttpError;

export const useUnifiedContentList = (
  query: IamContentListQuery,
  visibleTypes: readonly string[],
  instanceId: string,
  permissionActions: readonly string[] = []
): UnifiedContentListResult => {
  const [sourceContents, setSourceContents] = React.useState<readonly IamContentListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<IamHttpError | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);
  const cacheRef = React.useRef(new Map<string, readonly IamContentListItem[]>());

  const normalizedVisibleTypes = React.useMemo(
    () =>
      studioContentTypeIds.filter((contentType) =>
        visibleTypes.includes(contentType) && (!query.type || query.type === contentType)
      ),
    [query.type, visibleTypes]
  );
  const permissionActionsKey = React.useMemo(
    () => [...permissionActions].sort((left, right) => left.localeCompare(right)).join('|'),
    [permissionActions]
  );
  const fetchCacheKey = React.useMemo(
    () => [instanceId, normalizedVisibleTypes.join('|'), permissionActionsKey].join('::'),
    [instanceId, normalizedVisibleTypes, permissionActionsKey]
  );
  const unsupportedStatusFilter = Boolean(query.status && query.status !== 'published');

  const refetch = React.useCallback(async () => {
    cacheRef.current.delete(fetchCacheKey);
    setReloadToken((current) => current + 1);
  }, [fetchCacheKey]);

  React.useEffect(() => {
    let isActive = true;

    if (unsupportedStatusFilter) {
      setIsLoading(false);
      return;
    }

    const cachedContents = cacheRef.current.get(fetchCacheKey);
    if (cachedContents) {
      setSourceContents(cachedContents);
      setError(null);
      setIsLoading(false);
      return;
    }

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const sources = await Promise.all(
          normalizedVisibleTypes.map((contentType) => loadItemsForContentType(contentType, instanceId, permissionActions))
        );

        if (!isActive) {
          return;
        }

        const nextSourceContents = sources.flat();
        cacheRef.current.set(fetchCacheKey, nextSourceContents);
        setSourceContents(nextSourceContents);
      } catch (nextError) {
        if (!isActive) {
          return;
        }

        setSourceContents([]);
        setError(toIamHttpError(nextError));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [fetchCacheKey, instanceId, normalizedVisibleTypes, permissionActions, reloadToken, unsupportedStatusFilter]);

  const pagination = React.useMemo<ApiPagination>(() => {
    if (unsupportedStatusFilter) {
      return {
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
      };
    }

    const filteredItems = filterItems(sourceContents, query);
    const sortedItems = sortItems(filteredItems, query.sortBy, query.sortDirection);

    return {
      page: query.page,
      pageSize: query.pageSize,
      total: sortedItems.length,
    };
  }, [query, sourceContents, unsupportedStatusFilter]);

  const contents = React.useMemo(() => {
    if (unsupportedStatusFilter) {
      return [];
    }

    const filteredItems = filterItems(sourceContents, query);
    const sortedItems = sortItems(filteredItems, query.sortBy, query.sortDirection);
    return paginateItems(sortedItems, query.page, query.pageSize);
  }, [query, sourceContents, unsupportedStatusFilter]);

  return {
    contents,
    pagination,
    isLoading,
    error,
    refetch,
    supportsBulkActions: false,
  };
};
