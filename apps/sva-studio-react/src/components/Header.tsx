/**
 * Header-Komponente der App-Shell mit Branding und Auth-Aktion.
 *
 * Die Komponente zeigt abhängig vom Auth-Status eine Login- oder Logout-Aktion
 * und unterstützt einen optionalen Loading-Zustand für Skeleton-Rendering.
 */
import { Link } from '@tanstack/react-router';
import { Menu, Moon, Sun } from 'lucide-react';
import React from 'react';

import { t } from '../i18n';
import { useAuth } from '../providers/auth-provider';
import { useTheme } from '../providers/theme-provider';

type HeaderProps = Readonly<{
  isLoading?: boolean;
  isMobileNavigationOpen?: boolean;
  onOpenMobileNavigation?: () => void;
}>;

/**
 * Rendert die Kopfzeile inklusive Branding und Auth-Aktion.
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
  const { mode, themeLabel, toggleMode } = useTheme();

  let authAction: React.ReactNode = null;

  if (isLoading || isAuthLoading) {
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
      <Link
        className="ml-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 font-semibold text-primary transition hover:border-primary hover:bg-primary/20"
        to="/auth/login"
        reloadDocument
      >
        {t('shell.header.login')}
      </Link>
    );
  } else if (user) {
    authAction = (
      <form action="/auth/logout" method="post" className="ml-2">
        <button
          type="submit"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 font-semibold text-destructive transition hover:border-destructive hover:bg-destructive/20"
        >
          {t('shell.header.logout')}
        </button>
      </form>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-sm text-foreground sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-shell transition hover:bg-accent hover:text-accent-foreground lg:hidden"
            aria-label={isMobileNavigationOpen ? t('shell.header.closeNavigation') : t('shell.header.openNavigation')}
            aria-expanded={isMobileNavigationOpen}
            aria-controls="mobile-sidebar"
            onClick={onOpenMobileNavigation}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link className="flex min-w-0 items-center gap-3 font-semibold tracking-wide text-foreground" to="/">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              SVA
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold">SVA Studio</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{themeLabel}</span>
            </span>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground sm:gap-4">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-foreground shadow-shell transition hover:bg-accent hover:text-accent-foreground"
            aria-label={mode === 'dark' ? t('shell.header.switchToLightMode') : t('shell.header.switchToDarkMode')}
            onClick={toggleMode}
          >
            {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="hidden sm:inline">{mode === 'dark' ? t('shell.header.themeModeDark') : t('shell.header.themeModeLight')}</span>
          </button>
          {authAction}
        </div>
      </div>
    </header>
  );
}
