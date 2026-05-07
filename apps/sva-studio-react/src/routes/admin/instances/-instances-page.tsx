import type { IamInstanceListItem } from '@sva/core';
import { StudioDataTable, StudioListPageTemplate, type StudioColumnDef } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import React from 'react';

import { createStudioDataTableLabels } from '../../../components/studio-data-table-labels';
import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { getErrorMessage, INSTANCE_STATUS_LABELS } from './-instances-shared';

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
  const instancesApi = useInstances();

  const instanceColumns = React.useMemo<readonly StudioColumnDef<InstanceRow>[]>(
    () => [
      {
        id: 'displayName',
        header: t('admin.instances.table.headerName'),
        cell: (instance) => (
          <div>
            <div className="font-medium text-foreground">{instance.displayName}</div>
            <div className="text-xs text-muted-foreground">{instance.instanceId}</div>
          </div>
        ),
        sortable: true,
        sortValue: (instance) => instance.displayName.toLowerCase(),
      },
      {
        id: 'primaryHostname',
        header: t('admin.instances.table.headerHost'),
        cell: (instance) => <PrimaryHostnameCell instance={instance} />,
        sortable: true,
        sortValue: (instance) => instance.primaryHostname.toLowerCase(),
      },
      {
        id: 'parentDomain',
        header: t('admin.instances.table.headerParentDomain'),
        cell: (instance) => instance.parentDomain,
        sortable: true,
        sortValue: (instance) => instance.parentDomain.toLowerCase(),
      },
      {
        id: 'status',
        header: t('admin.instances.table.headerStatus'),
        cell: (instance) => <InstanceStatusCell instance={instance} />,
        sortable: true,
        sortValue: (instance) => instance.status,
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
            <Button asChild>
              <Link to="/admin/instances/new">{t('admin.instances.actions.create')}</Link>
            </Button>
          ),
        }}
      >
        <StudioDataTable
          ariaLabel={t('admin.instances.table.ariaLabel')}
          labels={studioDataTableLabels}
          data={instancesApi.instances}
          columns={instanceColumns}
          getRowId={(instance) => instance.instanceId}
          isLoading={instancesApi.isLoading}
          loadingState={t('content.messages.loading')}
          selectionMode="none"
          emptyState={
            <Card className="border-none p-0 text-sm text-muted-foreground shadow-none" role="status">
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
                  onChange={(event) => instancesApi.setStatus(event.target.value as typeof instancesApi.filters.status)}
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
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/instances/$instanceId" params={{ instanceId: instance.instanceId }}>
                  {t('admin.instances.actions.edit')}
                </Link>
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void instancesApi.activateInstance(instance.instanceId)}>
                {t('admin.instances.actions.activate')}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void instancesApi.suspendInstance(instance.instanceId)}>
                {t('admin.instances.actions.suspend')}
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => void instancesApi.archiveInstance(instance.instanceId)}>
                {t('admin.instances.actions.archive')}
              </Button>
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
    </section>
  );
};
