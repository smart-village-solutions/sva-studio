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
    case 'tenant_auth_client_secret_missing':
      return t('admin.instances.errors.tenantAuthClientSecretMissing');
    case 'keycloak_unavailable':
      return t('admin.instances.errors.keycloakUnavailable');
    case 'encryption_not_configured':
      return t('admin.instances.errors.encryptionNotConfigured');
    default:
      return t('admin.instances.messages.error');
  }
};

const createEmptyTenantAdminBootstrap = () => ({
  username: '',
  email: '',
  firstName: '',
  lastName: '',
});

const createEmptyCreateForm = (parentDomain = '') => ({
  instanceId: '',
  displayName: '',
  parentDomain,
  authRealm: '',
  authClientId: 'sva-studio',
  authIssuerUrl: '',
  authClientSecret: '',
  tenantAdminBootstrap: createEmptyTenantAdminBootstrap(),
});

const createDetailForm = (instance: NonNullable<ReturnType<typeof useInstances>['selectedInstance']>) => ({
  displayName: instance.displayName,
  parentDomain: instance.parentDomain,
  authRealm: instance.authRealm,
  authClientId: instance.authClientId,
  authIssuerUrl: instance.authIssuerUrl ?? '',
  authClientSecret: '',
  tenantAdminBootstrap: {
    username: instance.tenantAdminBootstrap?.username ?? '',
    email: instance.tenantAdminBootstrap?.email ?? '',
    firstName: instance.tenantAdminBootstrap?.firstName ?? '',
    lastName: instance.tenantAdminBootstrap?.lastName ?? '',
  },
  tenantAdminTemporaryPassword: '',
  rotateClientSecret: false,
});

const getKeycloakStatusEntries = (selectedInstance: NonNullable<ReturnType<typeof useInstances>['selectedInstance']>) => {
  const status = selectedInstance.keycloakStatus;
  if (!status) {
    return [];
  }

  return [
    ['admin.instances.keycloakStatus.realmExists', status.realmExists],
    ['admin.instances.keycloakStatus.clientExists', status.clientExists],
    ['admin.instances.keycloakStatus.instanceIdMapperExists', status.instanceIdMapperExists],
    ['admin.instances.keycloakStatus.tenantAdminExists', status.tenantAdminExists],
    ['admin.instances.keycloakStatus.tenantAdminHasSystemAdmin', status.tenantAdminHasSystemAdmin],
    ['admin.instances.keycloakStatus.tenantAdminHasInstanceRegistryAdmin', !status.tenantAdminHasInstanceRegistryAdmin],
    ['admin.instances.keycloakStatus.redirectUrisMatch', status.redirectUrisMatch],
    ['admin.instances.keycloakStatus.logoutUrisMatch', status.logoutUrisMatch],
    ['admin.instances.keycloakStatus.webOriginsMatch', status.webOriginsMatch],
    ['admin.instances.keycloakStatus.clientSecretConfigured', status.clientSecretConfigured],
    ['admin.instances.keycloakStatus.tenantClientSecretReadable', status.tenantClientSecretReadable],
    ['admin.instances.keycloakStatus.clientSecretAligned', status.clientSecretAligned],
    ['admin.instances.keycloakStatus.runtimeSecretSourceTenant', status.runtimeSecretSource === 'tenant'],
  ] as const;
};

const KeycloakStatusBadge = ({ ready }: { ready: boolean }) => (
  <Badge variant={ready ? 'secondary' : 'outline'}>
    {ready ? t('admin.instances.keycloakStatus.ok') : t('admin.instances.keycloakStatus.missing')}
  </Badge>
);

export const InstancesPage = () => {
  const instancesApi = useInstances();
  const [suggestedParentDomain, setSuggestedParentDomain] = React.useState('');
  const [createFormValues, setCreateFormValues] = React.useState(createEmptyCreateForm());
  const [detailFormValues, setDetailFormValues] = React.useState<ReturnType<typeof createDetailForm> | null>(null);

  React.useEffect(() => {
    const parentDomain = readSuggestedParentDomain();
    setSuggestedParentDomain(parentDomain);
    setCreateFormValues((current) => (current.parentDomain ? current : createEmptyCreateForm(parentDomain)));
  }, []);

  React.useEffect(() => {
    if (!instancesApi.selectedInstance) {
      setDetailFormValues(null);
      return;
    }
    setDetailFormValues(createDetailForm(instancesApi.selectedInstance));
  }, [instancesApi.selectedInstance]);

  const onCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const instanceId = createFormValues.instanceId.trim();
    const created = await instancesApi.createInstance({
      instanceId,
      displayName: createFormValues.displayName.trim(),
      parentDomain: createFormValues.parentDomain.trim(),
      authRealm: createFormValues.authRealm.trim() || instanceId,
      authClientId: createFormValues.authClientId.trim() || 'sva-studio',
      authIssuerUrl: createFormValues.authIssuerUrl.trim() || undefined,
      authClientSecret: createFormValues.authClientSecret.trim() || undefined,
      tenantAdminBootstrap: createFormValues.tenantAdminBootstrap.username.trim()
        ? {
            username: createFormValues.tenantAdminBootstrap.username.trim(),
            email: createFormValues.tenantAdminBootstrap.email.trim() || undefined,
            firstName: createFormValues.tenantAdminBootstrap.firstName.trim() || undefined,
            lastName: createFormValues.tenantAdminBootstrap.lastName.trim() || undefined,
          }
        : undefined,
    });
    if (!created) {
      return;
    }
    setCreateFormValues(createEmptyCreateForm(createFormValues.parentDomain.trim()));
    await instancesApi.loadInstance(created.instanceId);
  };

  const onUpdateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!instancesApi.selectedInstance || !detailFormValues) {
      return;
    }

    await instancesApi.updateInstance(instancesApi.selectedInstance.instanceId, {
      displayName: detailFormValues.displayName.trim(),
      parentDomain: detailFormValues.parentDomain.trim(),
      authRealm: detailFormValues.authRealm.trim(),
      authClientId: detailFormValues.authClientId.trim(),
      authIssuerUrl: detailFormValues.authIssuerUrl.trim() || undefined,
      authClientSecret: detailFormValues.authClientSecret.trim() || undefined,
      tenantAdminBootstrap: detailFormValues.tenantAdminBootstrap.username.trim()
        ? {
            username: detailFormValues.tenantAdminBootstrap.username.trim(),
            email: detailFormValues.tenantAdminBootstrap.email.trim() || undefined,
            firstName: detailFormValues.tenantAdminBootstrap.firstName.trim() || undefined,
            lastName: detailFormValues.tenantAdminBootstrap.lastName.trim() || undefined,
          }
        : undefined,
    });
    setDetailFormValues((current) =>
      current
        ? {
            ...current,
            authClientSecret: '',
          }
        : current
    );
  };

  const runKeycloakReconcile = async (rotateClientSecret: boolean) => {
    if (!instancesApi.selectedInstance || !detailFormValues) {
      return;
    }

    await instancesApi.reconcileKeycloak(instancesApi.selectedInstance.instanceId, {
      rotateClientSecret,
      tenantAdminTemporaryPassword: detailFormValues.tenantAdminTemporaryPassword.trim() || undefined,
    });
    setDetailFormValues((current) =>
      current
        ? {
            ...current,
            tenantAdminTemporaryPassword: '',
            rotateClientSecret: false,
          }
        : current
    );
  };

  return (
    <section className="space-y-5" aria-busy={instancesApi.isLoading || instancesApi.detailLoading}>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.page.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.instances.page.subtitle')}</p>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
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
            <form className="space-y-3" onSubmit={onCreateSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="instance-id">{t('admin.instances.form.instanceId')}</Label>
                  <Input
                    id="instance-id"
                    value={createFormValues.instanceId}
                    onChange={(event) =>
                      setCreateFormValues((current) => ({
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
                    value={createFormValues.displayName}
                    onChange={(event) => setCreateFormValues((current) => ({ ...current, displayName: event.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="instance-parent-domain">{t('admin.instances.form.parentDomain')}</Label>
                <Input
                  id="instance-parent-domain"
                  value={createFormValues.parentDomain}
                  placeholder={suggestedParentDomain || undefined}
                  onChange={(event) => setCreateFormValues((current) => ({ ...current, parentDomain: event.target.value }))}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="instance-auth-realm">{t('admin.instances.form.authRealm')}</Label>
                  <Input
                    id="instance-auth-realm"
                    value={createFormValues.authRealm}
                    onChange={(event) => setCreateFormValues((current) => ({ ...current, authRealm: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="instance-auth-client-id">{t('admin.instances.form.authClientId')}</Label>
                  <Input
                    id="instance-auth-client-id"
                    value={createFormValues.authClientId}
                    onChange={(event) => setCreateFormValues((current) => ({ ...current, authClientId: event.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="instance-auth-issuer-url">{t('admin.instances.form.authIssuerUrl')}</Label>
                <Input
                  id="instance-auth-issuer-url"
                  value={createFormValues.authIssuerUrl}
                  onChange={(event) => setCreateFormValues((current) => ({ ...current, authIssuerUrl: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="instance-auth-client-secret">{t('admin.instances.form.authClientSecret')}</Label>
                <Input
                  id="instance-auth-client-secret"
                  type="password"
                  value={createFormValues.authClientSecret}
                  onChange={(event) => setCreateFormValues((current) => ({ ...current, authClientSecret: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">{t('admin.instances.form.tenantAdminTitle')}</h3>
                <p className="text-xs text-muted-foreground">{t('admin.instances.form.tenantAdminSubtitle')}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="instance-admin-username">{t('admin.instances.form.tenantAdminUsername')}</Label>
                  <Input
                    id="instance-admin-username"
                    value={createFormValues.tenantAdminBootstrap.username}
                    onChange={(event) =>
                      setCreateFormValues((current) => ({
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
                    value={createFormValues.tenantAdminBootstrap.email}
                    onChange={(event) =>
                      setCreateFormValues((current) => ({
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
                    value={createFormValues.tenantAdminBootstrap.firstName}
                    onChange={(event) =>
                      setCreateFormValues((current) => ({
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
                    value={createFormValues.tenantAdminBootstrap.lastName}
                    onChange={(event) =>
                      setCreateFormValues((current) => ({
                        ...current,
                        tenantAdminBootstrap: { ...current.tenantAdminBootstrap, lastName: event.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              <Button type="submit">{t('admin.instances.actions.create')}</Button>
            </form>
            {instancesApi.mutationError ? (
              <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                <AlertDescription>{getErrorMessage(instancesApi.mutationError)}</AlertDescription>
              </Alert>
            ) : null}
          </Card>

          <Card className="space-y-4 p-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{t('admin.instances.detail.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('admin.instances.detail.subtitle')}</p>
            </div>
            {instancesApi.selectedInstance && detailFormValues ? (
              <div className="space-y-5 text-sm">
                <div>
                  <div className="font-medium text-foreground">{instancesApi.selectedInstance.displayName}</div>
                  <div className="text-muted-foreground">{instancesApi.selectedInstance.instanceId}</div>
                </div>
                <div>{t('admin.instances.detail.primaryHostname', { value: instancesApi.selectedInstance.primaryHostname })}</div>
                <div>{t('admin.instances.detail.parentDomain', { value: instancesApi.selectedInstance.parentDomain })}</div>
                <div>{t('admin.instances.detail.status', { value: t(INSTANCE_STATUS_LABELS[instancesApi.selectedInstance.status]) })}</div>

                <form className="space-y-3" onSubmit={onUpdateSubmit}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="detail-display-name">{t('admin.instances.form.displayName')}</Label>
                      <Input
                        id="detail-display-name"
                        value={detailFormValues.displayName}
                        onChange={(event) =>
                          setDetailFormValues((current) => (current ? { ...current, displayName: event.target.value } : current))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="detail-parent-domain">{t('admin.instances.form.parentDomain')}</Label>
                      <Input
                        id="detail-parent-domain"
                        value={detailFormValues.parentDomain}
                        onChange={(event) =>
                          setDetailFormValues((current) => (current ? { ...current, parentDomain: event.target.value } : current))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="detail-auth-realm">{t('admin.instances.form.authRealm')}</Label>
                      <Input
                        id="detail-auth-realm"
                        value={detailFormValues.authRealm}
                        onChange={(event) =>
                          setDetailFormValues((current) => (current ? { ...current, authRealm: event.target.value } : current))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="detail-auth-client-id">{t('admin.instances.form.authClientId')}</Label>
                      <Input
                        id="detail-auth-client-id"
                        value={detailFormValues.authClientId}
                        onChange={(event) =>
                          setDetailFormValues((current) => (current ? { ...current, authClientId: event.target.value } : current))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="detail-auth-issuer-url">{t('admin.instances.form.authIssuerUrl')}</Label>
                    <Input
                      id="detail-auth-issuer-url"
                      value={detailFormValues.authIssuerUrl}
                      onChange={(event) =>
                        setDetailFormValues((current) => (current ? { ...current, authIssuerUrl: event.target.value } : current))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="detail-auth-client-secret">{t('admin.instances.form.authClientSecret')}</Label>
                    <Input
                      id="detail-auth-client-secret"
                      type="password"
                      placeholder={
                        instancesApi.selectedInstance.authClientSecretConfigured
                          ? t('admin.instances.form.authClientSecretConfigured')
                          : t('admin.instances.form.authClientSecretMissing')
                      }
                      value={detailFormValues.authClientSecret}
                      onChange={(event) =>
                        setDetailFormValues((current) => (current ? { ...current, authClientSecret: event.target.value } : current))
                      }
                    />
                    <p className="text-xs text-muted-foreground">{t('admin.instances.form.authClientSecretHint')}</p>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-foreground">{t('admin.instances.form.tenantAdminTitle')}</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="detail-admin-username">{t('admin.instances.form.tenantAdminUsername')}</Label>
                      <Input
                        id="detail-admin-username"
                        value={detailFormValues.tenantAdminBootstrap.username}
                        onChange={(event) =>
                          setDetailFormValues((current) =>
                            current
                              ? {
                                  ...current,
                                  tenantAdminBootstrap: {
                                    ...current.tenantAdminBootstrap,
                                    username: event.target.value,
                                  },
                                }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="detail-admin-email">{t('admin.instances.form.tenantAdminEmail')}</Label>
                      <Input
                        id="detail-admin-email"
                        value={detailFormValues.tenantAdminBootstrap.email}
                        onChange={(event) =>
                          setDetailFormValues((current) =>
                            current
                              ? {
                                  ...current,
                                  tenantAdminBootstrap: {
                                    ...current.tenantAdminBootstrap,
                                    email: event.target.value,
                                  },
                                }
                              : current
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="detail-admin-first-name">{t('admin.instances.form.tenantAdminFirstName')}</Label>
                      <Input
                        id="detail-admin-first-name"
                        value={detailFormValues.tenantAdminBootstrap.firstName}
                        onChange={(event) =>
                          setDetailFormValues((current) =>
                            current
                              ? {
                                  ...current,
                                  tenantAdminBootstrap: {
                                    ...current.tenantAdminBootstrap,
                                    firstName: event.target.value,
                                  },
                                }
                              : current
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="detail-admin-last-name">{t('admin.instances.form.tenantAdminLastName')}</Label>
                      <Input
                        id="detail-admin-last-name"
                        value={detailFormValues.tenantAdminBootstrap.lastName}
                        onChange={(event) =>
                          setDetailFormValues((current) =>
                            current
                              ? {
                                  ...current,
                                  tenantAdminBootstrap: {
                                    ...current.tenantAdminBootstrap,
                                    lastName: event.target.value,
                                  },
                                }
                              : current
                          )
                        }
                      />
                    </div>
                  </div>
                  <Button type="submit" variant="outline">
                    {t('admin.instances.actions.save')}
                  </Button>
                </form>

                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{t('admin.instances.keycloakPanel.title')}</div>
                    <p className="text-xs text-muted-foreground">{t('admin.instances.keycloakPanel.subtitle')}</p>
                  </div>
                  <div className="grid gap-2">
                    {getKeycloakStatusEntries(instancesApi.selectedInstance).map(([labelKey, ready]) => (
                      <div key={labelKey} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                        <span>{t(labelKey)}</span>
                        <KeycloakStatusBadge ready={ready} />
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="tenant-admin-password">{t('admin.instances.keycloakPanel.temporaryPassword')}</Label>
                      <Input
                        id="tenant-admin-password"
                        type="password"
                        value={detailFormValues.tenantAdminTemporaryPassword}
                        onChange={(event) =>
                          setDetailFormValues((current) =>
                            current ? { ...current, tenantAdminTemporaryPassword: event.target.value } : current
                          )
                        }
                      />
                      <p className="text-xs text-muted-foreground">{t('admin.instances.keycloakPanel.passwordHint')}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-foreground md:col-span-2">
                      <input
                        type="checkbox"
                        checked={detailFormValues.rotateClientSecret}
                        onChange={(event) =>
                          setDetailFormValues((current) =>
                            current ? { ...current, rotateClientSecret: event.target.checked } : current
                          )
                        }
                      />
                      <span>{t('admin.instances.keycloakPanel.rotateClientSecret')}</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void instancesApi.refreshKeycloakStatus(instancesApi.selectedInstance!.instanceId)}
                      disabled={instancesApi.statusLoading}
                    >
                      {t('admin.instances.actions.checkKeycloakStatus')}
                    </Button>
                    <Button type="button" onClick={() => void runKeycloakReconcile(false)}>
                      {t('admin.instances.actions.reconcileKeycloak')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void runKeycloakReconcile(false)}>
                      {t('admin.instances.actions.resetTenantAdmin')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void runKeycloakReconcile(true)}>
                      {t('admin.instances.actions.rotateClientSecret')}
                    </Button>
                  </div>
                </div>

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
