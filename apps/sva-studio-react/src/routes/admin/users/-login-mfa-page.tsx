import * as React from 'react';
import type { LoginMfaMode, TenantLoginMfaPolicyView } from '@sva/core';
import { Button, StudioLoadingState } from '@sva/studio-ui-react';
import { t } from '../../../i18n';
import { getTenantLoginMfa, updateTenantLoginMfa } from '../../../lib/iam-api';

export const LoginMfaPage = () => {
  const [view, setView] = React.useState<TenantLoginMfaPolicyView | null>(null);
  const [mode, setMode] = React.useState<LoginMfaMode>('optional');
  const [error, setError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    void getTenantLoginMfa()
      .then(({ data }) => {
        if (active) {
          setView(data);
          setMode(data.policy.desiredMode);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  React.useEffect(() => {
    if (view?.policy.status !== 'pending') return;
    let active = true;
    const timer = setTimeout(() => {
      void getTenantLoginMfa()
        .then(({ data }) => {
          if (active) setView(data);
        })
        .catch(() => {
          if (active) setError(true);
        });
    }, 5000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [view]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!view || !['optional', 'required'].includes(mode)) return;
    setSaving(true);
    setError(false);
    try {
      const { data } = await updateTenantLoginMfa({ mode, expectedRevision: view.revision });
      setView(data);
    } catch {
      setError(true);
      const response = await getTenantLoginMfa().catch(() => null);
      if (response) setView(response.data);
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('admin.instances.loginMfa.title')}</h1>
        <p className="text-muted-foreground">{t('admin.instances.loginMfa.description')}</p>
      </header>
      {error && (
        <p role="alert" className="text-destructive">
          {t('admin.instances.loginMfa.error')}
        </p>
      )}
      {view ? (
        <form
          onSubmit={(event) => {
            void save(event);
          }}
          className="space-y-4 rounded-lg border bg-card p-6"
        >
          <label className="block space-y-2" htmlFor="login-mfa-mode">
            <span>{t('admin.instances.loginMfa.label')}</span>
            <select
              id="login-mfa-mode"
              value={mode}
              disabled={saving}
              onChange={(event) => {
                if (event.target.value === 'optional' || event.target.value === 'required')
                  setMode(event.target.value);
              }}
              className="block w-full rounded-md border bg-background p-2 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <option value="optional">{t('admin.instances.loginMfa.optional')}</option>
              <option value="required">{t('admin.instances.loginMfa.required')}</option>
            </select>
          </label>
          <p>{t('admin.instances.loginMfa.enrollment')}</p>
          <div role="status" aria-live="polite" className="space-y-1">
            <p>{t(`admin.instances.loginMfa.${view.policy.status}`)}</p>
            <p>
              {t('admin.instances.loginMfa.appliedMode', {
                mode: t(`admin.instances.loginMfa.${view.policy.appliedMode ?? 'unverified'}`),
              })}
            </p>
          </div>
          <Button type="submit" disabled={saving}>
            {t('admin.instances.loginMfa.save')}
          </Button>
        </form>
      ) : (
        !error && <StudioLoadingState>{t('admin.instances.loginMfa.loading')}</StudioLoadingState>
      )}
    </main>
  );
};
