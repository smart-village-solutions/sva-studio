import {
  withServerDeniedContentAccess,
  type IamContentAccessSummary,
  type IamContentListQuery,
} from '@sva/core';
import { deleteEvent } from '@sva/plugin-events';
import { deleteNews } from '@sva/plugin-news';
import { deletePoi } from '@sva/plugin-poi';
import { IconEdit, IconEye, IconTrash, IconXboxX } from '@tabler/icons-react';
import { StudioDataTable, StudioListPageTemplate, type StudioColumnDef } from '@sva/studio-ui-react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import React from 'react';

import { createStudioDataTableLabels } from '../../components/studio-data-table-labels';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { useAuth } from '../../providers/auth-provider';
import { useContentAccess } from '../../hooks/use-content-access';
import { useUnifiedContentList } from '../../hooks/use-unified-content-list';
import { t } from '../../i18n';
import { formatEditorDateTime } from '../../lib/editor-date-time';
import type { IamHttpError } from '../../lib/iam-api';
import { studioContentTypes } from '../../lib/plugins';
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
  search: string;
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

const contentAdminResource = appAdminResources.find((resource) => resource.resourceId === 'content');
const contentListCapabilities = contentAdminResource?.capabilities?.list;
const contentBulkActions = contentListCapabilities?.bulkActions ?? [];
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

const contentAccessLabelKeyByState = {
  editable: 'content.access.states.editable',
  read_only: 'content.access.states.readOnly',
  blocked: 'content.access.states.blocked',
  server_denied: 'content.access.states.serverDenied',
} as const;

const formatAccessContext = (access: IamContentAccessSummary) => {
  if (access.organizationIds.length > 0) {
    return t('content.access.context.organizationIds', { value: access.organizationIds.join(', ') });
  }
  if (access.sourceKinds.length > 0) {
    return t('content.access.context.sourceKinds', { value: access.sourceKinds.join(', ') });
  }
  return t('content.access.context.none');
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

const readNormalizedRouteState = (search: RouteSearchState): ContentListRouteState => {
  const normalizedFilters = asRouteSearchState(search.filters);
  const normalizedSearch = typeof search.search === 'string' ? search.search : typeof search.q === 'string' ? search.q : '';
  const pageSizeDefault = contentPagination?.defaultPageSize ?? 25;

  const fallbackSort = contentSorting
    ? {
        field: contentSorting.defaultField,
        direction: contentSorting.defaultDirection,
      }
    : undefined;

  return {
    search: normalizedSearch,
    type: normalizeTypeFilter(normalizedFilters?.type ?? search.type),
    status: normalizeStatusFilter(normalizedFilters?.status ?? search.status),
    page: normalizePositiveInteger(search.page, 1),
    pageSize: normalizePositiveInteger(search.pageSize, pageSizeDefault),
    sort:
      normalizeSortState(
        typeof search.sortBy === 'string'
          ? {
              field: search.sortBy,
              direction: search.sortDirection,
            }
          : undefined
      ) ??
      normalizeSortState(search.sort) ??
      normalizeSortState(search.sort ?? search.sorting) ??
      fallbackSort,
  };
};

const serializeRouteState = (state: ContentListRouteState): RouteSearchState => ({
  ...(state.search.trim().length > 0 ? { q: state.search.trim() } : {}),
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

const resolveSelectionModeLabelKey = (
  selectionMode: 'explicitIds' | 'currentPage' | 'allMatchingQuery'
): 'content.bulk.scope.explicitIds' | 'content.bulk.scope.currentPage' | 'content.bulk.scope.allMatchingQuery' => {
  switch (selectionMode) {
    case 'explicitIds':
      return 'content.bulk.scope.explicitIds';
    case 'currentPage':
      return 'content.bulk.scope.currentPage';
    default:
      return 'content.bulk.scope.allMatchingQuery';
  }
};

const isBulkActionDisabled = (
  selectionMode: 'explicitIds' | 'currentPage' | 'allMatchingQuery',
  currentPageCount: number,
  totalCount: number
): boolean | undefined => {
  if (selectionMode === 'explicitIds') {
    return undefined;
  }
  if (selectionMode === 'currentPage') {
    return currentPageCount === 0;
  }
  return totalCount === 0;
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
  const { user } = useAuth();
  const contentAccessApi = useContentAccess();
  const routeState = readNormalizedRouteState(search);
  const routeSortField = routeState.sort?.field;
  const routeSortDirection = routeState.sort?.direction;
  const readableContentTypes = React.useMemo(
    () =>
      studioContentTypes.filter((definition) =>
        contentAccessApi.permissionActions?.includes(definition.requiredReadAction)
      ),
    [contentAccessApi.permissionActions]
  );
  const contentListQuery = React.useMemo<IamContentListQuery>(
    () => ({
      page: routeState.page,
      pageSize: routeState.pageSize,
      ...(routeState.search.trim().length > 0 ? { q: routeState.search.trim() } : {}),
      ...(routeState.type !== 'all' ? { type: routeState.type } : {}),
      ...(routeState.status !== 'all' ? { status: routeState.status } : {}),
      visibleTypes: readableContentTypes.map((definition) => definition.contentType),
      sortBy:
        routeSortField === 'contentType'
          ? 'contentType'
          : routeSortField === 'title' ||
              routeSortField === 'status' ||
              routeSortField === 'updatedAt'
            ? routeSortField
            : 'updatedAt',
      sortDirection: routeSortDirection ?? 'desc',
    }),
    [
      readableContentTypes,
      routeSortDirection,
      routeSortField,
      routeState.page,
      routeState.pageSize,
      routeState.search,
      routeState.status,
      routeState.type,
    ]
  );
  const contentsApi = useUnifiedContentList(
    contentListQuery,
    contentListQuery.visibleTypes ?? [],
    user?.instanceId ?? '',
    contentAccessApi.permissionActions
  );
  const creatableContentTypes = React.useMemo(
    () => filterCreatableStudioContentTypes(studioContentTypes, contentAccessApi.permissionActions),
    [contentAccessApi.permissionActions]
  );
  const createDisabled =
    creatableContentTypes.length === 0 &&
    (contentAccessApi.access ? !contentAccessApi.access.canCreate : contentsApi.error?.code === 'forbidden');

  const registeredContents = React.useMemo(
    () =>
      filterRegisteredStudioContentItems(contentsApi.contents, studioContentTypes, contentAccessApi.permissionActions).map(
        ({ item, definition }) => ({
          ...item,
          typeLabel: definition.displayName,
          editPath: definition.detailPath.replace('$contentId', item.id).replace('$id', item.id),
        })
      ),
    [contentAccessApi.permissionActions, contentsApi.contents]
  );
  const safePage = Math.max(1, contentsApi.pagination.page);
  const pageCount = Math.max(
    1,
    Math.ceil(contentsApi.pagination.total / Math.max(1, contentsApi.pagination.pageSize))
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

  const contentColumns = React.useMemo<readonly StudioColumnDef<(typeof registeredContents)[number]>[]>(
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

  const bulkActionButtons = contentsApi.supportsBulkActions
    ? contentBulkActions.flatMap((action) =>
        action.selectionModes
          .filter((selectionMode) => selectionMode !== 'allMatchingQuery')
          .map((selectionMode) => {
            const labelKey = resolveSelectionModeLabelKey(selectionMode);

            return {
              id: `${action.id}:${selectionMode}`,
              label: `${t(action.labelKey)} (${t(labelKey)})`,
              disabled: isBulkActionDisabled(selectionMode, registeredContents.length, contentsApi.pagination.total),
              variant: 'outline' as const,
              onClick: async () => undefined,
            };
          })
      )
    : [];

  return (
    <section className="space-y-5" aria-busy={contentsApi.isLoading}>
      <StudioListPageTemplate
        title={t('content.page.title')}
        description={t('content.page.subtitle')}
      >
        {contentAccessApi.access ? (
          <p className="text-sm text-muted-foreground">
            {t('content.messages.accessSummary', {
              state: t(contentAccessLabelKeyByState[contentAccessApi.access.state]),
              context: formatAccessContext(contentAccessApi.access),
            })}
          </p>
        ) : createDisabled ? (
          <p className="text-sm text-muted-foreground">{t('content.messages.actionsDisabled')}</p>
        ) : null}
      </StudioListPageTemplate>

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

      <section className="space-y-4" aria-labelledby="content-workspace-title">
        <header className="space-y-2">
          <h2 id="content-workspace-title" className="text-xl font-semibold text-foreground">
            {t('content.table.sectionTitle')}
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('content.table.sectionDescription')}</p>
        </header>

        <StudioDataTable
          ariaLabel={t('content.table.ariaLabel')}
          labels={studioDataTableLabels}
          caption={t('content.table.caption')}
          data={registeredContents}
          columns={contentColumns}
          getRowId={(item) => item.id}
          selectionMode="multiple"
          bulkActions={bulkActionButtons}
          isLoading={contentsApi.isLoading || contentAccessApi.isLoading}
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
                <Label htmlFor="content-search">{t('content.filters.searchLabel')}</Label>
                <Input
                  id="content-search"
                  value={routeState.search}
                  onChange={(event) => navigateSearch({ search: event.target.value, page: 1 })}
                  placeholder={t('content.filters.searchPlaceholder')}
                />
              </div>
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
            createDisabled ? (
              <Button type="button" disabled>
                {t('content.actions.create')}
              </Button>
            ) : (
              <Button asChild>
                <Link to="/admin/content/new">{t('content.actions.create')}</Link>
              </Button>
            )
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
          rowActions={(item) => {
            const access = resolveRowAccess(item.access, contentsApi.error);
            const actionLabel = resolveRowActionLabel(access);
            const canDelete = canDeleteMainserverItem(item.contentType, contentAccessApi.permissionActions);
            const actionIcon = access.canUpdate ? (
              <IconEdit aria-hidden="true" className="h-4 w-4" />
            ) : access.canRead ? (
              <IconEye aria-hidden="true" className="h-4 w-4" />
            ) : (
              <IconXboxX aria-hidden="true" className="h-4 w-4 text-destructive" />
            );

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
                  onClick={() => {
                    if (!canDelete || !window.confirm(t('content.actions.deleteConfirm'))) {
                      return;
                    }
                    void deleteMainserverItem(item.contentType, item.id)
                      .then(() => contentsApi.refetch())
                      .catch(() => undefined);
                  }}
                >
                  <IconTrash aria-hidden="true" className="h-4 w-4 text-destructive" />
                </Button>
              </>
            );
          }}
        />
      </section>
    </section>
  );
};
