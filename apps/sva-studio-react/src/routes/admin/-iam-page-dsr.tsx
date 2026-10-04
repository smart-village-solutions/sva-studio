import type { IamDsrCaseListItem } from '@sva/core';

import {
  StudioDataTable,
  type StudioColumnDef,
  type StudioDataTableSortingLabels,
} from '@sva/studio-ui-react';

import React from 'react';

import { StudioFilterSurface } from '../../components/StudioFilterSurface';

import { createStudioDataTableLabels } from '../../components/studio-data-table-labels';

import { Alert, AlertDescription } from '../../components/ui/alert';

import { Input } from '../../components/ui/input';

import { Label } from '../../components/ui/label';

import { Select } from '../../components/ui/select';

import { listAdminDsrCases, type DsrAdminCasesQuery } from '../../lib/iam-api';

import {
  logBrowserOperationAbort,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../../lib/browser-operation-logging';

import { type IamCockpitTabKey } from '../../lib/iam-viewer-access';

import { t } from '../../i18n';

import { IamCasePaginationFooter } from './-iam-page-governance';
import {
  FILTER_REQUEST_DEBOUNCE_MS,
  dsrStatusOptions,
  dsrTypeOptions,
  iamViewerLogger,
  isAbortError,
} from './-iam-page-shared';
import { mapDsrCanonicalStatusToTranslationKey, mapDsrTypeToTranslationKey } from './-iam.models';

export const useDsrTabState = ({
  activeTab,
  allowedTabs,
  canAccessCockpit,
  cockpitEnabled,
}: Readonly<{
  activeTab: IamCockpitTabKey;
  allowedTabs: readonly IamCockpitTabKey[];
  canAccessCockpit: boolean;
  cockpitEnabled: boolean;
}>) => {
  const [items, setItems] = React.useState<readonly IamDsrCaseListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState<DsrAdminCasesQuery>({
    page: 1,
    pageSize: 25,
    search: '',
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const requestQuery = React.useMemo(
    () => ({ ...query, search: query.search?.trim() ?? '' }),
    [query]
  );

  React.useEffect(() => {
    if (
      !cockpitEnabled ||
      !canAccessCockpit ||
      activeTab !== 'dsr' ||
      !allowedTabs.includes('dsr')
    ) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      logBrowserOperationStart(iamViewerLogger, 'iam_dsr_load_started', {
        operation: 'list_admin_dsr_cases',
      });
      setIsLoading(true);
      setError(null);

      listAdminDsrCases(requestQuery, { signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }
          setItems(response.data);
          setTotal(response.pagination.total);
          logBrowserOperationSuccess(
            iamViewerLogger,
            'iam_dsr_load_succeeded',
            {
              operation: 'list_admin_dsr_cases',
              item_count: response.data.length,
            },
            'debug'
          );
        })
        .catch((nextError) => {
          if (isAbortError(nextError) || controller.signal.aborted) {
            logBrowserOperationAbort(iamViewerLogger, 'iam_dsr_load_aborted', {
              operation: 'list_admin_dsr_cases',
            });
            return;
          }
          setItems([]);
          setTotal(0);
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          logBrowserOperationFailure(iamViewerLogger, 'iam_dsr_load_failed', nextError, {
            operation: 'list_admin_dsr_cases',
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, FILTER_REQUEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeTab, allowedTabs, canAccessCockpit, cockpitEnabled, requestQuery]);

  return {
    error,
    isLoading,
    items,
    query,
    setQuery,
    total,
  };
};

export const DsrTabPanel = ({
  panelId,
  labelledBy,
  state,
  columns,
  labels,
  sortingLabels,
}: Readonly<{
  panelId: string;
  labelledBy: string;
  state: ReturnType<typeof useDsrTabState>;
  columns: readonly StudioColumnDef<IamDsrCaseListItem>[];
  labels: ReturnType<typeof createStudioDataTableLabels>;
  sortingLabels: StudioDataTableSortingLabels;
}>) => (
  <div id={panelId} role="tabpanel" aria-labelledby={labelledBy} className="space-y-4">
    <StudioFilterSurface className="grid gap-3 md:grid-cols-3">
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-dsr-search">{t('admin.iam.dsr.filters.search')}</Label>
        <Input
          id="iam-dsr-search"
          value={state.query.search ?? ''}
          onChange={(event) =>
            state.setQuery((current) => ({ ...current, page: 1, search: event.target.value }))
          }
        />
      </div>
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-dsr-type">{t('admin.iam.dsr.filters.type')}</Label>
        <Select
          id="iam-dsr-type"
          value={state.query.type ?? ''}
          onChange={(event) =>
            state.setQuery((current) => ({
              ...current,
              page: 1,
              type: (event.target.value || undefined) as DsrAdminCasesQuery['type'],
            }))
          }
        >
          <option value="">{t('admin.iam.shared.all')}</option>
          {dsrTypeOptions.map((option) => (
            <option key={option} value={option}>
              {t(mapDsrTypeToTranslationKey(option))}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <Label htmlFor="iam-dsr-status">{t('admin.iam.dsr.filters.status')}</Label>
        <Select
          id="iam-dsr-status"
          value={state.query.status ?? ''}
          onChange={(event) =>
            state.setQuery((current) => ({
              ...current,
              page: 1,
              status: (event.target.value || undefined) as DsrAdminCasesQuery['status'],
            }))
          }
        >
          <option value="">{t('admin.iam.shared.all')}</option>
          {dsrStatusOptions.map((option) => (
            <option key={option} value={option}>
              {t(mapDsrCanonicalStatusToTranslationKey(option))}
            </option>
          ))}
        </Select>
      </div>
    </StudioFilterSurface>
    {state.error ? (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    ) : null}
    <StudioDataTable
      ariaLabel={t('admin.iam.dsr.tableAriaLabel')}
      labels={labels}
      sorting={{
        mode: 'external',
        labels: sortingLabels,
        state: [{ id: state.query.sortBy, desc: state.query.sortDirection === 'desc' }],
        onChange: ([nextSort]) => {
          if (nextSort) {
            state.setQuery((current) => ({
              ...current,
              page: 1,
              sortBy: nextSort.id as DsrAdminCasesQuery['sortBy'],
              sortDirection: nextSort.desc ? 'desc' : 'asc',
            }));
          }
        },
      }}
      caption={t('admin.iam.dsr.tableCaption')}
      data={state.items}
      columns={columns}
      getRowId={(item) => item.id}
      selectionMode="none"
      isLoading={state.isLoading}
      loadingState={t('admin.iam.dsr.messages.loading')}
      emptyState={
        <p className="text-sm text-muted-foreground">{t('admin.iam.dsr.messages.empty')}</p>
      }
      footer={
        <IamCasePaginationFooter
          page={state.query.page}
          pageSize={state.query.pageSize}
          total={state.total}
          onPageChange={(page) => state.setQuery((current) => ({ ...current, page }))}
          onPageSizeChange={(pageSize) =>
            state.setQuery((current) => ({ ...current, page: 1, pageSize }))
          }
        />
      }
    />
  </div>
);
