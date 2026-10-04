import {
  Button,
  StudioDataTable,
  type MainserverPrincipalControlModel,
  type StudioBulkAction,
} from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import {
  createStudioDataTableLabels,
  createStudioDataTableSortingLabels,
} from '../../components/studio-data-table-labels';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { useContents } from '../../hooks/use-contents';
import { useContentAccess } from '../../hooks/use-content-access';
import { t } from '../../i18n';
import { studioContentTypes } from '../../lib/plugins';
import { ContentTypeFilters } from './-content-type-filters';
import {
  contentPagination,
  normalizeLanguageFilter,
  normalizeStatusFilter,
  normalizeTypeFilter,
  resolveContentSortField,
  type ContentListRouteState,
} from './-content-list-route-state';
import {
  ContentRowActions,
  isBulkActionableContent,
  resolveListMutationPrincipal,
  useContentColumns,
  type RegisteredContentRow,
} from './-content-list-row-actions';

const ContentPaginationNav = ({
  page,
  pageCount,
  pageSize,
  total,
  currentCount,
  isTotalFinal,
  onPageChange,
}: Readonly<{
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  currentCount: number;
  isTotalFinal: boolean;
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
          {t(
            isTotalFinal
              ? 'content.pagination.resultsLabel'
              : 'content.pagination.partialResultsLabel',
            { start: resultStart, end: resultEnd, total }
          )}
        </p>
        <p aria-live="polite">
          {isTotalFinal
            ? t('content.pagination.pageLabel', { page, total: pageCount })
            : t('content.pagination.partialPageLabel', { page })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          {t('content.pagination.previous')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          {t('content.pagination.next')}
        </Button>
      </div>
    </nav>
  );
};

const ContentListFilters = ({
  routeState,
  readableContentTypes,
  navigateSearch,
}: Readonly<{
  routeState: ContentListRouteState;
  readableContentTypes: readonly (typeof studioContentTypes)[number][];
  navigateSearch: (next: Partial<ContentListRouteState>) => void;
}>) => (
  <>
    <ContentTypeFilters
      contentTypes={readableContentTypes}
      selectedType={routeState.type}
      onTypeChange={(type) => navigateSearch({ type: normalizeTypeFilter(type), page: 1 })}
    />
    {routeState.type === 'faq.faq' ? (
      <div className="flex flex-col gap-1">
        <Label htmlFor="content-faq-language-filter">
          {t('content.filters.languageCodeLabel')}
        </Label>
        <Input
          id="content-faq-language-filter"
          className="w-full sm:w-64"
          value={routeState.languageCode ?? ''}
          onChange={(event) =>
            navigateSearch({
              languageCode: normalizeLanguageFilter(event.currentTarget.value),
              page: 1,
            })
          }
        />
      </div>
    ) : null}
    <div className="flex flex-col gap-1">
      <Label htmlFor="content-status-filter">{t('content.filters.statusLabel')}</Label>
      <Select
        id="content-status-filter"
        value={routeState.status}
        onChange={(event) =>
          navigateSearch({ status: normalizeStatusFilter(event.target.value), page: 1 })
        }
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
);

export const ContentListTable = ({
  contentsApi,
  contentAccessApi,
  authSessionPending,
  contentAccessPending,
  routeState,
  registeredContents,
  bulkActionButtons,
  readableContentTypes,
  effectivePermissionActions,
  enabledMainserverMutationActions,
  principalControl,
  projectionSyncMessage,
  createDisabled,
  tableCreateLabel,
  tableCreatePath,
  navigateSearch,
  onRequestDelete,
}: Readonly<{
  contentsApi: ReturnType<typeof useContents>;
  contentAccessApi: ReturnType<typeof useContentAccess>;
  authSessionPending: boolean;
  contentAccessPending: boolean;
  routeState: ContentListRouteState;
  registeredContents: readonly RegisteredContentRow[];
  bulkActionButtons: readonly StudioBulkAction<RegisteredContentRow>[];
  readableContentTypes: readonly (typeof studioContentTypes)[number][];
  effectivePermissionActions: readonly string[];
  enabledMainserverMutationActions: readonly string[];
  principalControl: MainserverPrincipalControlModel | undefined;
  projectionSyncMessage: string | null;
  createDisabled: boolean;
  tableCreateLabel: string;
  tableCreatePath: string;
  navigateSearch: (next: Partial<ContentListRouteState>) => void;
  onRequestDelete: (item: RegisteredContentRow) => void;
}>) => {
  const studioDataTableLabels = createStudioDataTableLabels();
  const studioDataTableSortingLabels = createStudioDataTableSortingLabels();
  const contentColumns = useContentColumns({
    contentsApi,
    enabledMainserverMutationActions,
    principalControl,
  });
  const routeSortField = routeState.sort?.field;
  const routeSortDirection = routeState.sort?.direction;
  const safePage = Math.max(1, contentsApi.pagination.page);
  const pageCount = Math.max(
    1,
    Math.ceil(contentsApi.pagination.total / Math.max(1, contentsApi.pagination.pageSize))
  );
  return (
    <section>
      <StudioDataTable
        ariaLabel={t('content.table.ariaLabel')}
        sorting={{
          mode: 'external',
          labels: studioDataTableSortingLabels,
          state: [
            {
              id: resolveContentSortField(routeSortField),
              desc: (routeSortDirection ?? 'desc') === 'desc',
            },
          ],
          onChange: ([nextSort]) => {
            if (nextSort) {
              navigateSearch({
                sort: { field: nextSort.id, direction: nextSort.desc ? 'desc' : 'asc' },
                page: 1,
              });
            }
          },
        }}
        labels={studioDataTableLabels}
        caption={t('content.table.caption')}
        data={registeredContents}
        columns={contentColumns}
        getRowId={(item) => item.id}
        selectionMode="multiple"
        canSelectRow={isBulkActionableContent}
        bulkActions={bulkActionButtons}
        isLoading={
          contentsApi.isLoading ||
          contentAccessApi.isLoading ||
          authSessionPending ||
          contentAccessPending
        }
        loadingState={t('content.messages.loading')}
        emptyState={
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{t('content.empty.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('content.empty.body')}</p>
          </div>
        }
        toolbarCenter={
          <ContentListFilters
            routeState={routeState}
            readableContentTypes={readableContentTypes}
            navigateSearch={navigateSearch}
          />
        }
        toolbarEnd={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={contentsApi.refreshProjectionPending}
              onClick={() => void contentsApi.refreshProjection({ force: true })}
            >
              {contentsApi.refreshProjectionPending
                ? t('content.sync.refreshing')
                : t('content.sync.refresh')}
            </Button>
            {createDisabled ? (
              <Button type="button" disabled>
                {tableCreateLabel}
              </Button>
            ) : (
              <Button asChild>
                <Link to={tableCreatePath}>{tableCreateLabel}</Link>
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
                onChange={(event) =>
                  navigateSearch({ page: 1, pageSize: Number(event.target.value) })
                }
              >
                {(contentPagination?.pageSizeOptions ?? [25]).map((option) => (
                  <option key={option} value={option}>
                    {String(option)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              {contentsApi.metadata?.isTotalFinal === false ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {projectionSyncMessage ?? t('content.sync.running')} {t('content.sync.partial')}
                </p>
              ) : null}
              <ContentPaginationNav
                page={safePage}
                pageCount={pageCount}
                pageSize={contentsApi.pagination.pageSize}
                total={contentsApi.pagination.total}
                currentCount={registeredContents.length}
                isTotalFinal={contentsApi.metadata?.isTotalFinal !== false}
                onPageChange={(page) => navigateSearch({ page })}
              />
            </div>
          </div>
        }
        rowActions={(item) => (
          <ContentRowActions
            item={item}
            permissionActions={effectivePermissionActions}
            enabledMainserverMutationActions={enabledMainserverMutationActions}
            mutationPrincipalAvailable={
              resolveListMutationPrincipal(item, principalControl) !== undefined
            }
            onRequestDelete={onRequestDelete}
          />
        )}
      />
    </section>
  );
};
