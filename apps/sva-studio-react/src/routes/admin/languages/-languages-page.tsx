import { useEffect, useState } from 'react';
import { Button, Checkbox, Select, StudioOverviewPageTemplate } from '@sva/studio-ui-react';
import { createMainserverJsonRequestHeaders, requestMainserverJson } from '@sva/plugin-sdk';
import type { LanguageOverview } from '@sva/plugin-sdk/app-translations';
import { useInstances } from '../../../hooks/use-instances';
import { t } from '../../../i18n';

export const LanguagesPage = () => {
  const { instances, error: instancesError } = useInstances();
  const [instanceId, setInstanceId] = useState('');
  const [data, setData] = useState<LanguageOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const languages = [...(data?.languages ?? [])].sort(
    (left, right) =>
      Number(right.locale === 'de') - Number(left.locale === 'de') ||
      t(`shell.languages.locales.${left.locale}`).localeCompare(
        t(`shell.languages.locales.${right.locale}`),
        'de'
      )
  );
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    void requestMainserverJson<{ data: LanguageOverview }>({
      url: `/api/v1/iam/languages${instanceId ? `?${new URLSearchParams({ instanceId })}` : ''}`,
      init: { method: 'GET', cache: 'no-store', signal: controller.signal },
    })
      .then((result) => {
        if (!controller.signal.aborted) setData(result.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [instanceId, reload]);
  const update = async (input: Record<string, unknown>) => {
    setBusy(true);
    setError(false);
    try {
      await requestMainserverJson({
        url: '/api/v1/iam/languages',
        init: {
          method: 'POST',
          headers: createMainserverJsonRequestHeaders(),
          body: JSON.stringify(input),
        },
      });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      setReload((value) => value + 1);
    }
  };
  return (
    <StudioOverviewPageTemplate
      title={t('shell.languages.title')}
      description={t('shell.languages.description')}
      primaryAction={
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => setReload((value) => value + 1)}
        >
          {t('shell.languages.reload')}
        </Button>
      }
    >
      {(error || instancesError) && (
        <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
          {t('shell.languages.error')}
        </p>
      )}
      <section className="space-y-3" aria-busy={!data || busy}>
        <h2 className="text-xl font-semibold">{t('shell.languages.available')}</h2>
        <p className="text-sm text-muted-foreground">{t('shell.languages.availableHelp')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {languages.map((language) => (
            <label key={language.locale} className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox
                checked={language.available}
                disabled={busy || language.locale === 'de'}
                onChange={(event) =>
                  void update({
                    operation: 'availability',
                    locale: language.locale,
                    available: event.target.checked,
                    expectedRevision: language.revision,
                  })
                }
              />
              {t(`shell.languages.locales.${language.locale}`)}
            </label>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t('shell.languages.assignments')}</h2>
        <label htmlFor="languages-instance">{t('shell.languages.instance')}</label>
        <Select
          id="languages-instance"
          value={instanceId}
          disabled={busy}
          onChange={(event) => setInstanceId(event.target.value)}
        >
          <option value="">{t('shell.languages.chooseInstance')}</option>
          {instances.map((instance) => (
            <option key={instance.instanceId} value={instance.instanceId}>
              {instance.displayName} ({instance.instanceId})
            </option>
          ))}
        </Select>
        {!instanceId && (
          <p className="text-sm text-muted-foreground">{t('shell.languages.chooseHelp')}</p>
        )}
        {instanceId && data && (
          <>
            {!data.moduleAllowed && (
              <p role="status" className="text-sm text-muted-foreground">
                {t('shell.languages.moduleRequired')}
              </p>
            )}
            <p className="text-sm text-muted-foreground">{t('shell.languages.assignmentHelp')}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {languages.map((language) => {
                const assignment = data.assignments.find((item) => item.locale === language.locale);
                const checked = language.locale === 'de' || assignment?.enabled === true;
                return (
                  <label
                    key={language.locale}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={
                        busy ||
                        language.locale === 'de' ||
                        (!checked && (!language.available || !data.moduleAllowed))
                      }
                      onChange={(event) =>
                        void update({
                          operation: 'assignment',
                          instanceId,
                          locale: language.locale,
                          enabled: event.target.checked,
                          expectedRevision: assignment?.revision ?? '0',
                        })
                      }
                    />
                    <span>
                      {t(`shell.languages.locales.${language.locale}`)}
                      {!language.available && (
                        <span className="block text-sm text-muted-foreground">
                          {t('shell.languages.unavailable')}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </section>
    </StudioOverviewPageTemplate>
  );
};
