import React from 'react';
import { Link } from '@tanstack/react-router';

import { t } from '../i18n';
import { createLoginHref, resolveCurrentReturnTo } from '../lib/auth-navigation';
import { useAuth } from '../providers/auth-provider';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export const HomePage = () => {
  const { user, isAuthenticated, isLoading, error } = useAuth();
  const [authStateError, setAuthStateError] = React.useState<string | null>(null);
  const [routeError, setRouteError] = React.useState<string | null>(null);
  const loginHref = React.useMemo(() => createLoginHref(resolveCurrentReturnTo()), []);

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
      <section className="border-b border-border bg-gradient-to-b from-muted/40 via-background to-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-12 pt-12">
          <div className="flex flex-col gap-6 lg:max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{t('home.hero.eyebrow')}</p>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t('shell.appName')}</h1>
              <p className="max-w-2xl text-lg text-muted-foreground">{t('home.hero.subtitle')}</p>
              <p className="max-w-2xl text-sm text-muted-foreground">{t('home.hero.body')}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {isAuthenticated ? (
                <>
                  <Button asChild>
                    <Link to="/content">{t('home.hero.primaryAction')}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/account">{t('home.hero.secondaryAction')}</Link>
                  </Button>
                </>
              ) : (
                <Button asChild>
                  <a href={loginHref}>{t('home.hero.loginAction')}</a>
                </Button>
              )}
            </div>
          </div>

          <Card className="max-w-3xl">
            <CardHeader className="pb-4">
              <CardTitle>{t('home.session.title')}</CardTitle>
              <CardDescription>{t('home.session.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">{t('home.session.loading')}</p>
              ) : user ? (
                <>
                  <p className="text-sm font-medium text-foreground">{t('home.session.authenticatedTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('home.session.authenticatedBody')}</p>
                  {user.instanceId ? (
                    <p className="text-sm text-muted-foreground">{t('home.session.instance', { instanceId: user.instanceId })}</p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">{t('home.session.unauthenticatedTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('home.session.unauthenticatedBody')}</p>
                </>
              )}
              {authError ? (
                <div className="rounded-lg border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-secondary">
                  {authError}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      {isAuthenticated ? (
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
                  <Link to="/content">{t('home.cards.content.action')}</Link>
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
      ) : (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>{t('home.guest.title')}</CardTitle>
              <CardDescription>{t('home.guest.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <a href={loginHref}>{t('home.guest.action')}</a>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
};
