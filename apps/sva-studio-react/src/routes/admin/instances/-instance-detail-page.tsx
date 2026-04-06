import { Link } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';
import {
  createDetailForm,
  getErrorMessage,
  getKeycloakStatusEntries,
  INSTANCE_STATUS_LABELS,
  KeycloakStatusBadge,
} from './-instances-shared';

type InstanceDetailPageProps = {
  readonly instanceId: string;
};

export const InstanceDetailPage = ({ instanceId }: InstanceDetailPageProps) => {
  const instancesApi = useInstances();
  const [detailFormValues, setDetailFormValues] = React.useState<ReturnType<typeof createDetailForm> | null>(null);

  React.useEffect(() => {
    void instancesApi.loadInstance(instanceId);
  }, [instanceId]);

  const selectedInstance = instancesApi.selectedInstance?.instanceId === instanceId ? instancesApi.selectedInstance : null;

  React.useEffect(() => {
    if (!selectedInstance) {
      setDetailFormValues(null);
      return;
    }

    setDetailFormValues(createDetailForm(selectedInstance));
  }, [selectedInstance]);

  const onUpdateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedInstance || !detailFormValues) {
      return;
    }

    await instancesApi.updateInstance(selectedInstance.instanceId, {
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
    if (!selectedInstance || !detailFormValues) {
      return;
    }

    await instancesApi.reconcileKeycloak(selectedInstance.instanceId, {
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
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{t('admin.instances.detail.title')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('admin.instances.detail.subtitle')}</p>
        </div>
        <Button asChild type="button" variant="outline">
          <Link to="/admin/instances">{t('admin.instances.actions.back')}</Link>
        </Button>
      </header>

      {instancesApi.mutationError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{getErrorMessage(instancesApi.mutationError)}</AlertDescription>
        </Alert>
      ) : null}

      {selectedInstance && detailFormValues ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
          <Card className="space-y-5 p-4">
            <div className="space-y-1 text-sm">
              <div className="font-medium text-foreground">{selectedInstance.displayName}</div>
              <div className="text-muted-foreground">{selectedInstance.instanceId}</div>
              <div>{t('admin.instances.detail.primaryHostname', { value: selectedInstance.primaryHostname })}</div>
              <div>{t('admin.instances.detail.parentDomain', { value: selectedInstance.parentDomain })}</div>
              <div>{t('admin.instances.detail.status', { value: t(INSTANCE_STATUS_LABELS[selectedInstance.status]) })}</div>
            </div>

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
                    selectedInstance.authClientSecretConfigured
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
                <h2 className="text-sm font-medium text-foreground">{t('admin.instances.form.tenantAdminTitle')}</h2>
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
          </Card>

          <div className="space-y-5">
            <Card className="space-y-3 p-4">
              <div className="space-y-1">
                <div className="font-medium text-foreground">{t('admin.instances.keycloakPanel.title')}</div>
                <p className="text-xs text-muted-foreground">{t('admin.instances.keycloakPanel.subtitle')}</p>
              </div>
              <div className="grid gap-2">
                {getKeycloakStatusEntries(selectedInstance).map(([labelKey, ready]) => (
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
                  onClick={() => void instancesApi.refreshKeycloakStatus(selectedInstance.instanceId)}
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
            </Card>

            <Card className="space-y-2 p-4">
              <div className="font-medium text-foreground">{t('admin.instances.detail.runs')}</div>
              {selectedInstance.provisioningRuns.length > 0 ? (
                selectedInstance.provisioningRuns.map((run) => (
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
            </Card>
          </div>
        </div>
      ) : (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{t('content.messages.loading')}</p>
        </Card>
      )}
    </section>
  );
};
