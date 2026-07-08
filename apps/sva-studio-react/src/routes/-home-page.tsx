import React from 'react';
import { Link } from '@tanstack/react-router';
import { Heart } from 'lucide-react';

import { t } from '../i18n';
import { readLatestAuthDiagnosticSnapshot } from '../lib/auth-diagnostics';
import { createLoginHref, sanitizeReturnTo } from '../lib/auth-navigation';
import { type StudioChangelogState } from '../lib/studio-changelog-state';
import { useAuth } from '../providers/auth-provider';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { loadStudioChangelogState, StudioChangelogSection } from './-home-page-studio-changelog';

type HomeRouteState = {
  readonly authStateError: string | null;
  readonly routeError: string | null;
  readonly authReturnTo: string | null;
  readonly shouldStartLoginRedirect: boolean;
  readonly showDevLoginPrompt: boolean;
  readonly consumedAuthSearch: boolean;
};

const AUTH_STATE_ERROR_KEYS = {
  error: 'home.authError.loginFailed',
  'state-expired': 'home.authError.stateExpired',
  'session-expired': 'home.authError.sessionExpired',
} as const;

const hasOwn = <T extends object>(value: T, key: PropertyKey): key is keyof T =>
  Object.prototype.hasOwnProperty.call(value, key);

const resolveHomeAuthStateError = (authState: string | null): string | null => {
  if (!authState || !hasOwn(AUTH_STATE_ERROR_KEYS, authState)) {
    return null;
  }

  const translationKey = AUTH_STATE_ERROR_KEYS[authState];
  return typeof translationKey === 'string' ? t(translationKey) : null;
};

const resolveHomeRouteState = (): HomeRouteState => {
  const search = new URLSearchParams(window.location.search);
  const authState = search.get('auth');
  const routeErrorCode = search.get('error');
  const consumedAuthSearch = search.has('auth') || search.has('error') || search.has('returnTo');

  return {
    authReturnTo: sanitizeReturnTo(search.get('returnTo')),
    shouldStartLoginRedirect: authState === 'login',
    showDevLoginPrompt: authState === 'dev-login',
    authStateError: resolveHomeAuthStateError(authState),
    routeError: routeErrorCode === 'auth.insufficientRole' ? t('home.authError.insufficientRole') : null,
    consumedAuthSearch,
  };
};

const clearConsumedHomeAuthSearch = (): void => {
  const url = new URL(window.location.href);
  url.searchParams.delete('auth');
  url.searchParams.delete('error');
  url.searchParams.delete('returnTo');
  const nextSearch = url.searchParams.toString();
  const nextHref = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
  window.history.replaceState(window.history.state, '', nextHref);
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

const AnonymousHeroActions = ({
  loginHref,
}: {
  readonly loginHref: string;
}) => (
  <div className="flex w-full max-w-xl flex-col items-center gap-3 sm:flex-row sm:justify-center">
    <Button asChild className="h-12 min-w-48 rounded-full px-8 text-base">
      <a href={loginHref}>{t('shell.header.login')}</a>
    </Button>
  </div>
);

const HomeOpenSourceClaim = () => (
  <p className="text-sm font-medium text-muted-foreground">
    <a
      href="https://github.com/smart-village-solutions/sva-studio"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 underline-offset-4 transition-colors hover:text-foreground hover:underline"
    >
      <span>{`${t('home.hero.openSourcePrefix')} `}</span>
      <span aria-label={t('home.hero.openSourceLoveLabel')} className="inline-flex items-center text-rose-500">
        <Heart aria-hidden="true" className="h-4 w-4 fill-current" strokeWidth={1.8} />
        <span className="sr-only">{t('home.hero.openSourceLoveLabel')}</span>
      </span>
      <span>{` ${t('home.hero.openSourceSuffix')}`}</span>
    </a>
  </p>
);

const DevAuthPrompt = ({
  showDevLoginPrompt,
  loginWithDevAuth,
}: {
  readonly showDevLoginPrompt: boolean;
  readonly loginWithDevAuth: () => Promise<void> | void;
}) => (
  <div className="flex flex-wrap items-center justify-center gap-3">
    <span className="rounded-full border border-amber-300/70 bg-amber-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-200">
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

const AuthenticatedHomeOverview = ({
  changelogState,
}: {
  readonly changelogState: StudioChangelogState;
}) => (
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

    <StudioChangelogSection changelogState={changelogState} />
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
  const initialRouteState = React.useMemo(
    () => (typeof window === 'undefined' ? null : resolveHomeRouteState()),
    []
  );
  const authStateError = initialRouteState?.authStateError ?? null;
  const showDevLoginPrompt = initialRouteState?.showDevLoginPrompt ?? false;
  const routeError = initialRouteState?.routeError ?? null;
  const authReturnTo = initialRouteState?.authReturnTo ?? null;
  const shouldStartLoginRedirect = initialRouteState?.shouldStartLoginRedirect ?? false;
  const [authDiagnosticSnapshot, setAuthDiagnosticSnapshot] = React.useState(
    readLatestAuthDiagnosticSnapshot()
  );

  React.useEffect(() => {
    if (initialRouteState?.consumedAuthSearch) {
      clearConsumedHomeAuthSearch();
    }
  }, [initialRouteState]);

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
  const authErrorLoginHref = !isAuthenticated && authError ? createLoginHref(authReturnTo ?? undefined) : null;
  const heroLoginHref = createLoginHref(authReturnTo ?? undefined);
  const isAnonymousHome = !isAuthenticated;
  const [changelogState, setChangelogState] = React.useState<StudioChangelogState>({
    status: 'loading',
    entries: [],
  });

  React.useEffect(() => {
    if (!isAuthenticated) {
      setChangelogState({ status: 'loading', entries: [] });
      return;
    }

    let cancelled = false;
    void loadStudioChangelogState().then((nextState) => {
      if (!cancelled) {
        setChangelogState(nextState);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <div className="min-h-full bg-background text-foreground">
      <section className="bg-[radial-gradient(circle_at_top,_rgba(0,90,158,0.18),_transparent_34%),linear-gradient(to_bottom,_rgba(241,246,252,0.98),_rgba(255,255,255,0.99)_44%,_rgb(var(--background))_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(74,132,188,0.22),_transparent_30%),linear-gradient(to_bottom,_rgba(10,16,24,1),_rgba(13,20,30,0.98)_38%,_rgb(var(--background))_100%)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-16 pt-16 sm:pb-20 sm:pt-20">
          <div
            className={
              isAuthenticated
                ? 'flex flex-col gap-6 lg:max-w-3xl'
                : 'flex flex-col items-center gap-8 rounded-[2rem] border border-border/50 bg-background/80 px-6 py-10 text-center shadow-[0_24px_70px_rgba(0,90,158,0.1)] backdrop-blur-sm dark:border-border/60 dark:bg-card/75 dark:shadow-[0_30px_80px_rgba(4,16,32,0.42)] sm:px-10 sm:py-12'
            }
          >
            <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
              {isAuthenticated ? t('home.hero.eyebrow') : 'Willkommen'}
            </p>
            <div className={isAuthenticated ? 'space-y-4' : 'max-w-3xl space-y-5'}>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                {t('shell.appName')}
              </h1>
              {isAuthenticated ? (
                <>
                  <p className="max-w-2xl text-lg text-muted-foreground">{t('home.hero.subtitle')}</p>
                  <p className="max-w-2xl text-sm text-muted-foreground">{t('home.hero.body')}</p>
                </>
              ) : (
                <>
                  <p className="text-lg text-foreground sm:text-xl dark:text-foreground/95">
                    Die gemeinsame Oberfläche für Inhalte, Module und Organisationen.
                  </p>
                  <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                    Melden Sie sich an, um Inhalte zu verwalten, Fachmodule zu öffnen und in Ihrem Arbeitskontext direkt weiterzuarbeiten.
                  </p>
                </>
              )}
            </div>
            {isAuthenticated ? <AuthenticatedHeroActions /> : !isLoading ? <AnonymousHeroActions loginHref={heroLoginHref} /> : null}
            {isAnonymousHome && !isLoading && isDevAuthAvailable ? (
              <DevAuthPrompt showDevLoginPrompt={showDevLoginPrompt} loginWithDevAuth={loginWithDevAuth} />
            ) : null}
            {authError ? (
              <HomeAuthErrorBanner
                authError={authError}
                authDiagnosticSnapshot={authDiagnosticSnapshot}
                authErrorLoginHref={authErrorLoginHref}
              />
            ) : null}
            <HomeOpenSourceClaim />
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-sm text-muted-foreground">{t('home.session.loading')}</p>
        </section>
      ) : isAuthenticated ? (
        <AuthenticatedHomeOverview changelogState={changelogState} />
      ) : null}
    </div>
  );
};
