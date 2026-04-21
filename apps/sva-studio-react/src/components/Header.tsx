/**
 * Header-Komponente der App-Shell mit globalen Aktionen.
 *
 * Die Komponente zeigt abhängig vom Auth-Status Login-/Logout-Aktionen
 * und unterstützt einen optionalen Loading-Zustand für Skeleton-Rendering.
 */
import { Menu, Moon, Sun } from 'lucide-react';
import React from 'react';
import { Link } from '@tanstack/react-router';

import { OrganizationContextSwitcher } from './OrganizationContextSwitcher';
import { Button } from './ui/button';
import { t } from '../i18n';
import { createLoginHref, resolveCurrentReturnTo } from '../lib/auth-navigation';
import { useAuth } from '../providers/auth-provider';
import { useLocale } from '../providers/locale-provider';
import { useTheme } from '../providers/theme-provider';

type HeaderProps = Readonly<{
  isLoading?: boolean;
  isMobileNavigationOpen?: boolean;
  onOpenMobileNavigation?: () => void;
}>;

/**
 * Rendert die Kopfzeile mit globalen Aktionen.
 *
 * @param props - Konfiguration des Header-Verhaltens.
 * @param props.isLoading - Aktiviert Skeleton-Darstellung während Router-Navigation.
 */
export default function Header({
  isLoading = false,
  isMobileNavigationOpen = false,
  onOpenMobileNavigation,
}: HeaderProps) {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { locale, setLocale } = useLocale();
  const { mode, toggleMode } = useTheme();
  const [isHydrated, setIsHydrated] = React.useState(false);
  const resolvedMode = isHydrated ? mode : 'light';
  const loginHref = isHydrated ? createLoginHref(resolveCurrentReturnTo()) : '/auth/login';
  const showOrganizationContext = isHydrated && isAuthenticated && !isLoading && !isAuthLoading && Boolean(user);

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  let authAction: React.ReactNode = null;

  if (!isHydrated || isLoading || isAuthLoading) {
    authAction = (
      <>
        <span role="status" aria-live="polite" className="sr-only">
          {t('shell.header.authLoading')}
        </span>
        <span aria-hidden="true" className="ml-2 h-8 w-20 animate-pulse rounded-md bg-muted" />
      </>
    );
  } else if (!isAuthenticated) {
    authAction = (
      <Button asChild className="ml-2" variant="secondary">
        <a href={loginHref}>{t('shell.header.login')}</a>
      </Button>
    );
  } else if (user) {
    authAction = (
      <>
        <Button asChild className="ml-2" variant="outline">
          <Link to="/account">{t('shell.sidebar.account')}</Link>
        </Button>
        <form action="/auth/logout" method="post" className="ml-2">
          <input type="hidden" name="logoutIntent" value="user" />
          <Button type="submit" variant="destructive">
            {t('shell.header.logout')}
          </Button>
        </form>
      </>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-sm text-foreground sm:px-6">
        <div className="flex min-w-0 items-center">
          {onOpenMobileNavigation ? (
            <Button
              type="button"
              className="lg:hidden"
              aria-label={isMobileNavigationOpen ? t('shell.header.closeNavigation') : t('shell.header.openNavigation')}
              aria-expanded={isMobileNavigationOpen}
              aria-controls="mobile-sidebar"
              onClick={onOpenMobileNavigation}
              size="icon"
              variant="outline"
            >
              <Menu className="h-5 w-5" />
            </Button>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          {showOrganizationContext ? <OrganizationContextSwitcher /> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 text-muted-foreground sm:gap-4">
          <fieldset className="inline-flex items-center overflow-hidden rounded-md border border-border bg-background shadow-sm">
            <legend className="sr-only">{t('shell.header.languageSwitcher')}</legend>
            <Button
              type="button"
              variant={locale === 'de' ? 'default' : 'ghost'}
              size="sm"
              aria-pressed={locale === 'de'}
              aria-label={t('shell.header.switchToGerman')}
              className="rounded-none border-0"
              onClick={() => setLocale('de')}
            >
              {t('shell.header.languageOptionDe')}
            </Button>
            <Button
              type="button"
              variant={locale === 'en' ? 'default' : 'ghost'}
              size="sm"
              aria-pressed={locale === 'en'}
              aria-label={t('shell.header.switchToEnglish')}
              className="rounded-none border-0 border-l border-border"
              onClick={() => setLocale('en')}
            >
              {t('shell.header.languageOptionEn')}
            </Button>
          </fieldset>
          <Button
            type="button"
            aria-label={
              resolvedMode === 'dark' ? t('shell.header.switchToLightMode') : t('shell.header.switchToDarkMode')
            }
            onClick={toggleMode}
            variant="outline"
          >
            {resolvedMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {resolvedMode === 'dark' ? t('shell.header.themeModeDark') : t('shell.header.themeModeLight')}
            </span>
          </Button>
          {authAction}
        </div>
      </div>
    </header>
  );
}
