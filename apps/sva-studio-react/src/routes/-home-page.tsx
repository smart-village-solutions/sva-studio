import React from 'react';
import { Link } from '@tanstack/react-router';

import { t } from '../i18n';
import { readLatestAuthDiagnosticSnapshot } from '../lib/auth-diagnostics';
import { createLoginHref, sanitizeReturnTo } from '../lib/auth-navigation';
import { useAuth } from '../providers/auth-provider';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

type HomeRouteState = {
  readonly authStateError: string | null;
  readonly routeError: string | null;
  readonly authReturnTo: string | null;
  readonly shouldStartLoginRedirect: boolean;
  readonly showDevLoginPrompt: boolean;
};

const resolveHomeRouteState = (): HomeRouteState => {
  const search = new URLSearchParams(window.location.search);
  const authState = search.get('auth');
  const routeErrorCode = search.get('error');

  return {
    authReturnTo: sanitizeReturnTo(search.get('returnTo')),
    shouldStartLoginRedirect: authState === 'login',
    showDevLoginPrompt: authState === 'dev-login',
    authStateError:
      authState === 'error'
        ? t('home.authError.loginFailed')
        : authState === 'state-expired'
          ? t('home.authError.stateExpired')
          : authState === 'session-expired'
            ? t('home.authError.sessionExpired')
            : null,
    routeError: routeErrorCode === 'auth.insufficientRole' ? t('home.authError.insufficientRole') : null,
  };
};

const AuthenticatedHeroActions = () => (
  <div className="flex flex-wrap gap-3">
    <Button asChild>
      <Link to="/admin/content">{t('home.hero.primaryAction')}</Link>
    </Button>
    <Button asChild variant="outline">
      <Link to="/account">{t('home.hero.secondaryAction')}</Link>
    </Button>
  </div>
);

const DevAuthPrompt = ({
  showDevLoginPrompt,
  loginWithDevAuth,
}: {
  readonly showDevLoginPrompt: boolean;
  readonly loginWithDevAuth: () => Promise<void> | void;
}) => (
  <div className="flex flex-wrap items-center gap-3">
    <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-800">
      {t('shell.header.devAuthBadge')}
    </span>
    <Button type="button" onClick={() => void loginWithDevAuth()}>
      {t('shell.header.devLogin')}
    </Button>
    {showDevLoginPrompt ? <span className="text-sm text-muted-foreground">{t('home.devAuth.prompt')}</span> : null}
  </div>
);

const HomeAuthErrorBanner = ({
  authError,
  authDiagnosticSnapshot,
  authErrorLoginHref,
}: {
  readonly authError: string;
  readonly authDiagnosticSnapshot: ReturnType<typeof readLatestAuthDiagnosticSnapshot>;
  readonly authErrorLoginHref: string | null;
}) => (
  <div className="flex max-w-2xl flex-col gap-3 rounded-lg border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-secondary sm:flex-row sm:items-center sm:justify-between">
    <span>{authError}</span>
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {authDiagnosticSnapshot.requestId ? (
        <span>{t('home.authError.requestId', { requestId: authDiagnosticSnapshot.requestId })}</span>
      ) : null}
      {authDiagnosticSnapshot.authFlowId ? (
        <span>{t('home.authError.authFlowId', { authFlowId: authDiagnosticSnapshot.authFlowId })}</span>
      ) : null}
      {authErrorLoginHref ? (
        <Button asChild size="sm" variant="outline">
          <a href={authErrorLoginHref}>{t('home.authError.loginAction')}</a>
        </Button>
      ) : null}
    </div>
  </div>
);

const AuthenticatedHomeOverview = () => (
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
);

export const HomePage = () => {
  const {
    isAuthenticated,
    isLoading,
    error,
    sessionRecoveryFailed,
    isDevAuthAvailable,
    loginWithDevAuth,
  } = useAuth();
  const [authStateError, setAuthStateError] = React.useState<string | null>(null);
  const [showDevLoginPrompt, setShowDevLoginPrompt] = React.useState(false);
  const [routeError, setRouteError] = React.useState<string | null>(null);
  const [authReturnTo, setAuthReturnTo] = React.useState<string | null>(null);
  const [shouldStartLoginRedirect, setShouldStartLoginRedirect] = React.useState(false);
  const [authDiagnosticSnapshot, setAuthDiagnosticSnapshot] = React.useState(
    readLatestAuthDiagnosticSnapshot()
  );

  React.useEffect(() => {
    const routeState = resolveHomeRouteState();
    setAuthReturnTo(routeState.authReturnTo);
    setShouldStartLoginRedirect(routeState.shouldStartLoginRedirect);
    setShowDevLoginPrompt(routeState.showDevLoginPrompt);
    setAuthStateError(routeState.authStateError);
    setRouteError(routeState.routeError);
  }, []);

  React.useEffect(() => {
    setAuthDiagnosticSnapshot(readLatestAuthDiagnosticSnapshot());
  }, [error, sessionRecoveryFailed]);

  React.useEffect(() => {
    if (!shouldStartLoginRedirect || isLoading || isAuthenticated) {
      return;
    }

    window.location.replace(createLoginHref(authReturnTo ?? undefined));
  }, [authReturnTo, isAuthenticated, isLoading, shouldStartLoginRedirect]);

  const authError =
    authStateError ??
    routeError ??
    (sessionRecoveryFailed ? t('home.authError.sessionExpired') : null) ??
    (error ? t('home.authError.sessionLoadFailed') : null);
  const authErrorLoginHref =
    authError && !isAuthenticated ? createLoginHref(authReturnTo ?? undefined) : null;

  return (
    <div className="min-h-full bg-background text-foreground">
      <section className="bg-gradient-to-b from-muted/40 via-background to-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-12 pt-12">
          <div className="flex flex-col gap-6 lg:max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
              {t('home.hero.eyebrow')}
            </p>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                {t('shell.appName')}
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">{t('home.hero.subtitle')}</p>
              <p className="max-w-2xl text-sm text-muted-foreground">{t('home.hero.body')}</p>
            </div>
            {isAuthenticated ? <AuthenticatedHeroActions /> : null}
            {!isAuthenticated && !isLoading && isDevAuthAvailable ? (
              <DevAuthPrompt showDevLoginPrompt={showDevLoginPrompt} loginWithDevAuth={loginWithDevAuth} />
            ) : null}
            {authError ? (
              <HomeAuthErrorBanner
                authError={authError}
                authDiagnosticSnapshot={authDiagnosticSnapshot}
                authErrorLoginHref={authErrorLoginHref}
              />
            ) : null}
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-sm text-muted-foreground">{t('home.session.loading')}</p>
        </section>
      ) : isAuthenticated ? (
        <AuthenticatedHomeOverview />
      ) : null}
    </div>
  );
};
