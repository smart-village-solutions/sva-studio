import React from 'react';
import { Link } from '@tanstack/react-router';

import { t } from '../i18n';
import { useAuth } from '../providers/auth-provider';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export const HomePage = () => {
  const { isAuthenticated, isLoading, error } = useAuth();
  const [authStateError, setAuthStateError] = React.useState<string | null>(null);
  const [routeError, setRouteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const authState = search.get('auth');
    const routeErrorCode = search.get('error');
    if (authState === 'error') {
      setAuthStateError(t('home.authError.loginFailed'));
    } else if (authState === 'state-expired') {
      setAuthStateError(t('home.authError.stateExpired'));
    } else {
      setAuthStateError(null);
    }

    if (routeErrorCode === 'auth.insufficientRole') {
      setRouteError(t('home.authError.insufficientRole'));
    } else {
      setRouteError(null);
    }
  }, []);

  const authError = authStateError ?? routeError ?? (error ? t('home.authError.sessionLoadFailed') : null);

  return (
    <div className="min-h-full bg-background text-foreground">
      <section className="bg-gradient-to-b from-muted/40 via-background to-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-12 pt-12">
          <div className="flex flex-col gap-6 lg:max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{t('home.hero.eyebrow')}</p>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t('shell.appName')}</h1>
              <p className="max-w-2xl text-lg text-muted-foreground">{t('home.hero.subtitle')}</p>
              <p className="max-w-2xl text-sm text-muted-foreground">{t('home.hero.body')}</p>
            </div>
            {isAuthenticated ? (
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/admin/content">{t('home.hero.primaryAction')}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/account">{t('home.hero.secondaryAction')}</Link>
                </Button>
              </div>
            ) : null}
            {authError ? (
              <div className="max-w-2xl rounded-lg border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-secondary">
                {authError}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-sm text-muted-foreground">{t('home.session.loading')}</p>
        </section>
      ) : isAuthenticated ? (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{t('home.sections.overviewTitle')}</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">{t('home.sections.overviewBody')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>{t('home.cards.content.title')}</CardTitle>
                <CardDescription>{t('home.cards.content.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link to="/admin/content">{t('home.cards.content.action')}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('home.cards.account.title')}</CardTitle>
                <CardDescription>{t('home.cards.account.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link to="/account">{t('home.cards.account.action')}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('home.cards.interfaces.title')}</CardTitle>
                <CardDescription>{t('home.cards.interfaces.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link to="/interfaces">{t('home.cards.interfaces.action')}</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
};
