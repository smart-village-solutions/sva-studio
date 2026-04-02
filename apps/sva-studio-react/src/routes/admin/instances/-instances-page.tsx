import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select } from '../../../components/ui/select';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

const INSTANCE_STATUS_LABELS = {
  requested: 'admin.instances.status.requested',
  validated: 'admin.instances.status.validated',
  provisioning: 'admin.instances.status.provisioning',
  active: 'admin.instances.status.active',
  failed: 'admin.instances.status.failed',
  suspended: 'admin.instances.status.suspended',
  archived: 'admin.instances.status.archived',
} as const;

const getErrorMessage = (error: IamHttpError | null) => {
  if (!error) {
    return t('admin.instances.messages.error');
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.instances.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.instances.errors.csrfValidationFailed');
    case 'reauth_required':
      return t('admin.instances.errors.reauthRequired');
    case 'conflict':
      return t('admin.instances.errors.conflict');
    case 'database_unavailable':
      return t('admin.instances.errors.databaseUnavailable');
    default:
      return t('admin.instances.messages.error');
  }
};

const readSuggestedParentDomain = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return new URL(window.location.href).hostname;
  } catch {
    return '';
  }
};

export const InstancesPage = () => {
  const instancesApi = useInstances();
  const [formValues, setFormValues] = React.useState({
    instanceId: '',
    displayName: '',
    parentDomain: '',
  });
  const [suggestedParentDomain, setSuggestedParentDomain] = React.useState('');

  React.useEffect(() => {
    setSuggestedParentDomain(readSuggestedParentDomain());
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await instancesApi.createInstance({
      instanceId: formValues.instanceId.trim(),
      displayName: formValues.displayName.trim(),
      parentDomain: formValues.parentDomain.trim(),
      authRealm: formValues.instanceId.trim(),
      authClientId: 'sva-studio',
    });
    if (!created) {
      return;
    }
    setFormValues({ instanceId: '', displayName: '', parentDomain: formValues.parentDomain.trim() });
  };

  return (
    <section className="space-y-5" aria-busy={instancesApi.isLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.page.title')}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t('admin.instances.page.subtitle')}</p>
      </header>

      <Card className="grid gap-4 p-4 lg:grid-cols-[1fr_14rem]">
        <div className="space-y-1">
          <Label htmlFor="instances-search">{t('admin.instances.filters.searchLabel')}</Label>
          <Input
            id="instances-search"
            placeholder={t('admin.instances.filters.searchPlaceholder')}
            value={instancesApi.filters.search}
            onChange={(event) => instancesApi.setSearch(event.target.value)}
          />
        </div>
        <div className="space-y-1">
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
      </Card>

      {instancesApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{getErrorMessage(instancesApi.error)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full border-collapse" aria-label={t('admin.instances.table.ariaLabel')}>
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">{t('admin.instances.table.headerName')}</th>
                <th className="px-3 py-3">{t('admin.instances.table.headerHost')}</th>
                <th className="px-3 py-3">{t('admin.instances.table.headerParentDomain')}</th>
                <th className="px-3 py-3">{t('admin.instances.table.headerStatus')}</th>
                <th className="px-3 py-3 text-right">{t('admin.instances.table.headerActions')}</th>
              </tr>
            </thead>
            <tbody>
              {instancesApi.instances.map((instance) => (
                <tr key={instance.instanceId} className="border-t border-border bg-card text-sm text-foreground">
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="text-left font-medium text-primary hover:underline"
                      onClick={() => void instancesApi.loadInstance(instance.instanceId)}
                    >
                      {instance.displayName}
                    </button>
                    <div className="text-xs text-muted-foreground">{instance.instanceId}</div>
                  </td>
                  <td className="px-3 py-3">{instance.primaryHostname}</td>
                  <td className="px-3 py-3">{instance.parentDomain}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline">{t(INSTANCE_STATUS_LABELS[instance.status])}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => void instancesApi.activateInstance(instance.instanceId)}>
                        {t('admin.instances.actions.activate')}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void instancesApi.suspendInstance(instance.instanceId)}>
                        {t('admin.instances.actions.suspend')}
                      </Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => void instancesApi.archiveInstance(instance.instanceId)}>
                        {t('admin.instances.actions.archive')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-5">
          <Card className="space-y-4 p-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{t('admin.instances.form.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('admin.instances.form.subtitle')}</p>
            </div>
            <form className="space-y-3" onSubmit={onSubmit}>
              <div className="space-y-1">
                <Label htmlFor="instance-id">{t('admin.instances.form.instanceId')}</Label>
                <Input
                  id="instance-id"
                  value={formValues.instanceId}
                  onChange={(event) => setFormValues((current) => ({ ...current, instanceId: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="instance-display-name">{t('admin.instances.form.displayName')}</Label>
                <Input
                  id="instance-display-name"
                  value={formValues.displayName}
                  onChange={(event) => setFormValues((current) => ({ ...current, displayName: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="instance-parent-domain">{t('admin.instances.form.parentDomain')}</Label>
                <Input
                  id="instance-parent-domain"
                  value={formValues.parentDomain}
                  placeholder={suggestedParentDomain || undefined}
                  onChange={(event) => setFormValues((current) => ({ ...current, parentDomain: event.target.value }))}
                />
              </div>
              <Button type="submit">{t('admin.instances.actions.create')}</Button>
            </form>
            {instancesApi.mutationError ? (
              <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                <AlertDescription>{getErrorMessage(instancesApi.mutationError)}</AlertDescription>
              </Alert>
            ) : null}
          </Card>

          <Card className="space-y-3 p-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{t('admin.instances.detail.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('admin.instances.detail.subtitle')}</p>
            </div>
            {instancesApi.selectedInstance ? (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium text-foreground">{instancesApi.selectedInstance.displayName}</div>
                  <div className="text-muted-foreground">{instancesApi.selectedInstance.instanceId}</div>
                </div>
                <div>{t('admin.instances.detail.primaryHostname', { value: instancesApi.selectedInstance.primaryHostname })}</div>
                <div>{t('admin.instances.detail.parentDomain', { value: instancesApi.selectedInstance.parentDomain })}</div>
                <div>{t('admin.instances.detail.status', { value: t(INSTANCE_STATUS_LABELS[instancesApi.selectedInstance.status]) })}</div>
                <div className="space-y-2">
                  <div className="font-medium text-foreground">{t('admin.instances.detail.runs')}</div>
                  {instancesApi.selectedInstance.provisioningRuns.length > 0 ? (
                    instancesApi.selectedInstance.provisioningRuns.map((run) => (
                      <div key={run.id} className="rounded-lg border border-border p-3">
                        <div className="font-medium">{run.operation}</div>
                        <div className="text-muted-foreground">
                          {t('admin.instances.detail.runStatus', { value: t(INSTANCE_STATUS_LABELS[run.status]) })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">{t('admin.instances.detail.noRuns')}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('admin.instances.detail.empty')}</p>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
};
