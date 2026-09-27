import type { IamInstanceListItem } from '@sva/core';
import {
  Button,
  type StudioColumnDef,
  StudioDataTable,
  StudioActionMenu,
  StudioListPageTemplate,
} from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import React from 'react';

import {
  createStudioDataTableLabels,
  createStudioDataTableSortingLabels,
} from '../../../components/studio-data-table-labels';
import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { getErrorMessage } from './-instance-error-messages';
import { InstanceAuditRunSection } from './-instance-audit-run-section';
import { INSTANCE_STATUS_LABELS } from './-instances-shared-types';

type InstanceRow = IamInstanceListItem;

const PrimaryHostnameCell = ({ instance }: { instance: InstanceRow }) => (
  <a
    href={`https://${instance.primaryHostname}`}
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary underline-offset-4 hover:underline"
  >
    {instance.primaryHostname}
  </a>
);

const InstanceStatusCell = ({ instance }: { instance: InstanceRow }) => (
  <Badge variant="outline">{t(INSTANCE_STATUS_LABELS[instance.status])}</Badge>
);

export const InstancesPage = () => {
  const studioDataTableLabels = createStudioDataTableLabels();
  const studioDataTableSortingLabels = createStudioDataTableSortingLabels();
  const instancesApi = useInstances();
  const [auditExpanded, setAuditExpanded] = React.useState(false);

  const instanceColumns = React.useMemo<readonly StudioColumnDef<InstanceRow>[]>(
    () => [
      {
        id: 'displayName',
        header: t('admin.instances.table.headerName'),
        cell: (instance) => (
          <div>
            <Link
              className="font-medium text-primary underline-offset-4 hover:underline"
              to="/admin/instances/$instanceId"
              params={{ instanceId: instance.instanceId }}
            >
              {instance.displayName}
            </Link>
            <div className="text-xs text-muted-foreground">{instance.instanceId}</div>
          </div>
        ),
        sortable: true,
        sortLabel: t('admin.instances.table.headerName'),
        sortValue: (instance) => instance.displayName.toLowerCase(),
      },
      {
        id: 'primaryHostname',
        header: t('admin.instances.table.headerHost'),
        cell: (instance) => (
          <div>
            <PrimaryHostnameCell instance={instance} />
            <div className="text-xs text-muted-foreground">{instance.parentDomain}</div>
          </div>
        ),
        sortable: true,
        sortLabel: t('admin.instances.table.headerHost'),
        sortValue: (instance) => instance.primaryHostname.toLowerCase(),
      },
      {
        id: 'status',
        header: t('admin.instances.table.headerStatus'),
        cell: (instance) => <InstanceStatusCell instance={instance} />,
        sortable: true,
        sortLabel: t('admin.instances.table.headerStatus'),
        sortValue: (instance) => instance.status,
      },
      {
        id: 'attention',
        header: t('admin.instances.table.attention'),
        cell: (instance) =>
          t(
            instance.latestProvisioningRun?.status === 'failed' || instance.status === 'failed'
              ? 'admin.instances.table.failedRun'
              : instance.latestProvisioningRun?.status === 'provisioning' ||
                  instance.latestProvisioningRun?.status === 'requested'
                ? 'admin.instances.table.runningRun'
                : 'admin.instances.table.notVerified'
          ),
      },
    ],
    [instancesApi.instances]
  );

  return (
    <section className="space-y-5" aria-busy={instancesApi.isLoading}>
      <StudioListPageTemplate
        title={t('admin.instances.page.title')}
        description={t('admin.instances.page.subtitle')}
        primaryAction={{
          label: t('admin.instances.actions.create'),
          render: (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setAuditExpanded(true);
                  void instancesApi.refreshInstancesAudit();
                }}
                disabled={instancesApi.auditLoading}
              >
                {instancesApi.auditLoading
                  ? t('admin.instances.audit.loadingAll')
                  : t('admin.instances.audit.runAll')}
              </Button>
              <Button asChild>
                <Link to="/admin/instances/new">{t('admin.instances.actions.create')}</Link>
              </Button>
            </div>
          ),
        }}
      >
        <StudioDataTable
          ariaLabel={t('admin.instances.table.ariaLabel')}
          labels={studioDataTableLabels}
          data={instancesApi.instances}
          columns={instanceColumns}
          sorting={{ mode: 'client', labels: studioDataTableSortingLabels }}
          getRowId={(instance) => instance.instanceId}
          isLoading={instancesApi.isLoading}
          loadingState={t('content.messages.loading')}
          selectionMode="none"
          emptyState={
            <Card
              className="border-none p-0 text-sm text-muted-foreground shadow-none"
              role="status"
            >
              {t('admin.instances.messages.emptyState')}
            </Card>
          }
          toolbarStart={
            <>
              <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="instances-search">{t('admin.instances.filters.searchLabel')}</Label>
                <Input
                  id="instances-search"
                  placeholder={t('admin.instances.filters.searchPlaceholder')}
                  value={instancesApi.filters.search}
                  onChange={(event) => instancesApi.setSearch(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <Label htmlFor="instances-status">{t('admin.instances.filters.statusLabel')}</Label>
                <Select
                  id="instances-status"
                  value={instancesApi.filters.status}
                  onChange={(event) =>
                    instancesApi.setStatus(event.target.value as typeof instancesApi.filters.status)
                  }
                >
                  <option value="all">{t('admin.instances.filters.statusAll')}</option>
                  {Object.entries(INSTANCE_STATUS_LABELS).map(([value, labelKey]) => (
                    <option key={value} value={value}>
                      {t(labelKey)}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          }
          rowActions={(instance) => (
            <>
              <Button asChild size="sm" variant="secondary">
                <Link
                  to="/admin/instances/$instanceId"
                  params={{ instanceId: instance.instanceId }}
                >
                  {t('admin.instances.actions.edit')}
                </Link>
              </Button>
              <details className="relative">
                <summary className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring">
                  {t('admin.instances.actions.more')}
                </summary>
                <StudioActionMenu
                  className="mt-2"
                  items={[
                    {
                      id: 'suspend',
                      label: t('admin.instances.actions.suspend'),
                      onSelect: () => void instancesApi.suspendInstance(instance.instanceId),
                    },
                    {
                      id: 'archive',
                      label: t('admin.instances.actions.archive'),
                      variant: 'destructive',
                      onSelect: () => void instancesApi.archiveInstance(instance.instanceId),
                    },
                  ]}
                />
              </details>
            </>
          )}
        />
      </StudioListPageTemplate>

      {instancesApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{getErrorMessage(instancesApi.error)}</span>
            <IamRuntimeDiagnosticDetails error={instancesApi.error} />
          </AlertDescription>
        </Alert>
      ) : null}

      {instancesApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-3">
            <span>{getErrorMessage(instancesApi.mutationError)}</span>
            <IamRuntimeDiagnosticDetails error={instancesApi.mutationError} />
          </AlertDescription>
        </Alert>
      ) : null}

      {instancesApi.instancesAuditRun || auditExpanded ? (
        <details
          open={auditExpanded}
          onToggle={(event) => setAuditExpanded(event.currentTarget.open)}
        >
          <summary className="cursor-pointer font-medium">
            {t('admin.instances.audit.overviewTitle')}
          </summary>
          <InstanceAuditRunSection
            title={t('admin.instances.audit.overviewTitle')}
            subtitle={t('admin.instances.audit.overviewSubtitle')}
            emptyMessage={t('admin.instances.audit.overviewEmpty')}
            refreshLabel={t('admin.instances.audit.runAll')}
            loadingLabel={t('admin.instances.audit.loadingAll')}
            auditRun={instancesApi.instancesAuditRun}
            auditLoading={instancesApi.auditLoading}
            onRefresh={() => instancesApi.refreshInstancesAudit()}
          />
        </details>
      ) : null}
    </section>
  );
};
