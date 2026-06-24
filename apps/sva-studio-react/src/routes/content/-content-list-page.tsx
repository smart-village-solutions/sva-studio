import {
  withServerDeniedContentAccess,
  type IamContentAccessSummary,
  type IamContentListItem,
  type IamContentListQuery,
} from '@sva/core';
import { deleteEvent } from '@sva/plugin-events';
import { deleteNews } from '@sva/plugin-news';
import { deletePoi } from '@sva/plugin-poi';
import { IconEdit, IconEye, IconTrash, IconXboxX } from '@tabler/icons-react';
import { StudioDataTable, StudioListPageTemplate, type StudioBulkAction, type StudioColumnDef } from '@sva/studio-ui-react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import React from 'react';

import { createStudioDataTableLabels } from '../../components/studio-data-table-labels';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { useContents } from '../../hooks/use-contents';
import { useContentAccess } from '../../hooks/use-content-access';
import { t } from '../../i18n';
import { formatEditorDateTime } from '../../lib/editor-date-time';
import type { IamHttpError } from '../../lib/iam-api';
import type { IamContentListMetadata } from '../../lib/iam-api';
import { EMPTY_VISIBLE_TYPE_SENTINEL } from '../../lib/iam-content-list-api.shared';
import { studioContentTypes } from '../../lib/plugins';
import { useAuth } from '../../providers/auth-provider';
import {
  filterCreatableStudioContentTypes,
  filterRegisteredStudioContentItems,
} from '../../lib/studio-content-types';
import { appAdminResources } from '../../routing/admin-resources';

type StatusFilter = 'all' | 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
type SortDirection = 'asc' | 'desc';
type ContentListSortState = Readonly<{
  field: string;
  direction: SortDirection;
}>;
type RouteSearchState = Readonly<Record<string, unknown>>;
type ContentListRouteState = Readonly<{
  type: string;
  status: StatusFilter;
  page: number;
  pageSize: number;
  sort?: ContentListSortState;
}>;
type SortStateLike = Readonly<{
  field?: unknown;
  direction?: unknown;
}>;
type RegisteredContentRow = IamContentListItem & Readonly<{
  typeLabel: string;
  editPath: string;
}>;

const MAIN_SERVER_CONTENT_TYPES = new Set([
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
]);

const contentAdminResource = appAdminResources.find((resource) => resource.resourceId === 'content');
const contentListCapabilities = contentAdminResource?.capabilities?.list;
const contentPagination = contentListCapabilities?.pagination;
const contentSorting = contentListCapabilities?.sorting;
const contentStatusOptions = ['all', 'draft', 'in_review', 'approved', 'published', 'archived'] as const satisfies readonly StatusFilter[];

const contentErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('content.messages.loadError');
  }

  switch (error.code) {
    case 'forbidden':
      return t('content.errors.forbidden');
    case 'database_unavailable':
      return t('content.errors.databaseUnavailable');
    default:
      return t('content.messages.loadError');
  }
};

const formatDateTime = (value: string): string => formatEditorDateTime(value) ?? value;

const renderProjectionSyncMessage = (metadata: IamContentListMetadata): string | null => {
  if (metadata.mainserverSyncStates.length === 0) {
    return null;
  }

  const latestSucceededAt = metadata.mainserverSyncStates
    .map((entry) => entry.lastSucceededAt)
    .filter((value): value is string => typeof value === 'string')
    .sort((left, right) => right.localeCompare(left))[0];
  const latestErrorCode = metadata.mainserverSyncStates
    .map((entry) => entry.lastErrorCode)
    .find((value): value is string => typeof value === 'string' && value.length > 0);

  if (metadata.hasRunningMainserverSync && latestSucceededAt) {
    return t('content.sync.runningWithSnapshot', {
      value: formatDateTime(latestSucceededAt),
    });
  }

  if (metadata.hasRunningMainserverSync) {
    return t('content.sync.running');
  }

  if (metadata.hasStaleMainserverContent && latestSucceededAt && latestErrorCode) {
    return t('content.sync.staleWithError', {
      value: formatDateTime(latestSucceededAt),
      errorCode: latestErrorCode,
    });
  }

  if (metadata.hasStaleMainserverContent && latestSucceededAt) {
    return t('content.sync.stale', {
      value: formatDateTime(latestSucceededAt),
    });
  }

  if (latestSucceededAt) {
    return t('content.sync.fresh', {
      value: formatDateTime(latestSucceededAt),
    });
  }

  return null;
};

const resolveRowAccess = (
  access: IamContentAccessSummary | undefined,
  listError: IamHttpError | null
): IamContentAccessSummary => {
  if (access) {
    return access;
  }
  if (listError?.code === 'forbidden') {
    return withServerDeniedContentAccess(undefined);
  }
  return {
    state: 'read_only',
    canRead: true,
    canCreate: false,
    canUpdate: false,
    reasonCode: 'content_update_missing',
    organizationIds: [],
    sourceKinds: [],
  };
};

const statusVariantByValue = {
  draft: 'outline',
  in_review: 'secondary',
  approved: 'default',
  published: 'default',
  archived: 'destructive',
} as const;

const statusLabelKeyByValue = {
  draft: 'content.status.draft',
  in_review: 'content.status.inReview',
  approved: 'content.status.approved',
  published: 'content.status.published',
  archived: 'content.status.archived',
} as const;

const isStatusFilter = (value: unknown): value is StatusFilter =>
  typeof value === 'string' && contentStatusOptions.some((option) => option === value);

const normalizeTypeFilter = (value: unknown): string => {
  if (typeof value !== 'string') {
    return 'all';
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    return 'all';
  }

  return normalizedValue === 'all' || studioContentTypes.some((definition) => definition.contentType === normalizedValue)
    ? normalizedValue
    : 'all';
};

const asRouteSearchState = (value: unknown): RouteSearchState | undefined =>
  value && typeof value === 'object' ? (value as RouteSearchState) : undefined;

const normalizeStatusFilter = (value: unknown): StatusFilter => (isStatusFilter(value) ? value : 'all');

const normalizePositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
};

const normalizeSortState = (value: unknown): ContentListSortState | undefined => {
  const objectValue = asRouteSearchState(value) as SortStateLike | undefined;
  if (objectValue) {
    const field = typeof objectValue.field === 'string' ? objectValue.field : undefined;
    const direction = objectValue.direction;
    if (field && (direction === 'asc' || direction === 'desc')) {
      return { field, direction };
    }
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.startsWith('-')
      ? { field: value.slice(1), direction: 'desc' }
      : { field: value, direction: 'asc' };
  }

  return undefined;
};

const resolveFallbackSortState = (): ContentListSortState | undefined =>
  contentSorting
    ? {
        field: contentSorting.defaultField,
        direction: contentSorting.defaultDirection,
      }
    : undefined;

const resolveRouteSortState = (search: RouteSearchState): ContentListSortState | undefined => {
  const sortFromExplicitParams =
    typeof search.sortBy === 'string'
      ? normalizeSortState({
          field: search.sortBy,
          direction: search.sortDirection,
        })
      : undefined;

  return sortFromExplicitParams ?? normalizeSortState(search.sort) ?? normalizeSortState(search.sorting);
};

const readNormalizedRouteState = (search: RouteSearchState): ContentListRouteState => {
  const normalizedFilters = asRouteSearchState(search.filters);
  const pageSizeDefault = contentPagination?.defaultPageSize ?? 25;

  return {
    type: normalizeTypeFilter(normalizedFilters?.type ?? search.type),
    status: normalizeStatusFilter(normalizedFilters?.status ?? search.status),
    page: normalizePositiveInteger(search.page, 1),
    pageSize: normalizePositiveInteger(search.pageSize, pageSizeDefault),
    sort: resolveRouteSortState(search) ?? resolveFallbackSortState(),
  };
};

const serializeRouteState = (state: ContentListRouteState): RouteSearchState => ({
  ...(state.type !== 'all' ? { type: state.type } : {}),
  ...(state.status !== 'all' ? { status: state.status } : {}),
  ...(state.sort ? { sortBy: state.sort.field, sortDirection: state.sort.direction } : {}),
  page: state.page,
  pageSize: state.pageSize,
});

const updateRouteState = (
  current: RouteSearchState,
  next: Partial<ContentListRouteState>
): RouteSearchState => {
  const normalized = readNormalizedRouteState(current);
  return serializeRouteState({
    ...normalized,
    ...next,
  });
};

const resolveRowActionLabel = (access: IamContentAccessSummary): string => {
  if (access.canUpdate) {
    return t('content.actions.edit');
  }
  if (access.canRead) {
    return t('content.actions.openReadOnly');
  }
  return t('content.actions.blocked');
};

const deriveDeleteAction = (contentType: string): string | null => {
  const namespace = contentType.split('.')[0]?.trim();
  return namespace ? `${namespace}.delete` : null;
};

const canDeleteMainserverItem = (contentType: string, permissionActions: readonly string[] = []): boolean => {
  const deleteAction = deriveDeleteAction(contentType);
  return deleteAction ? permissionActions.includes(deleteAction) : false;
};

const deleteMainserverItem = async (contentType: string, contentId: string): Promise<void> => {
  if (contentType === 'news.article') {
    await deleteNews(contentId);
    return;
  }
  if (contentType === 'events.event-record') {
    await deleteEvent(contentId);
    return;
  }
  if (contentType === 'poi.point-of-interest') {
    await deletePoi(contentId);
  }
};

const resolveContentSortField = (routeSortField: string | undefined): IamContentListQuery['sortBy'] => {
  switch (routeSortField) {
    case 'contentType':
    case 'title':
    case 'status':
    case 'updatedAt':
      return routeSortField;
    default:
      return 'updatedAt';
  }
};

const isMainserverContentType = (contentType: string): boolean => MAIN_SERVER_CONTENT_TYPES.has(contentType);

const isBulkActionableContent = (item: RegisteredContentRow): boolean => !isMainserverContentType(item.contentType);

const buildBulkActionLabel = (actionLabelKey: 'content.actions.archive' | 'content.actions.delete'): string =>
  `${t(actionLabelKey)} (${t('content.bulk.scope.explicitIds')})`;

const resolveRowActionIcon = (access: IamContentAccessSummary): React.ReactNode => {
  if (access.canUpdate) {
    return <IconEdit aria-hidden="true" className="h-4 w-4" />;
  }
  if (access.canRead) {
    return <IconEye aria-hidden="true" className="h-4 w-4" />;
  }
  return <IconXboxX aria-hidden="true" className="h-4 w-4 text-destructive" />;
};

const ContentRowActions = ({
  item,
  listError,
  permissionActions,
  onDelete,
}: Readonly<{
  item: RegisteredContentRow;
  listError: IamHttpError | null;
  permissionActions: readonly string[] | undefined;
  onDelete: (contentType: string, contentId: string) => Promise<void>;
}>) => {
  const access = resolveRowAccess(item.access, listError);
  const actionLabel = resolveRowActionLabel(access);
  const canDelete = canDeleteMainserverItem(item.contentType, permissionActions);
  const actionIcon = resolveRowActionIcon(access);

  const handleDelete = () => {
    if (!canDelete || !window.confirm(t('content.actions.deleteConfirm'))) {
      return;
    }

    void onDelete(item.contentType, item.id).catch(() => undefined);
  };

  return (
    <>
      {access.canRead ? (
        <Button
          asChild
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
        >
          <Link to={item.editPath} aria-label={actionLabel}>
            {actionIcon}
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-destructive"
          aria-label={actionLabel}
          disabled
        >
          {actionIcon}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-destructive"
        aria-label={t('content.actions.delete')}
        disabled={!canDelete}
        onClick={handleDelete}
      >
        <IconTrash aria-hidden="true" className="h-4 w-4 text-destructive" />
      </Button>
    </>
  );
};

const ContentPaginationNav = ({
  page,
  pageCount,
  pageSize,
  total,
  currentCount,
  onPageChange,
}: Readonly<{
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  currentCount: number;
  onPageChange: (page: number) => void;
}>) => {
  const resultStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const resultEnd = total === 0 ? 0 : resultStart + Math.max(0, currentCount - 1);

  return (
    <nav
      aria-label={t('content.pagination.ariaLabel')}
      className="flex flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="space-y-1">
        <p aria-live="polite">
          {t('content.pagination.resultsLabel', { start: resultStart, end: resultEnd, total })}
        </p>
        <p aria-live="polite">
          {t('content.pagination.pageLabel', { page, total: pageCount })}
        </p>
      </div>
      <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
        {t('content.pagination.previous')}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={page >= pageCount} onClick={() => onPageChange(Math.min(pageCount, page + 1))}>
        {t('content.pagination.next')}
      </Button>
      </div>
    </nav>
  );
};

export const ContentListPage = () => {
  const studioDataTableLabels = createStudioDataTableLabels();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as RouteSearchState;
  const auth = useAuth();
  const contentAccessApi = useContentAccess();
  const routeState = readNormalizedRouteState(search);
  const routeSortField = routeState.sort?.field;
  const routeSortDirection = routeState.sort?.direction;
  const authPermissionActions = auth.user?.permissionActions ?? [];
  const authSessionPending = auth.isLoading || !auth.hasResolvedSession;
  const contentAccessPending =
    contentAccessApi.permissionActions.length === 0 &&
    contentAccessApi.access === null &&
    contentAccessApi.error === null;
  const contentListEnabled =
    !authSessionPending &&
    Boolean(auth.user) &&
    (!contentAccessPending || authPermissionActions.length > 0);
  const effectivePermissionActions = React.useMemo(
    () =>
      authSessionPending || contentAccessApi.isLoading || contentAccessPending
        ? authPermissionActions
        : contentAccessApi.permissionActions,
    [
      authPermissionActions,
      authSessionPending,
      contentAccessApi.isLoading,
      contentAccessApi.permissionActions,
      contentAccessApi.access,
      contentAccessApi.error,
      contentAccessPending,
    ]
  );
  const readableContentTypes = React.useMemo(
    () =>
      studioContentTypes.filter((definition) =>
        effectivePermissionActions.includes(definition.requiredReadAction)
      ),
    [effectivePermissionActions]
  );
  const visibleTypeSignature = React.useMemo(() => {
    if (readableContentTypes.length === 0) {
      return EMPTY_VISIBLE_TYPE_SENTINEL;
    }

    return readableContentTypes
      .map((definition) => definition.contentType)
      .join('|');
  }, [readableContentTypes]);
  const visibleTypes = React.useMemo(
    () =>
      visibleTypeSignature === EMPTY_VISIBLE_TYPE_SENTINEL
        ? [EMPTY_VISIBLE_TYPE_SENTINEL]
        : visibleTypeSignature.split('|'),
    [visibleTypeSignature]
  );
  const contentListQuery = React.useMemo<IamContentListQuery>(
    () => ({
      page: routeState.page,
      pageSize: routeState.pageSize,
      ...(routeState.type !== 'all' ? { type: routeState.type } : {}),
      ...(routeState.status !== 'all' ? { status: routeState.status } : {}),
      visibleTypes,
      sortBy: resolveContentSortField(routeSortField),
      sortDirection: routeSortDirection ?? 'desc',
    }),
    [
      routeSortDirection,
      routeSortField,
      routeState.page,
      routeState.pageSize,
      routeState.status,
      routeState.type,
      visibleTypes,
      visibleTypeSignature,
    ]
  );
  const contentsApi = useContents(contentListQuery, { enabled: contentListEnabled });
  const projectionSyncMessage = React.useMemo(
    () => (contentsApi.metadata ? renderProjectionSyncMessage(contentsApi.metadata) : null),
    [contentsApi.metadata]
  );
  const creatableContentTypes = React.useMemo(
    () => filterCreatableStudioContentTypes(studioContentTypes, effectivePermissionActions),
    [effectivePermissionActions]
  );
  const createDisabled =
    creatableContentTypes.length === 0 &&
    (contentAccessApi.access ? !contentAccessApi.access.canCreate : contentsApi.error?.code === 'forbidden');

  const registeredContents = React.useMemo(
    () =>
      filterRegisteredStudioContentItems(contentsApi.contents, studioContentTypes, effectivePermissionActions).map(
        ({ item, definition }) => ({
          ...item,
          typeLabel: definition.displayName,
          editPath: definition.detailPath
            .replace('$contentId', encodeURIComponent(item.id))
            .replace('$id', encodeURIComponent(item.id)),
        })
      ),
    [contentsApi.contents, effectivePermissionActions]
  );
  const safePage = Math.max(1, contentsApi.pagination.page);
  const pageCount = Math.max(
    1,
    Math.ceil(contentsApi.pagination.total / Math.max(1, contentsApi.pagination.pageSize))
  );
  const hasBulkActionableContents = React.useMemo(
    () => registeredContents.some(isBulkActionableContent),
    [registeredContents]
  );

  const navigateSearch = React.useCallback(
    (next: Partial<ContentListRouteState>) => {
      Promise.resolve(
        navigate({
          to: '/admin/content',
          search: (current: RouteSearchState) => updateRouteState(current, next),
        })
      ).catch(() => undefined);
    },
    [navigate]
  );

  const handleDeleteContent = React.useCallback(
    async (contentType: string, contentId: string) => {
      await deleteMainserverItem(contentType, contentId);
      await contentsApi.refetch();
    },
    [contentsApi]
  );

  const bulkActionButtons = React.useMemo<readonly StudioBulkAction<RegisteredContentRow>[]>(
    () =>
      hasBulkActionableContents
        ? [
            {
              id: 'archive-selection',
              label: buildBulkActionLabel('content.actions.archive'),
              disabled: !effectivePermissionActions.includes('content.archive'),
              onClick: async ({ selectedRows, clearSelection }) => {
                if (selectedRows.length === 0) {
                  return;
                }
                await contentsApi.archiveContents({
                  actionId: 'content.archive',
                  contentIds: selectedRows.map((item) => item.id),
                  matchingCount: selectedRows.length,
                  page: routeState.page,
                  pageSize: routeState.pageSize,
                  selectionMode: 'explicitIds',
                  sort: routeState.sort,
                  statusFilter: routeState.status,
                });
                clearSelection();
              },
            },
            {
              id: 'delete-selection',
              label: buildBulkActionLabel('content.actions.delete'),
              disabled: !effectivePermissionActions.includes('content.delete'),
              variant: 'destructive',
              onClick: async ({ selectedRows, clearSelection }) => {
                if (
                  selectedRows.length === 0 ||
                  !window.confirm(t('content.actions.deleteConfirm'))
                ) {
                  return;
                }
                await contentsApi.deleteContents({
                  actionId: 'content.delete',
                  contentIds: selectedRows.map((item) => item.id),
                  matchingCount: selectedRows.length,
                  page: routeState.page,
                  pageSize: routeState.pageSize,
                  selectionMode: 'explicitIds',
                  sort: routeState.sort,
                  statusFilter: routeState.status,
                });
                clearSelection();
              },
            },
          ]
        : [],
    [
      contentsApi,
      effectivePermissionActions,
      hasBulkActionableContents,
      routeState.page,
      routeState.pageSize,
      routeState.sort,
      routeState.status,
    ]
  );

  const contentColumns = React.useMemo<readonly StudioColumnDef<RegisteredContentRow>[]>(
    () => [
      {
        id: 'title',
        header: t('content.table.headerTitle'),
        cell: (item) => <span className="font-medium text-foreground">{item.title}</span>,
        sortable: true,
        sortValue: (item) => item.title.toLowerCase(),
      },
      {
        id: 'contentType',
        header: t('content.table.headerType'),
        cell: (item) => item.typeLabel,
        sortable: true,
        sortValue: (item) => item.typeLabel.toLowerCase(),
      },
      {
        id: 'updatedAt',
        header: t('content.table.headerUpdated'),
        cell: (item) => formatDateTime(item.updatedAt),
        sortable: true,
        sortValue: (item) => item.updatedAt,
      },
      {
        id: 'status',
        header: t('content.table.headerStatus'),
        cell: (item) => <Badge variant={statusVariantByValue[item.status]}>{t(statusLabelKeyByValue[item.status])}</Badge>,
        sortable: true,
        sortValue: (item) => item.status,
      },
    ],
    []
  );

  return (
    <section className="space-y-5" aria-busy={contentsApi.isLoading || authSessionPending || contentAccessPending}>
      <StudioListPageTemplate
        title={t('content.page.title')}
        description={t('content.page.subtitle')}
      />

      {contentsApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
          <AlertDescription>{contentErrorMessage(contentsApi.error)}</AlertDescription>
        </Alert>
      ) : null}

      {contentAccessApi.error && !contentsApi.error ? (
        <Alert className="border-secondary/40 bg-secondary/5 text-secondary">
          <AlertDescription>{t('content.messages.accessLoadError')}</AlertDescription>
        </Alert>
      ) : null}

      {projectionSyncMessage && !contentsApi.error ? (
        <Alert className="border-secondary/40 bg-secondary/5 text-secondary">
          <AlertDescription>{projectionSyncMessage}</AlertDescription>
        </Alert>
      ) : null}

      <section>
        <StudioDataTable
          ariaLabel={t('content.table.ariaLabel')}
          labels={studioDataTableLabels}
          caption={t('content.table.caption')}
          data={registeredContents}
          columns={contentColumns}
          getRowId={(item) => item.id}
          selectionMode="multiple"
          canSelectRow={isBulkActionableContent}
          bulkActions={bulkActionButtons}
          isLoading={contentsApi.isLoading || contentAccessApi.isLoading || authSessionPending || contentAccessPending}
          loadingState={t('content.messages.loading')}
          emptyState={
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">{t('content.empty.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('content.empty.body')}</p>
            </div>
          }
          toolbarCenter={
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="content-type-filter">{t('content.filters.typeLabel')}</Label>
                <Select
                  id="content-type-filter"
                  value={routeState.type}
                  onChange={(event) => navigateSearch({ type: normalizeTypeFilter(event.target.value), page: 1 })}
                >
                  <option value="all">{t('content.filters.typeAll')}</option>
                  {readableContentTypes.map((definition) => (
                    <option key={definition.contentType} value={definition.contentType}>
                      {definition.displayName}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="content-status-filter">{t('content.filters.statusLabel')}</Label>
                <Select
                  id="content-status-filter"
                  value={routeState.status}
                  onChange={(event) => navigateSearch({ status: normalizeStatusFilter(event.target.value), page: 1 })}
                >
                  <option value="all">{t('content.filters.statusAll')}</option>
                  <option value="draft">{t('content.status.draft')}</option>
                  <option value="in_review">{t('content.status.inReview')}</option>
                  <option value="approved">{t('content.status.approved')}</option>
                  <option value="published">{t('content.status.published')}</option>
                  <option value="archived">{t('content.status.archived')}</option>
                </Select>
              </div>
            </>
          }
          toolbarEnd={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={contentsApi.refreshProjectionPending}
                onClick={() => void contentsApi.refreshProjection({ force: true })}
              >
                {contentsApi.refreshProjectionPending
                  ? t('content.sync.refreshing')
                  : t('content.sync.refresh')}
              </Button>
              {createDisabled ? (
                <Button type="button" disabled>
                  {t('content.actions.create')}
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/admin/content/new">{t('content.actions.create')}</Link>
                </Button>
              )}
            </div>
          }
          footer={
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-1">
                <Label htmlFor="content-page-size">{t('content.pagination.pageSizeLabel')}</Label>
                <Select
                  id="content-page-size"
                  value={String(contentsApi.pagination.pageSize)}
                  onChange={(event) => navigateSearch({ page: 1, pageSize: Number(event.target.value) })}
                >
                  {(contentPagination?.pageSizeOptions ?? [25]).map((option) => (
                    <option key={option} value={option}>
                      {String(option)}
                    </option>
                  ))}
                </Select>
              </div>
              <ContentPaginationNav
                page={safePage}
                pageCount={pageCount}
                pageSize={contentsApi.pagination.pageSize}
                total={contentsApi.pagination.total}
                currentCount={registeredContents.length}
                onPageChange={(page) => navigateSearch({ page })}
              />
            </div>
          }
          rowActions={(item) => (
            <ContentRowActions
              item={item}
              listError={contentsApi.error}
              permissionActions={effectivePermissionActions}
              onDelete={handleDeleteContent}
            />
          )}
        />
      </section>
    </section>
  );
};
