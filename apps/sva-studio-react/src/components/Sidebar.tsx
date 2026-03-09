/**
 * Sidebar der App-Shell mit primären Navigationszielen.
 *
 * Die Komponente unterstützt einen Loading-Zustand, in dem Navigations-Skeletons
 * statt interaktiver Links gerendert werden.
 */
import { Link } from '@tanstack/react-router';
import { LayoutDashboard, Settings2, Shield, UserRound, Users, X } from 'lucide-react';
import React from 'react';

import { t } from '../i18n';
import { hasIamAdminRole, hasSystemAdminRole, isIamAdminEnabled, isIamUiEnabled } from '../lib/iam-admin-access';
import { useAuth } from '../providers/auth-provider';
import { Sheet, SheetContent } from './ui/sheet';

type SidebarProps = Readonly<{
  isLoading?: boolean;
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}>;

const sidebarSkeletonKeys = ['sidebar-skeleton-a', 'sidebar-skeleton-b', 'sidebar-skeleton-c', 'sidebar-skeleton-d'];

const getSidebarIcon = (path: string) => {
  switch (path) {
    case '/account':
      return UserRound;
    case '/admin/users':
      return Users;
    case '/admin/organizations':
      return Settings2;
    case '/admin/roles':
      return Shield;
    case '/':
    default:
      return LayoutDashboard;
  }
};

type SidebarPanelProps = Readonly<{
  isLoading: boolean;
  links: ReadonlyArray<{ to: string; label: string }>;
  onNavigate?: () => void;
  showMobileHeader?: boolean;
  onCloseMobileNavigation?: () => void;
}>;

const SidebarPanel = ({
  isLoading,
  links,
  onNavigate,
  showMobileHeader = false,
  onCloseMobileNavigation,
}: SidebarPanelProps) => (
  <div className="flex h-full flex-col">
    <div className="border-b border-sidebar-border px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sidebar-foreground">
            {t('shell.sidebar.sectionLabel')}
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">SVA Studio</p>
        </div>
        {showMobileHeader ? (
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-sidebar-border bg-card text-foreground shadow-shell transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label={t('shell.header.closeNavigation')}
            onClick={onCloseMobileNavigation}
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
    <nav aria-label={t('shell.sidebar.navAriaLabel')} className="flex-1 overflow-y-auto px-4 py-4">
      {isLoading ? (
        <ul className="space-y-2">
          {sidebarSkeletonKeys.map((key) => (
            <li key={key}>
              <span
                aria-hidden="true"
                className="block h-11 w-full animate-pulse rounded-md border border-sidebar-border bg-muted"
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {links.map((item) => {
            const Icon = getSidebarIcon(item.to);

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex items-center gap-3 rounded-md border border-transparent bg-sidebar px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={onNavigate}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  </div>
);

/**
 * Rendert die Seitenleiste inklusive Navigation oder Skeleton-Platzhaltern.
 *
 * @param props - Konfiguration der Sidebar.
 * @param props.isLoading - Steuert, ob Navigations-Skeletons angezeigt werden.
 */
export default function Sidebar({ isLoading = false, isMobileOpen = false, onMobileOpenChange }: SidebarProps) {
  const { user, isAuthenticated } = useAuth();
  const canAccessAccount = isAuthenticated && isIamUiEnabled();
  const canAccessAdminUsers = isAuthenticated && isIamAdminEnabled() && hasIamAdminRole(user);
  const canAccessAdminOrganizations = canAccessAdminUsers;
  const canAccessAdminRoles = canAccessAdminUsers && hasSystemAdminRole(user);

  const sidebarLinks: Array<{ to: string; label: string }> = [
    { to: '/', label: t('shell.sidebar.overview') },
    ...(canAccessAccount ? [{ to: '/account', label: t('shell.sidebar.account') }] : []),
    ...(canAccessAdminUsers ? [{ to: '/admin/users', label: t('shell.sidebar.userManagement') }] : []),
    ...(canAccessAdminOrganizations ? [{ to: '/admin/organizations', label: t('shell.sidebar.organizationManagement') }] : []),
    ...(canAccessAdminRoles ? [{ to: '/admin/roles', label: t('shell.sidebar.roleManagement') }] : []),
  ];

  return (
    <>
      <aside
        aria-label={t('shell.sidebar.ariaLabel')}
        className="hidden border-r border-sidebar-border bg-sidebar shadow-shell lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:w-72"
      >
        <SidebarPanel isLoading={isLoading} links={sidebarLinks} />
      </aside>
      <Sheet open={isMobileOpen} onOpenChange={onMobileOpenChange ?? (() => undefined)}>
        <SheetContent
          aria-label={t('shell.sidebar.ariaLabel')}
          closeLabel={t('shell.header.closeNavigation')}
          className="p-0"
          side="left"
        >
          <aside id="mobile-sidebar" aria-label={t('shell.sidebar.ariaLabel')} className="h-full bg-sidebar">
            <SidebarPanel
              isLoading={isLoading}
              links={sidebarLinks}
              showMobileHeader
              onCloseMobileNavigation={() => onMobileOpenChange?.(false)}
              onNavigate={() => onMobileOpenChange?.(false)}
            />
          </aside>
        </SheetContent>
      </Sheet>
    </>
  );
}
