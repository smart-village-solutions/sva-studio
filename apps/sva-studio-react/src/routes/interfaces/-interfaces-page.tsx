import { useServerFn } from '@tanstack/react-start';
import React from 'react';

import type { SvaMainserverConnectionStatus } from '@sva/sva-mainserver';

import { t } from '../../i18n';
import { isRecord, readErrorMessage } from '../../lib/error-message-utils';
import { loadInterfacesOverview, saveSvaMainserverInterfaceSettings } from '../../lib/interfaces-api';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

type FormValues = {
  graphqlBaseUrl: string;
  oauthTokenUrl: string;
  enabled: boolean;
};

const emptyFormValues: FormValues = {
  graphqlBaseUrl: '',
  oauthTokenUrl: '',
  enabled: true,
};

const toFormValues = (
  config: {
    graphqlBaseUrl: string;
    oauthTokenUrl: string;
    enabled: boolean;
  } | null
): FormValues => ({
  graphqlBaseUrl: config?.graphqlBaseUrl ?? '',
  oauthTokenUrl: config?.oauthTokenUrl ?? '',
  enabled: config?.enabled ?? true,
});

const getStatusLabel = (status: SvaMainserverConnectionStatus): string => {
  if (status.status === 'connected') {
    return t('interfaces.status.connected');
  }

  if (status.errorCode) {
    return `${t('interfaces.status.error')} (${status.errorCode})`;
  }

  return t('interfaces.status.error');
};

const getTranslatedErrorMessage = (
  errorCode: SvaMainserverConnectionStatus['errorCode'],
  field?: string
): string | null => {
  switch (errorCode) {
    case 'config_not_found':
      return t('interfaces.errors.configNotFound');
    case 'integration_disabled':
      return t('interfaces.errors.integrationDisabled');
    case 'invalid_config':
      if (field === 'graphql_base_url') {
        return t('interfaces.errors.invalidGraphqlBaseUrl');
      }
      if (field === 'oauth_token_url') {
        return t('interfaces.errors.invalidOauthTokenUrl');
      }
      return t('interfaces.errors.invalidConfig');
    case 'database_unavailable':
      return t('interfaces.errors.databaseUnavailable');
    case 'identity_provider_unavailable':
      return t('interfaces.errors.identityProviderUnavailable');
    case 'missing_credentials':
      return t('interfaces.errors.missingCredentials');
    case 'token_request_failed':
      return t('interfaces.errors.tokenRequestFailed');
    case 'unauthorized':
      return t('interfaces.errors.unauthorized');
    case 'forbidden':
      return t('interfaces.errors.forbidden');
    case 'network_error':
      return t('interfaces.errors.networkError');
    case 'graphql_error':
      return t('interfaces.errors.graphqlError');
    case 'invalid_response':
      return t('interfaces.errors.invalidResponse');
    default:
      return null;
  }
};

const readInterfacesErrorField = (error: unknown): string | undefined => {
  if (!isRecord(error)) {
    return undefined;
  }

  if (typeof error.field === 'string') {
    return error.field;
  }

  return readInterfacesErrorField(error.cause) ?? readInterfacesErrorField(error.response) ?? readInterfacesErrorField(error.data);
};

const readInterfacesErrorCode = (error: unknown): SvaMainserverConnectionStatus['errorCode'] | undefined => {
  if (error instanceof Error) {
    const translated = getTranslatedErrorMessage(error.message as SvaMainserverConnectionStatus['errorCode']);
    if (translated) {
      return error.message as SvaMainserverConnectionStatus['errorCode'];
    }
  }

  if (!isRecord(error)) {
    return undefined;
  }

  if (typeof error.error === 'string') {
    const translated = getTranslatedErrorMessage(error.error as SvaMainserverConnectionStatus['errorCode']);
    if (translated) {
      return error.error as SvaMainserverConnectionStatus['errorCode'];
    }
  }

  return readInterfacesErrorCode(error.cause) ?? readInterfacesErrorCode(error.response) ?? readInterfacesErrorCode(error.data);
};

const getInterfacesErrorMessage = (error: unknown, fallback: string): string => {
  const errorCode = readInterfacesErrorCode(error);
  if (errorCode) {
    return getTranslatedErrorMessage(errorCode, readInterfacesErrorField(error)) ?? fallback;
  }

  return readErrorMessage(error, fallback);
};

const getStatusErrorMessage = (status: SvaMainserverConnectionStatus | null): string | null => {
  if (!status || status.status !== 'error') {
    return null;
  }

  return getTranslatedErrorMessage(status.errorCode) ?? status.errorMessage ?? null;
};

export const InterfacesPage = () => {
  const loadOverview = useServerFn(loadInterfacesOverview);
  const saveSettings = useServerFn(saveSvaMainserverInterfaceSettings);

  // useServerFn gibt bei jedem Render eine neue Referenz zurück.
  // Refs sorgen für stabile Callbacks ohne useEffect-Re-Runs.
  const loadOverviewRef = React.useRef(loadOverview);
  const saveSettingsRef = React.useRef(saveSettings);
  loadOverviewRef.current = loadOverview;
  saveSettingsRef.current = saveSettings;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [lastStatus, setLastStatus] = React.useState<SvaMainserverConnectionStatus | null>(null);
  const [instanceId, setInstanceId] = React.useState<string>('');
  const [formValues, setFormValues] = React.useState<FormValues>(emptyFormValues);
  const didInitialRefreshRef = React.useRef(false);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const overview = await loadOverviewRef.current();
      setInstanceId(overview.instanceId);
      setLastStatus(overview.status);
      setFormValues(toFormValues(overview.config));
    } catch (error) {
      setErrorMessage(getInterfacesErrorMessage(error, t('interfaces.messages.loadError')));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (didInitialRefreshRef.current) {
      return;
    }
    didInitialRefreshRef.current = true;
    refresh().catch(() => undefined);
  }, [refresh]);

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await saveSettingsRef.current({
        data: {
          graphqlBaseUrl: formValues.graphqlBaseUrl,
          oauthTokenUrl: formValues.oauthTokenUrl,
          enabled: formValues.enabled,
        },
      });

      setStatusMessage(t('interfaces.messages.saveSuccess'));
      await refresh();
    } catch (error) {
      setErrorMessage(getInterfacesErrorMessage(error, t('interfaces.messages.saveError')));
    } finally {
      setIsSaving(false);
    }
  };

  const statusErrorMessage = getStatusErrorMessage(lastStatus);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('interfaces.messages.loading')}</p>;
  }

  return (
    <div className="flex flex-col gap-6 text-foreground">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('interfaces.page.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('interfaces.page.subtitle')}</p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
            {t('interfaces.status.cardTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm">
            {t('interfaces.status.instanceLabel')}: <span className="font-medium">{instanceId}</span>
          </p>
          <p className="text-sm">
            {t('interfaces.status.currentLabel')}:{' '}
            <span className="font-medium">{lastStatus ? getStatusLabel(lastStatus) : t('interfaces.status.unknown')}</span>
          </p>
          {lastStatus?.checkedAt ? (
            <p className="text-xs text-muted-foreground">
              {t('interfaces.status.lastCheckedLabel')}: {new Date(lastStatus.checkedAt).toLocaleString()}
            </p>
          ) : null}
          {statusErrorMessage ? (
            <Alert className="border-secondary/40 bg-secondary/10 text-secondary">
              <AlertDescription>{statusErrorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-[0.16em] text-muted-foreground">
            {t('interfaces.form.sectionTitle')}
          </CardTitle>
          <CardDescription>{t('interfaces.page.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave().catch(() => undefined);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="interfaces-graphql-base-url">{t('interfaces.form.graphqlBaseUrl')}</Label>
            <Input
              id="interfaces-graphql-base-url"
              type="url"
              value={formValues.graphqlBaseUrl}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFormValues((current) => ({
                  ...current,
                  graphqlBaseUrl: value,
                }));
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="interfaces-oauth-token-url">{t('interfaces.form.oauthTokenUrl')}</Label>
            <Input
              id="interfaces-oauth-token-url"
              type="url"
              value={formValues.oauthTokenUrl}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFormValues((current) => ({
                  ...current,
                  oauthTokenUrl: value,
                }));
              }}
            />
          </div>

          <Label htmlFor="interfaces-enabled" className="flex items-center gap-3">
            <Checkbox
              id="interfaces-enabled"
              checked={formValues.enabled}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setFormValues((current) => ({
                  ...current,
                  enabled: checked,
                }));
              }}
            />
            <span>{t('interfaces.form.enabled')}</span>
          </Label>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t('interfaces.actions.saving') : t('interfaces.actions.save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                refresh().catch(() => undefined);
              }}
              disabled={isSaving}
            >
              {t('interfaces.actions.reload')}
            </Button>
          </div>
        </form>
        </CardContent>
      </Card>

      {statusMessage ? (
        <Alert className="border-primary/40 bg-primary/10 text-primary">
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      ) : null}
      {errorMessage ? (
        <Alert className="border-secondary/40 bg-secondary/10 text-secondary">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
};
