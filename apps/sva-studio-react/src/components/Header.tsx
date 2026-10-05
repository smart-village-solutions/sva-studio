/** Header-Komponente der App-Shell mit globalen Aktionen. */
import {
  Bell,
  Languages,
  Menu,
  MessageCircle,
  Moon,
  Search,
  SendHorizontal,
  Sun,
} from 'lucide-react';
import React from 'react';
import { useRouterState } from '@tanstack/react-router';
import {
  resolveOrganizationContextState,
  resolveUserDisplayName,
  resolveUserInitials,
} from '@sva/core';
import { Button } from '@sva/studio-ui-react';
import { Input } from './ui/input';
import { t } from '../i18n';
import { createLoginHref, resolveCurrentReturnTo } from '../lib/auth-navigation';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { hasExperimentalAccess } from '../lib/iam-admin-access';
import { useAuth } from '../providers/auth-provider';
import { useLocale } from '../providers/locale-provider';
import { useTheme } from '../providers/theme-provider';
import { HeaderAuthAction } from './header-auth-action';
import { HeaderDropdownMenu, type HeaderDropdownItem } from './header-dropdown-menu';

type HeaderProps = Readonly<{
  isLoading?: boolean;
  isMobileNavigationOpen?: boolean;
  onOpenMobileNavigation?: () => void;
}>;

const iconButtonClassName =
  'h-10 w-10 rounded-full border border-transparent bg-transparent px-0 text-muted-foreground shadow-none hover:border-border hover:bg-card hover:text-foreground';

const LocaleFlag = ({ locale }: { readonly locale: 'de' | 'en' }) => {
  if (locale === 'de') {
    return <span aria-hidden="true">🇩🇪</span>;
  }

  return <span aria-hidden="true">🇬🇧</span>;
};

const HeaderPromptField = ({
  icon,
  label,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
}) => (
  <div className="relative min-w-0 flex-1">
    <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground">
      {icon}
    </span>
    <Input
      type="text"
      value={label}
      readOnly
      disabled
      aria-label={label}
      className="h-11 rounded-full border-border bg-[rgb(var(--waste-panel-surface))] pl-11 pr-11 text-sm text-muted-foreground disabled:bg-[rgb(var(--waste-panel-surface))] disabled:text-muted-foreground disabled:opacity-100"
    />
    <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground">
      <SendHorizontal className="h-4 w-4" />
    </span>
  </div>
);

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
  const {
    user,
    isAuthenticated,
    isLoading: isAuthLoading,
    isDevAuthAvailable,
    loginWithDevAuth,
    logout,
  } = useAuth();
  const organizationContext = useOrganizationContext();
  const organizationContextState = resolveOrganizationContextState({
    roleNames: user?.roles,
    organizations: organizationContext.context?.organizations,
    storedActiveOrganizationId: organizationContext.context?.activeOrganizationId,
  });
  const isSystemAdmin = organizationContextState.isSystemAdmin;
  const { locale, setLocale } = useLocale();
  const { mode, toggleMode } = useTheme();
  const currentPathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [isHydrated, setIsHydrated] = React.useState(false);
  const resolvedMode = isHydrated ? mode : 'light';
  const loginHref = isHydrated ? createLoginHref(resolveCurrentReturnTo()) : '/auth/login';
  const showOrganizationContext =
    isHydrated &&
    isAuthenticated &&
    !isLoading &&
    !isAuthLoading &&
    Boolean(user) &&
    !organizationContext.isLoading &&
    organizationContextState.hasVisibleMemberships;
  const showAuthenticatedHeaderTools =
    isHydrated && isAuthenticated && !isLoading && !isAuthLoading;
  const showExperimentalHeaderTools = showAuthenticatedHeaderTools && hasExperimentalAccess(user);
  const hideAnonymousLoginAction = !isAuthenticated && currentPathname === '/';
  const displayName = user ? resolveUserDisplayName(user) : '';
  const initials = displayName ? resolveUserInitials(displayName) : '';

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  const languageItems: readonly HeaderDropdownItem[] = [
    {
      id: 'de',
      label: t('shell.header.languageNameDe'),
      description: t('shell.header.languageOptionDe'),
      icon: <LocaleFlag locale="de" />,
      active: locale === 'de',
      onSelect: () => setLocale('de'),
    },
    {
      id: 'en',
      label: t('shell.header.languageNameEn'),
      description: t('shell.header.languageOptionEn'),
      icon: <LocaleFlag locale="en" />,
      active: locale === 'en',
      onSelect: () => setLocale('en'),
    },
  ];
  const notificationItems: readonly HeaderDropdownItem[] = [
    {
      id: 'notifications-empty',
      label: t('shell.header.notificationsEmptyTitle'),
      description: t('shell.header.notificationsEmptyBody'),
      disabled: true,
    },
  ];
  const searchPromptLabel = t('shell.header.searchPrompt');
  const assistantPromptLabel = t('shell.header.assistantPrompt');

  return (
    <header className="sticky top-0 z-40 bg-background">
      <div className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-sm text-foreground sm:px-6">
        <div className="flex min-w-0 items-center">
          {onOpenMobileNavigation ? (
            <Button
              type="button"
              className="lg:hidden"
              aria-label={
                isMobileNavigationOpen
                  ? t('shell.header.closeNavigation')
                  : t('shell.header.openNavigation')
              }
              aria-expanded={isMobileNavigationOpen}
              aria-controls="mobile-sidebar"
              onClick={onOpenMobileNavigation}
              size="icon"
              variant="secondary"
            >
              <Menu className="h-5 w-5" />
            </Button>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showExperimentalHeaderTools ? (
            <div className="hidden min-w-0 flex-1 items-center gap-3 xl:flex">
              <HeaderPromptField icon={<Search className="h-4 w-4" />} label={searchPromptLabel} />
              <HeaderPromptField
                icon={<MessageCircle className="h-4 w-4" />}
                label={assistantPromptLabel}
              />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {showAuthenticatedHeaderTools ? (
            <HeaderDropdownMenu
              align="right"
              menuLabel={t('shell.header.notifications')}
              items={notificationItems}
              trigger={({ open, toggle, menuId }) => (
                <Button
                  type="button"
                  variant="tertiary"
                  size="icon"
                  tooltip={t('shell.header.notificationsTooltip')}
                  aria-label={t('shell.header.notifications')}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-controls={menuId}
                  className={iconButtonClassName}
                  onClick={toggle}
                >
                  <Bell className="h-4 w-4" />
                </Button>
              )}
            />
          ) : null}
          <HeaderDropdownMenu
            align="right"
            menuLabel={t('shell.header.languageSwitcher')}
            items={languageItems}
            trigger={({ open, toggle, menuId }) => (
              <Button
                type="button"
                variant="tertiary"
                size="icon"
                tooltip={t('shell.header.languageSwitcherTooltip')}
                aria-label={t('shell.header.languageSwitcher')}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={menuId}
                className={iconButtonClassName}
                onClick={toggle}
              >
                <Languages className="h-4 w-4" />
              </Button>
            )}
          />
          <Button
            type="button"
            size="icon"
            tooltip={
              resolvedMode === 'dark'
                ? t('shell.header.lightModeTooltip')
                : t('shell.header.darkModeTooltip')
            }
            aria-label={
              resolvedMode === 'dark'
                ? t('shell.header.switchToLightMode')
                : t('shell.header.switchToDarkMode')
            }
            onClick={toggleMode}
            variant="tertiary"
            className={iconButtonClassName}
          >
            {resolvedMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <HeaderAuthAction
            isHydrated={isHydrated}
            isLoading={isLoading}
            isAuthLoading={isAuthLoading}
            isAuthenticated={isAuthenticated}
            showOrganizationContext={showOrganizationContext}
            isSystemAdmin={isSystemAdmin}
            isDevAuthAvailable={isDevAuthAvailable}
            hideAnonymousLoginAction={hideAnonymousLoginAction}
            loginHref={loginHref}
            loginWithDevAuth={loginWithDevAuth}
            logout={logout}
            user={user}
            displayName={displayName}
            initials={initials}
          />
        </div>
      </div>
    </header>
  );
}
