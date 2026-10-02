import type { IamGovernanceCaseListItem } from '@sva/core';

import {
  Button,
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

import { listGovernanceCases, type GovernanceCasesQuery } from '../../lib/iam-api';

import {
  logBrowserOperationAbort,
  logBrowserOperationFailure,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../../lib/browser-operation-logging';

import { type IamCockpitTabKey } from '../../lib/iam-viewer-access';

import { t } from '../../i18n';

import {
  FILTER_REQUEST_DEBOUNCE_MS,
  buildGovernanceComplianceExportPath,
  buildSelectOptions,
  governanceTypeOptions,
  iamViewerLogger,
  isAbortError,
} from './-iam-page-shared';
import { mapGovernanceTypeToTranslationKey } from './-iam.models';

export const useGovernanceTabState = ({
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
  const [items, setItems] = React.useState<readonly IamGovernanceCaseListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState<GovernanceCasesQuery>({
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
      activeTab !== 'governance' ||
      !allowedTabs.includes('governance')
    ) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      logBrowserOperationStart(iamViewerLogger, 'iam_governance_load_started', {
        operation: 'list_governance_cases',
      });
      setIsLoading(true);
      setError(null);

      listGovernanceCases(requestQuery, { signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }
          setItems(response.data);
          setTotal(response.pagination.total);
          logBrowserOperationSuccess(
            iamViewerLogger,
            'iam_governance_load_succeeded',
            {
              operation: 'list_governance_cases',
              item_count: response.data.length,
            },
            'debug'
          );
        })
        .catch((nextError) => {
          if (isAbortError(nextError) || controller.signal.aborted) {
            logBrowserOperationAbort(iamViewerLogger, 'iam_governance_load_aborted', {
              operation: 'list_governance_cases',
            });
            return;
          }
          setItems([]);
          setTotal(0);
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          logBrowserOperationFailure(iamViewerLogger, 'iam_governance_load_failed', nextError, {
            operation: 'list_governance_cases',
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

  const statusOptions = React.useMemo(
    () => buildSelectOptions([...items.map((item) => item.status), query.status]),
    [items, query.status]
  );

  return {
    error,
    isLoading,
    items,
    query,
    setQuery,
    statusOptions,
    total,
  };
};

export const IamCasePaginationFooter = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: Readonly<{
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}>) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <nav
      aria-label={t('admin.iam.shared.pagination.ariaLabel')}
      className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span role="status" aria-live="polite">
          {t('admin.iam.shared.pagination.results', { count: total })}
        </span>
        <Label htmlFor="iam-case-page-size">{t('admin.iam.shared.pagination.pageSize')}</Label>
        <Select
          id="iam-case-page-size"
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {[25, 50, 100].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span>{t('admin.iam.shared.pagination.page', { page, totalPages })}</span>
        <Button
          type="button"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t('admin.iam.shared.pagination.previous')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('admin.iam.shared.pagination.next')}
        </Button>
      </div>
    </nav>
  );
};

export const GovernanceTabPanel = ({
  canExportGovernanceCompliance,
  instanceId,
  panelId,
  labelledBy,
  state,
  columns,
  labels,
  sortingLabels,
}: Readonly<{
  canExportGovernanceCompliance: boolean;
  instanceId: string;
  panelId: string;
  labelledBy: string;
  state: ReturnType<typeof useGovernanceTabState>;
  columns: readonly StudioColumnDef<IamGovernanceCaseListItem>[];
  labels: ReturnType<typeof createStudioDataTableLabels>;
  sortingLabels: StudioDataTableSortingLabels;
}>) => (
  <div id={panelId} role="tabpanel" aria-labelledby={labelledBy} className="space-y-4">
    <StudioFilterSurface className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('admin.iam.governance.messages.exportHint')}
        </p>
        {instanceId && canExportGovernanceCompliance ? (
          <Button asChild size="sm" variant="secondary">
            <a href={buildGovernanceComplianceExportPath({ instanceId })}>
              {t('admin.iam.governance.actions.exportCsv')}
            </a>
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="iam-governance-search">{t('admin.iam.governance.filters.search')}</Label>
          <Input
            id="iam-governance-search"
            value={state.query.search ?? ''}
            onChange={(event) =>
              state.setQuery((current) => ({ ...current, page: 1, search: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="iam-governance-type">{t('admin.iam.governance.filters.type')}</Label>
          <Select
            id="iam-governance-type"
            value={state.query.type ?? ''}
            onChange={(event) =>
              state.setQuery((current) => ({
                ...current,
                page: 1,
                type: (event.target.value || undefined) as GovernanceCasesQuery['type'],
              }))
            }
          >
            <option value="">{t('admin.iam.shared.all')}</option>
            {governanceTypeOptions.map((option) => (
              <option key={option} value={option}>
                {t(mapGovernanceTypeToTranslationKey(option))}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <Label htmlFor="iam-governance-status">{t('admin.iam.governance.filters.status')}</Label>
          <Select
            id="iam-governance-status"
            value={state.query.status ?? ''}
            onChange={(event) =>
              state.setQuery((current) => ({
                ...current,
                page: 1,
                status: event.target.value || undefined,
              }))
            }
          >
            <option value="">{t('admin.iam.shared.all')}</option>
            {state.statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </StudioFilterSurface>
    {state.error ? (
      <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    ) : null}
    <StudioDataTable
      ariaLabel={t('admin.iam.governance.tableAriaLabel')}
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
              sortBy: nextSort.id as GovernanceCasesQuery['sortBy'],
              sortDirection: nextSort.desc ? 'desc' : 'asc',
            }));
          }
        },
      }}
      caption={t('admin.iam.governance.tableCaption')}
      data={state.items}
      columns={columns}
      getRowId={(item) => item.id}
      selectionMode="none"
      isLoading={state.isLoading}
      loadingState={t('admin.iam.governance.messages.loading')}
      emptyState={
        <p className="text-sm text-muted-foreground">{t('admin.iam.governance.messages.empty')}</p>
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
