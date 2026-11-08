/** Header-Komponente der App-Shell mit globalen Aktionen. */
import {
  IconLanguage as Languages,
  IconGridDots,
  IconMenu as Menu,
  IconMoon as Moon,
  IconSun as Sun,
} from '@tabler/icons-react';
import React from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffectiveAccess } from '../providers/effective-access-provider';
import { studioPlugins } from '../lib/plugins';
import {
  resolveOrganizationContextState,
  resolveUserDisplayName,
  resolveUserInitials,
} from '@sva/core';
import { Button } from '@sva/studio-ui-react';
import { t } from '../i18n';
import { createLoginHref, resolveCurrentReturnTo } from '../lib/auth-navigation';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { useAuth } from '../providers/auth-provider';
import { useLocale } from '../providers/locale-provider';
import { useTheme } from '../providers/theme-provider';
import { HeaderAuthAction } from './header-auth-action';
import { HeaderDropdownMenu, type HeaderDropdownItem } from './header-dropdown-menu';
import { OrganizationContextSwitcher } from './OrganizationContextSwitcher';

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
  const navigate = useNavigate();
  const access = useEffectiveAccess();
  const searchPlugin = studioPlugins.find((plugin) => plugin.id === 'search');
  const searchRequirement = searchPlugin?.routes?.find(
    (route) => route.id === 'search.results'
  )?.accessRequirement;
  const SearchHeader = searchPlugin?.viewBindings?.find(
    (binding) => binding.bindingKey === 'searchHeader'
  )?.component as React.ComponentType<{ onSearch: (q: string) => void }> | undefined;
  const headerNavigation = studioPlugins.flatMap((plugin) =>
    (plugin.navigation ?? [])
      .filter(
        (item) =>
          item.section === 'header' &&
          item.to &&
          item.accessRequirement &&
          access.snapshot.status === 'ready' &&
          access.snapshot.scope.kind === 'tenant' &&
          access.snapshot.scope.instanceId === user?.instanceId &&
          'assignedModules' in access.snapshot &&
          access.snapshot.assignedModules.includes(plugin.moduleIam?.moduleId ?? plugin.id) &&
          access.decide(item.accessRequirement).status === 'allowed'
      )
      .map((item) => ({ ...item, ownerPluginId: plugin.id }))
  );
  const canSearch = searchRequirement && access.decide(searchRequirement).status === 'allowed';
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
  return (
    <header className="sticky top-0 z-40 bg-background">
      <div className="grid min-h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 border-b border-border-subtle px-4 py-2 text-sm text-foreground sm:px-6">
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
              <Menu aria-hidden="true" className="h-5 w-5" />
            </Button>
          ) : null}
          {isHydrated &&
          isAuthenticated &&
          SearchHeader &&
          canSearch &&
          !organizationContext.isUpdating ? (
            <div className="flex min-w-0 items-center lg:w-72">
              <SearchHeader
                onSearch={(q) => {
                  void navigate({
                    to: '/plugins/search' as never,
                    search: { q, page: 1 } as never,
                  });
                }}
              />
            </div>
          ) : null}
        </div>
        {showOrganizationContext ? (
          <div className="col-span-3 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <OrganizationContextSwitcher allowPersonal={isSystemAdmin} />
          </div>
        ) : null}
        <div className="col-start-3 row-start-1 flex items-center justify-end gap-2 sm:gap-3">
          {headerNavigation.map((item) => (
            <Button
              key={`${item.ownerPluginId}:${item.id}`}
              asChild
              variant="tertiary"
              size="icon"
              className={iconButtonClassName}
              tooltip={t(item.titleKey)}
            >
              <a href={item.to} aria-label={t(item.titleKey)}>
                <IconGridDots aria-hidden="true" className="h-4 w-4" />
              </a>
            </Button>
          ))}
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
                <Languages aria-hidden="true" className="h-4 w-4" />
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
            {resolvedMode === 'dark' ? (
              <Sun aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Moon aria-hidden="true" className="h-4 w-4" />
            )}
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
