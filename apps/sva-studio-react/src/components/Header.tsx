/**
 * Header-Komponente der App-Shell mit globalen Aktionen.
 *
 * Die Komponente zeigt abhängig vom Auth-Status Login-/Logout-Aktionen
 * und unterstützt einen optionalen Loading-Zustand für Skeleton-Rendering.
 */
import { Bell, ChevronDown, Languages, Menu, MessageCircle, Moon, Search, SendHorizontal, Sun } from 'lucide-react';
import React from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { resolveOrganizationContextState, resolveUserDisplayName, resolveUserInitials } from '@sva/core';

import { OrganizationContextSwitcher } from './OrganizationContextSwitcher';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { t } from '../i18n';
import { createAccountActionHref, createLoginHref, resolveCurrentReturnTo } from '../lib/auth-navigation';
import { clearClientLogoutState } from '../lib/auth-session-state';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { hasExperimentalAccess } from '../lib/iam-admin-access';
import { cn } from '../lib/utils';
import { useAuth } from '../providers/auth-provider';
import { useLocale } from '../providers/locale-provider';
import { useTheme } from '../providers/theme-provider';

type HeaderProps = Readonly<{
  isLoading?: boolean;
  isMobileNavigationOpen?: boolean;
  onOpenMobileNavigation?: () => void;
}>;

type HeaderDropdownItem = Readonly<{
  id: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  href?: string;
  documentNavigation?: boolean;
  render?: React.ReactNode;
}>;

const iconButtonClassName =
  'h-10 w-10 rounded-full border border-transparent bg-transparent px-0 text-muted-foreground shadow-none hover:border-border hover:bg-card hover:text-foreground';

type HeaderAuthActionProps = Readonly<{
  isHydrated: boolean;
  isLoading: boolean;
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  showOrganizationContext: boolean;
  isSystemAdmin: boolean;
  isDevAuthAvailable?: boolean;
  hideAnonymousLoginAction: boolean;
  loginHref: string;
  loginWithDevAuth?: () => Promise<unknown> | void;
  logout: () => Promise<unknown> | void;
  user: { readonly id: string } | null;
  displayName: string;
  initials: string;
}>;

const HeaderSectionDivider = () => <hr className="my-1 border-border" />;

const HeaderDropdownMenu = ({
  trigger,
  items,
  align = 'right',
  menuLabel,
  className,
  menuClassName,
  popupRole,
}: {
  readonly trigger: (props: { readonly open: boolean; readonly toggle: () => void; readonly menuId: string }) => React.ReactNode;
  readonly items: readonly HeaderDropdownItem[];
  readonly align?: 'left' | 'right';
  readonly menuLabel: string;
  readonly className?: string;
  readonly menuClassName?: string;
  readonly popupRole?: 'dialog' | 'menu';
}) => {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const menuId = React.useId();
  const resolvedPopupRole = popupRole ?? 'menu';

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    globalThis.addEventListener('mousedown', handlePointerDown);
    globalThis.addEventListener('keydown', handleKeyDown);

    return () => {
      globalThis.removeEventListener('mousedown', handlePointerDown);
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((current) => !current), menuId })}
      {open ? (
        <div
          id={menuId}
          role={resolvedPopupRole}
          aria-label={menuLabel}
          aria-orientation={resolvedPopupRole === 'menu' ? 'vertical' : undefined}
          className={cn(
            'absolute top-full z-50 mt-2 min-w-56 overflow-hidden rounded-lg border border-border bg-popover p-1.5 shadow-md',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName
          )}
        >
          {items.map((item) => {
            if (item.render) {
              return <React.Fragment key={item.id}>{item.render}</React.Fragment>;
            }

            const itemClassName = cn(
              'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground',
              item.active && 'bg-accent text-accent-foreground',
              item.disabled && 'pointer-events-none opacity-50'
            );
            const content = (
              <>
                {item.icon ? <span className="mt-0.5 text-base leading-none">{item.icon}</span> : null}
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{item.label}</span>
                  {item.description ? (
                    <span className="block text-xs text-muted-foreground">{item.description}</span>
                  ) : null}
                </span>
              </>
            );

            if (item.href && item.documentNavigation) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  aria-disabled={item.disabled ? 'true' : undefined}
                  className={itemClassName}
                  onClick={() => setOpen(false)}
                >
                  {content}
                </a>
              );
            }

            if (item.href) {
              return (
                <Link
                  key={item.id}
                  to={item.href}
                  role="menuitem"
                  aria-disabled={item.disabled ? 'true' : undefined}
                  className={itemClassName}
                  onClick={() => setOpen(false)}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                aria-disabled={item.disabled ? 'true' : undefined}
                className={itemClassName}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

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

const renderUnauthenticatedHeaderAction = ({
  hideAnonymousLoginAction,
  isDevAuthAvailable,
  loginHref,
  loginWithDevAuth,
}: Pick<
  HeaderAuthActionProps,
  'hideAnonymousLoginAction' | 'isDevAuthAvailable' | 'loginHref' | 'loginWithDevAuth'
>): React.ReactNode => {
  if (hideAnonymousLoginAction) {
    return null;
  }

  if (isDevAuthAvailable) {
    return (
      <Button type="button" variant="secondary" onClick={() => void loginWithDevAuth?.()}>
        {t('shell.header.login')}
      </Button>
    );
  }

  return (
    <Button asChild variant="secondary">
      <a href={loginHref}>{t('shell.header.login')}</a>
    </Button>
  );
};

const createLogoutMenuItem = ({
  isDevAuthAvailable,
  logout,
}: Pick<HeaderAuthActionProps, 'isDevAuthAvailable' | 'logout'>): HeaderDropdownItem =>
  isDevAuthAvailable
    ? {
        id: 'logout',
        label: t('shell.header.logout'),
        onSelect: () => {
          void logout();
        },
      }
    : {
        id: 'logout',
        label: t('shell.header.logout'),
        render: (
          <form action="/auth/logout" method="post" onSubmit={() => clearClientLogoutState()}>
            <input type="hidden" name="logoutIntent" value="user" />
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
            >
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{t('shell.header.logout')}</span>
              </span>
            </button>
          </form>
        ),
      };

const createAccountMenuItems = ({
  showOrganizationContext,
  isSystemAdmin,
  logoutItem,
}: {
  readonly showOrganizationContext: boolean;
  readonly isSystemAdmin: boolean;
  readonly logoutItem: HeaderDropdownItem;
}): readonly HeaderDropdownItem[] => [
  ...(showOrganizationContext
    ? ([
        {
          id: 'organization-context',
          render: <OrganizationContextSwitcher variant="menu" readOnly={isSystemAdmin} />,
        },
        {
          id: 'divider-organization-context',
          render: <HeaderSectionDivider />,
        },
      ] satisfies readonly HeaderDropdownItem[])
    : []),
  { id: 'account', label: t('account.profile.title'), href: '/account' },
  {
    id: 'password',
    label: t('shell.header.changePassword'),
    href: createAccountActionHref('update-password'),
    documentNavigation: true,
  },
  {
    id: 'divider-privacy',
    render: <HeaderSectionDivider />,
  },
  {
    id: 'privacy',
    label: t('account.privacy.navLabel'),
    href: '/account/privacy',
  },
  {
    id: 'rules',
    label: t('account.rules.navLabel'),
    href: '/account/rules',
  },
  {
    id: 'divider-session',
    render: <HeaderSectionDivider />,
  },
  logoutItem,
];

const HeaderAuthenticatedAccountMenu = ({
  showOrganizationContext,
  isSystemAdmin,
  isDevAuthAvailable = false,
  logout,
  displayName,
  initials,
}: Pick<
  HeaderAuthActionProps,
  'showOrganizationContext' | 'isSystemAdmin' | 'isDevAuthAvailable' | 'logout' | 'displayName' | 'initials'
>) => {
  const logoutItem = createLogoutMenuItem({ isDevAuthAvailable, logout });
  const accountMenuItems = createAccountMenuItems({
    showOrganizationContext,
    isSystemAdmin,
    logoutItem,
  });

  return (
    <HeaderDropdownMenu
      align="right"
      menuLabel={t('shell.header.accountMenu')}
      items={accountMenuItems}
      menuClassName="min-w-72"
      popupRole="dialog"
      trigger={({ open, toggle, menuId }) => (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={menuId}
          className="flex items-center gap-3 rounded-full px-1 py-1 text-left hover:bg-accent/60"
          onClick={toggle}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
            {initials}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm font-medium text-foreground">{displayName}</span>
          </span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    />
  );
};

const HeaderAuthAction = ({
  isHydrated,
  isLoading,
  isAuthLoading,
  isAuthenticated,
  showOrganizationContext,
  isSystemAdmin,
  isDevAuthAvailable = false,
  hideAnonymousLoginAction,
  loginHref,
  loginWithDevAuth,
  logout,
  user,
  displayName,
  initials,
}: HeaderAuthActionProps): React.ReactNode => {
  if (!isHydrated || isLoading || isAuthLoading) {
    return (
      <>
        <span role="status" aria-live="polite" className="sr-only">
          {t('shell.header.authLoading')}
        </span>
        <span aria-hidden="true" className="h-9 w-28 animate-skeleton rounded-full" />
      </>
    );
  }

  if (!isAuthenticated) {
    return renderUnauthenticatedHeaderAction({
      hideAnonymousLoginAction,
      isDevAuthAvailable,
      loginHref,
      loginWithDevAuth,
    });
  }

  if (!user) {
    return null;
  }

  return (
    <HeaderAuthenticatedAccountMenu
      showOrganizationContext={showOrganizationContext}
      isSystemAdmin={isSystemAdmin}
      isDevAuthAvailable={isDevAuthAvailable}
      logout={logout}
      displayName={displayName}
      initials={initials}
    />
  );
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
  const { user, isAuthenticated, isLoading: isAuthLoading, isDevAuthAvailable, loginWithDevAuth, logout } = useAuth();
  const organizationContext = useOrganizationContext();
  const organizationContextState = resolveOrganizationContextState({
    roleNames: user?.roles,
    organizations: organizationContext.context?.organizations,
    storedActiveOrganizationId: organizationContext.context?.activeOrganizationId,
  });
  const isSystemAdmin = organizationContextState.isReadOnly;
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
  const showAuthenticatedHeaderTools = isHydrated && isAuthenticated && !isLoading && !isAuthLoading;
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
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showExperimentalHeaderTools ? (
            <div className="hidden min-w-0 flex-1 items-center gap-3 xl:flex">
              <HeaderPromptField icon={<Search className="h-4 w-4" />} label={searchPromptLabel} />
              <HeaderPromptField icon={<MessageCircle className="h-4 w-4" />} label={assistantPromptLabel} />
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
                  variant="ghost"
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
                variant="ghost"
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
            tooltip={resolvedMode === 'dark' ? t('shell.header.lightModeTooltip') : t('shell.header.darkModeTooltip')}
            aria-label={resolvedMode === 'dark' ? t('shell.header.switchToLightMode') : t('shell.header.switchToDarkMode')}
            onClick={toggleMode}
            variant="ghost"
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
