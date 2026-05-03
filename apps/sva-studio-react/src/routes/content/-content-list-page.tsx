import { withServerDeniedContentAccess, type IamContentAccessSummary } from '@sva/core';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import React from 'react';

import { StudioDataTable, type StudioColumnDef } from '../../components/StudioDataTable';
import { StudioListPageTemplate } from '../../components/StudioListPageTemplate';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { useContentAccess } from '../../hooks/use-content-access';
import { useContents } from '../../hooks/use-contents';
import { t } from '../../i18n';
import type { IamHttpError } from '../../lib/iam-api';
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
  status: StatusFilter;
  page: number;
  pageSize: number;
  sort?: ContentListSortState;
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

const formatDateTime = (value?: string): string => {
  if (!value) {
    return t('content.table.notPublished');
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const summarizePayload = (value: unknown): string => {
  const json = JSON.stringify(value);
  if (!json) {
    return '{}';
  }
  return json.length <= 80 ? json : `${json.slice(0, 77)}...`;
};

const stringifyPayload = (value: unknown): string => JSON.stringify(value) ?? '';

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

const contentAccessVariantByState = {
  editable: 'default',
  read_only: 'secondary',
  blocked: 'destructive',
  server_denied: 'destructive',
} as const;

const contentAccessReasonKeyByValue = {
  content_read_missing: 'content.access.reasons.contentReadMissing',
  content_update_missing: 'content.access.reasons.contentUpdateMissing',
  context_restricted: 'content.access.reasons.contextRestricted',
  server_forbidden: 'content.access.reasons.serverForbidden',
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

const normalizeStatusFilter = (value: unknown): StatusFilter =>
  typeof value === 'string' && contentStatusOptions.includes(value as StatusFilter) ? (value as StatusFilter) : 'all';

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
  if (value && typeof value === 'object') {
    const field = typeof (value as { field?: unknown }).field === 'string' ? (value as { field: string }).field : undefined;
    const direction = (value as { direction?: unknown }).direction;
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
  const normalizedFilters =
    search.filters && typeof search.filters === 'object' ? (search.filters as Record<string, unknown>) : undefined;
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
    status: normalizeStatusFilter(normalizedFilters?.status ?? search.status),
    page: normalizePositiveInteger(search.page, 1),
    pageSize: normalizePositiveInteger(search.pageSize, pageSizeDefault),
    sort: normalizeSortState(search.sort) ?? normalizeSortState(search.sort ?? search.sorting) ?? fallbackSort,
  };
};

const serializeRouteState = (state: ContentListRouteState): RouteSearchState => ({
  ...(state.search.trim().length > 0 ? { q: state.search.trim() } : {}),
  ...(state.status !== 'all' ? { status: state.status } : {}),
  ...(state.sort ? { sort: state.sort.direction === 'desc' ? `-${state.sort.field}` : state.sort.field } : {}),
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

const sortContents = <TItem extends Record<string, unknown>>(
  items: readonly TItem[],
  sort: ContentListSortState | undefined
): readonly TItem[] => {
  if (!sort) {
    return items;
  }

  const direction = sort.direction === 'desc' ? -1 : 1;
  return [...items].sort((left, right) => {
    const leftValue = left[sort.field];
    const rightValue = right[sort.field];
    const normalizedLeft = typeof leftValue === 'string' ? leftValue.toLowerCase() : String(leftValue ?? '');
    const normalizedRight = typeof rightValue === 'string' ? rightValue.toLowerCase() : String(rightValue ?? '');
    return normalizedLeft.localeCompare(normalizedRight) * direction;
  });
};

const ContentPaginationNav = ({
  page,
  pageCount,
  onPageChange,
}: Readonly<{
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}>) => (
  <nav aria-label={t('content.pagination.ariaLabel')} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
    <p aria-live="polite">
      {t('content.pagination.pageLabel', { page, total: pageCount })}
    </p>
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

export const ContentListPage = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as RouteSearchState;
  const contentsApi = useContents();
  const contentAccessApi = useContentAccess();
  const routeState = readNormalizedRouteState(search);
  const normalizedSearch = routeState.search.trim().toLowerCase();
  const createDisabled =
    contentAccessApi.access ? !contentAccessApi.access.canCreate : contentsApi.error?.code === 'forbidden';

  const contentsWithPayloadJson = React.useMemo(
    () =>
      contentsApi.contents.map((item) => ({
        ...item,
        payloadJson: stringifyPayload(item.payload),
      })),
    [contentsApi.contents]
  );

  const filteredContents = contentsWithPayloadJson.filter((item) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      item.title.toLowerCase().includes(normalizedSearch) ||
      item.author.toLowerCase().includes(normalizedSearch) ||
      item.contentType.toLowerCase().includes(normalizedSearch) ||
      item.payloadJson.toLowerCase().includes(normalizedSearch);

    const matchesStatus = routeState.status === 'all' || item.status === routeState.status;
    return matchesSearch && matchesStatus;
  });
  const sortedContents = React.useMemo(() => sortContents(filteredContents, routeState.sort), [filteredContents, routeState.sort]);
  const pageCount = Math.max(1, Math.ceil(sortedContents.length / routeState.pageSize));
  const safePage = Math.min(routeState.page, pageCount);
  const pagedContents = React.useMemo(
    () => sortedContents.slice((safePage - 1) * routeState.pageSize, safePage * routeState.pageSize),
    [routeState.pageSize, safePage, sortedContents]
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

  const runBulkAction = React.useCallback(
    async (actionId: 'content.archive' | 'content.delete', selectionMode: 'explicitIds' | 'currentPage' | 'allMatchingQuery', selectedIds: readonly string[]) => {
      const contentIds =
        selectionMode === 'currentPage'
          ? pagedContents.map((item) => item.id)
          : selectionMode === 'allMatchingQuery'
            ? sortedContents.map((item) => item.id)
            : selectedIds;

      const input = {
        actionId,
        contentIds,
        matchingCount: sortedContents.length,
        page: safePage,
        pageSize: routeState.pageSize,
        selectionMode,
        ...(routeState.sort ? { sort: routeState.sort } : {}),
        statusFilter: routeState.status,
      } as const;

      if (actionId === 'content.archive') {
        await contentsApi.archiveContents(input);
        return;
      }

      await contentsApi.deleteContents(input);
    },
    [contentsApi, pagedContents, routeState.pageSize, routeState.sort, routeState.status, safePage, sortedContents]
  );

  const contentColumns = React.useMemo<readonly StudioColumnDef<(typeof filteredContents)[number]>[]>(
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
        cell: (item) => item.contentType,
        sortable: true,
        sortValue: (item) => item.contentType.toLowerCase(),
      },
      {
        id: 'publishedAt',
        header: t('content.table.headerPublished'),
        cell: (item) => formatDateTime(item.publishedAt),
        sortable: true,
        sortValue: (item) => item.publishedAt ?? '',
      },
      {
        id: 'createdAt',
        header: t('content.table.headerCreated'),
        cell: (item) => formatDateTime(item.createdAt),
        sortable: true,
        sortValue: (item) => item.createdAt,
      },
      {
        id: 'updatedAt',
        header: t('content.table.headerUpdated'),
        cell: (item) => formatDateTime(item.updatedAt),
        sortable: true,
        sortValue: (item) => item.updatedAt,
      },
      {
        id: 'author',
        header: t('content.table.headerAuthor'),
        cell: (item) => item.author,
        sortable: true,
        sortValue: (item) => item.author.toLowerCase(),
      },
      {
        id: 'payload',
        header: t('content.table.headerPayload'),
        cell: (item) => <span className="max-w-sm text-foreground">{summarizePayload(item.payload)}</span>,
      },
      {
        id: 'status',
        header: t('content.table.headerStatus'),
        cell: (item) => <Badge variant={statusVariantByValue[item.status]}>{t(statusLabelKeyByValue[item.status])}</Badge>,
        sortable: true,
        sortValue: (item) => item.status,
      },
      {
        id: 'access',
        header: t('content.table.headerAccess'),
        cell: (item) => {
          const access = resolveRowAccess(item.access, contentsApi.error);
          return (
            <div>
              <Badge variant={contentAccessVariantByState[access.state]}>
                {t(contentAccessLabelKeyByState[access.state])}
              </Badge>
              {access.reasonCode ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(contentAccessReasonKeyByValue[access.reasonCode])}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'context',
        header: t('content.table.headerContext'),
        cell: (item) => formatAccessContext(resolveRowAccess(item.access, contentsApi.error)),
      },
    ],
    [contentsApi.error]
  );

  const bulkActionButtons = contentBulkActions.flatMap((action) =>
    action.selectionModes.map((selectionMode) => {
      const labelKey =
        selectionMode === 'explicitIds'
          ? 'content.bulk.scope.explicitIds'
          : selectionMode === 'currentPage'
            ? 'content.bulk.scope.currentPage'
            : 'content.bulk.scope.allMatchingQuery';

      const enabledForScope =
        selectionMode === 'explicitIds'
          ? undefined
          : selectionMode === 'currentPage'
            ? pagedContents.length === 0
            : sortedContents.length === 0;

      return {
        id: `${action.id}:${selectionMode}`,
        label: `${t(action.labelKey)} (${t(labelKey)})`,
        disabled: selectionMode === 'explicitIds' ? undefined : enabledForScope,
        variant: 'outline' as const,
        onClick: async ({ selectedRows, clearSelection }: { selectedRows: typeof pagedContents; clearSelection: () => void }) => {
          await runBulkAction(
            action.actionId as 'content.archive' | 'content.delete',
            selectionMode,
            selectedRows.map((row) => row.id)
          );
          clearSelection();
        },
      };
    })
  );

  return (
    <section className="space-y-5" aria-busy={contentsApi.isLoading}>
      <StudioListPageTemplate
        title={t('content.page.title')}
        description={t('content.page.subtitle')}
        primaryAction={{
          label: t('content.actions.create'),
          render: createDisabled ? (
            <Button type="button" disabled>
              {t('content.actions.create')}
            </Button>
          ) : (
            <Button asChild>
              <Link to="/admin/content/new">{t('content.actions.create')}</Link>
            </Button>
          ),
        }}
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

      <StudioDataTable
        ariaLabel={t('content.table.ariaLabel')}
        caption={t('content.table.caption')}
        data={pagedContents}
        columns={contentColumns}
        getRowId={(item) => item.id}
        selectionMode={contentBulkActions.length > 0 ? 'multiple' : 'none'}
        bulkActions={bulkActionButtons}
        isLoading={contentsApi.isLoading || contentAccessApi.isLoading}
        loadingState={t('content.messages.loading')}
        emptyState={
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">{t('content.empty.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('content.empty.body')}</p>
          </div>
        }
        toolbarStart={
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
              <Label htmlFor="content-status-filter">{t('content.filters.statusLabel')}</Label>
              <Select
                id="content-status-filter"
                value={routeState.status}
                onChange={(event) => navigateSearch({ status: event.target.value as StatusFilter, page: 1 })}
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
          <>
            <div className="flex flex-col gap-1">
              <Label htmlFor="content-page-size">{t('content.pagination.pageSizeLabel')}</Label>
              <Select
                id="content-page-size"
                value={String(routeState.pageSize)}
                onChange={(event) => navigateSearch({ page: 1, pageSize: Number(event.target.value) })}
              >
                {(contentPagination?.pageSizeOptions ?? [25]).map((option) => (
                  <option key={option} value={option}>
                    {String(option)}
                  </option>
                ))}
              </Select>
            </div>
            <ContentPaginationNav page={safePage} pageCount={pageCount} onPageChange={(page) => navigateSearch({ page })} />
          </>
        }
        rowActions={(item) => {
          const access = resolveRowAccess(item.access, contentsApi.error);
          const actionLabel = access.canUpdate
            ? t('content.actions.edit')
            : access.canRead
              ? t('content.actions.openReadOnly')
              : t('content.actions.blocked');

          return access.canRead ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/content/$id" params={{ id: item.id }}>
                {actionLabel}
              </Link>
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled>
              {actionLabel}
            </Button>
          );
        }}
      />
    </section>
  );
};
