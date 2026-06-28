import type {
  ContentJsonValue,
  IamContentAccessSummary,
  IamContentListItem,
} from '@sva/core';
import type { EffectivePermission } from '@sva/iam-core';

type MainserverDataProvider = Readonly<{
  id?: string;
  name?: string;
}>;

type MainserverNewsItem = Readonly<{
  id: string;
  contentType: string;
  title?: string;
  contentBlocks?: readonly Readonly<{ title?: string }>[];
  author: string;
  payload?: unknown;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  dataProvider?: MainserverDataProvider;
}>;

type MainserverEventItem = Readonly<{
  id: string;
  contentType: string;
  title?: string;
  description?: string;
  categoryName?: string;
  dates?: unknown;
  addresses?: unknown;
  contacts?: unknown;
  urls?: unknown;
  tags?: unknown;
  pointOfInterestId?: string;
  createdAt: string;
  updatedAt: string;
}>;

type MainserverPoiItem = Readonly<{
  id: string;
  contentType: string;
  name?: string;
  description?: string;
  mobileDescription?: string;
  active?: boolean;
  categoryName?: string;
  payload?: unknown;
  addresses?: unknown;
  contact?: unknown;
  openingHours?: unknown;
  webUrls?: unknown;
  tags?: unknown;
  createdAt: string;
  updatedAt: string;
}>;

const normalizeTitle = (value: string | undefined, fallback: string): string => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
};

const toContentJsonValue = (value: unknown): ContentJsonValue =>
  JSON.parse(JSON.stringify(value ?? null)) as ContentJsonValue;

const deriveNamespacedAction = (
  contentType: string,
  action: 'create' | 'update'
): string | null => {
  const namespace = contentType.split('.')[0]?.trim();
  return namespace ? `${namespace}.${action}` : null;
};

type PermissionView = Pick<EffectivePermission, 'action'>;

const hasAllowedAction = (permissions: readonly PermissionView[], action: string): boolean =>
  permissions.some((permission) => permission.action === action);

const createMainserverItemAccess = (
  contentType: string,
  permissions: readonly PermissionView[]
): IamContentAccessSummary => {
  const updateAction = deriveNamespacedAction(contentType, 'update');
  const createAction = deriveNamespacedAction(contentType, 'create');
  const canUpdate = updateAction ? hasAllowedAction(permissions, updateAction) : false;
  const canCreate = createAction ? hasAllowedAction(permissions, createAction) : false;

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

const resolveNewsTitle = (item: MainserverNewsItem): string =>
  normalizeTitle(item.title, normalizeTitle(item.contentBlocks?.[0]?.title, item.id));

export const mapNewsItem = (
  item: MainserverNewsItem,
  instanceId: string,
  permissions: readonly PermissionView[]
): IamContentListItem => ({
  id: item.id,
  instanceId,
  contentType: item.contentType,
  title: resolveNewsTitle(item),
  createdAt: item.createdAt,
  createdBy: item.author,
  updatedAt: item.updatedAt,
  updatedBy: item.author,
  authorDisplayMode: 'organization',
  author: item.author,
  ...(item.dataProvider?.id ? { sourceDataProviderId: item.dataProvider.id } : {}),
  ...(item.dataProvider?.name ? { sourceDataProviderName: item.dataProvider.name } : {}),
  payload: toContentJsonValue(item.payload),
  status: 'published',
  validationState: 'valid',
  historyRef: `mainserver:news:${item.id}`,
  publishedAt: item.publishedAt,
  access: createMainserverItemAccess(item.contentType, permissions),
});

export const mapEventItem = (
  item: MainserverEventItem,
  instanceId: string,
  permissions: readonly PermissionView[]
): IamContentListItem => ({
  id: item.id,
  instanceId,
  contentType: item.contentType,
  title: normalizeTitle(item.title, item.id),
  createdAt: item.createdAt,
  createdBy: 'mainserver',
  updatedAt: item.updatedAt,
  updatedBy: 'mainserver',
  authorDisplayMode: 'organization',
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
  access: createMainserverItemAccess(item.contentType, permissions),
});

export const mapPoiItem = (
  item: MainserverPoiItem,
  instanceId: string,
  permissions: readonly PermissionView[]
): IamContentListItem => ({
  id: item.id,
  instanceId,
  contentType: item.contentType,
  title: normalizeTitle(item.name, item.id),
  createdAt: item.createdAt,
  createdBy: 'mainserver',
  updatedAt: item.updatedAt,
  updatedBy: 'mainserver',
  authorDisplayMode: 'organization',
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
  access: createMainserverItemAccess(item.contentType, permissions),
});
