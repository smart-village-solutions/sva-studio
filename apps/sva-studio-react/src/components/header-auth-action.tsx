import React from 'react';
import { ChevronDown } from 'lucide-react';
import { OrganizationContextSwitcher } from './OrganizationContextSwitcher';
import { Button } from '@sva/studio-ui-react';
import { t } from '../i18n';
import { createAccountActionHref } from '../lib/auth-navigation';
import { clearClientLogoutState } from '../lib/auth-session-state';
import {
  HeaderDropdownMenu,
  HeaderSectionDivider,
  type HeaderDropdownItem,
} from './header-dropdown-menu';

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
  | 'showOrganizationContext'
  | 'isSystemAdmin'
  | 'isDevAuthAvailable'
  | 'logout'
  | 'displayName'
  | 'initials'
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
            <span className="block truncate text-sm font-medium text-foreground">
              {displayName}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    />
  );
};

export const HeaderAuthAction = ({
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
