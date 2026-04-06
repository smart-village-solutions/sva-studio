import { Link, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import { createEmptyCreateForm, getErrorMessage, readSuggestedParentDomain } from './-instances-shared';

export const InstanceCreatePage = () => {
  const navigate = useNavigate();
  const instancesApi = useInstances();
  const [suggestedParentDomain, setSuggestedParentDomain] = React.useState('');
  const [formValues, setFormValues] = React.useState(createEmptyCreateForm());

  React.useEffect(() => {
    const parentDomain = readSuggestedParentDomain();
    setSuggestedParentDomain(parentDomain);
    setFormValues((current) => (current.parentDomain ? current : createEmptyCreateForm(parentDomain)));
  }, []);

  const onCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const instanceId = formValues.instanceId.trim();
    const created = await instancesApi.createInstance({
      instanceId,
      displayName: formValues.displayName.trim(),
      parentDomain: formValues.parentDomain.trim(),
      authRealm: formValues.authRealm.trim() || instanceId,
      authClientId: formValues.authClientId.trim() || 'sva-studio',
      authIssuerUrl: formValues.authIssuerUrl.trim() || undefined,
      authClientSecret: formValues.authClientSecret.trim() || undefined,
      tenantAdminBootstrap: formValues.tenantAdminBootstrap.username.trim()
        ? {
            username: formValues.tenantAdminBootstrap.username.trim(),
            email: formValues.tenantAdminBootstrap.email.trim() || undefined,
            firstName: formValues.tenantAdminBootstrap.firstName.trim() || undefined,
            lastName: formValues.tenantAdminBootstrap.lastName.trim() || undefined,
          }
        : undefined,
    });

    if (!created) {
      return;
    }

    await navigate({
      to: '/admin/instances/$instanceId',
      params: { instanceId: created.instanceId },
    });
  };

  return (
    <section className="space-y-5" aria-busy={instancesApi.isLoading}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.form.title')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.instances.form.subtitle')}</p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/instances">{t('admin.instances.actions.back')}</Link>
        </Button>
      </header>

      <Card className="space-y-4 p-4">
        <form className="space-y-3" onSubmit={onCreateSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="instance-id">{t('admin.instances.form.instanceId')}</Label>
              <Input
                id="instance-id"
                value={formValues.instanceId}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    instanceId: event.target.value,
                    authRealm: current.authRealm ? current.authRealm : event.target.value,
                  }))
                }
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
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="instance-auth-realm">{t('admin.instances.form.authRealm')}</Label>
              <Input
                id="instance-auth-realm"
                value={formValues.authRealm}
                onChange={(event) => setFormValues((current) => ({ ...current, authRealm: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="instance-auth-client-id">{t('admin.instances.form.authClientId')}</Label>
              <Input
                id="instance-auth-client-id"
                value={formValues.authClientId}
                onChange={(event) => setFormValues((current) => ({ ...current, authClientId: event.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="instance-auth-issuer-url">{t('admin.instances.form.authIssuerUrl')}</Label>
            <Input
              id="instance-auth-issuer-url"
              value={formValues.authIssuerUrl}
              onChange={(event) => setFormValues((current) => ({ ...current, authIssuerUrl: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="instance-auth-client-secret">{t('admin.instances.form.authClientSecret')}</Label>
            <Input
              id="instance-auth-client-secret"
              type="password"
              value={formValues.authClientSecret}
              onChange={(event) => setFormValues((current) => ({ ...current, authClientSecret: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-foreground">{t('admin.instances.form.tenantAdminTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('admin.instances.form.tenantAdminSubtitle')}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="instance-admin-username">{t('admin.instances.form.tenantAdminUsername')}</Label>
              <Input
                id="instance-admin-username"
                value={formValues.tenantAdminBootstrap.username}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    tenantAdminBootstrap: { ...current.tenantAdminBootstrap, username: event.target.value },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="instance-admin-email">{t('admin.instances.form.tenantAdminEmail')}</Label>
              <Input
                id="instance-admin-email"
                value={formValues.tenantAdminBootstrap.email}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    tenantAdminBootstrap: { ...current.tenantAdminBootstrap, email: event.target.value },
                  }))
                }
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="instance-admin-first-name">{t('admin.instances.form.tenantAdminFirstName')}</Label>
              <Input
                id="instance-admin-first-name"
                value={formValues.tenantAdminBootstrap.firstName}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    tenantAdminBootstrap: { ...current.tenantAdminBootstrap, firstName: event.target.value },
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="instance-admin-last-name">{t('admin.instances.form.tenantAdminLastName')}</Label>
              <Input
                id="instance-admin-last-name"
                value={formValues.tenantAdminBootstrap.lastName}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    tenantAdminBootstrap: { ...current.tenantAdminBootstrap, lastName: event.target.value },
                  }))
                }
              />
            </div>
          </div>
          <Button type="submit">{t('admin.instances.actions.create')}</Button>
        </form>
      </Card>

      {instancesApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{getErrorMessage(instancesApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
};
