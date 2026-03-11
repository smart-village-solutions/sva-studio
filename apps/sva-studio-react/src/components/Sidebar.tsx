/**
 * Sidebar der App-Shell mit primären Navigationszielen.
 *
 * Die Komponente unterstützt einen Loading-Zustand, in dem Navigations-Skeletons
 * statt interaktiver Links gerendert werden, sowie einen minimierten Zustand,
 * in dem nur Icons angezeigt werden.
 */
import { Link } from '@tanstack/react-router';
import { ChevronsLeft, ChevronsRight, LayoutDashboard, Newspaper, Settings2, Shield, Users, X } from 'lucide-react';
import React from 'react';

import { t } from '../i18n';
import { hasIamAdminRole, hasSystemAdminRole, isIamAdminEnabled } from '../lib/iam-admin-access';
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
    case '/plugins/news':
      return Newspaper;
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
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}>;

const SidebarPanel = ({
  isLoading,
  links,
  onNavigate,
  showMobileHeader = false,
  onCloseMobileNavigation,
  collapsed = false,
  onToggleCollapse,
}: SidebarPanelProps) => (
  <div className="relative flex h-full flex-col">
    <div className={collapsed ? 'px-2 py-4' : 'px-4 py-4'}>
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className={`flex min-w-0 items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            SVA
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-foreground">SVA Studio</span>
              <span className="block truncate text-xs font-normal text-sidebar-foreground">
                {t('shell.sidebar.sectionLabel')}
              </span>
            </span>
          ) : null}
        </Link>
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
    {onToggleCollapse ? (
      <button
        type="button"
        title={collapsed ? t('shell.sidebar.expand') : t('shell.sidebar.collapse')}
        className="absolute right-0 top-5 z-50 inline-flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full border border-sidebar-border bg-card text-sidebar-foreground shadow-shell transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        aria-label={collapsed ? t('shell.sidebar.expand') : t('shell.sidebar.collapse')}
        onClick={onToggleCollapse}
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </button>
    ) : null}
    <nav aria-label={t('shell.sidebar.navAriaLabel')} className={`flex-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-4'} py-4`}>
      {isLoading ? (
        <ul className="space-y-2">
          {sidebarSkeletonKeys.map((key) => (
            <li key={key}>
              <span
                aria-hidden="true"
                className={`block animate-pulse rounded-md border border-sidebar-border bg-muted ${collapsed ? 'h-10 w-10' : 'h-11 w-full'}`}
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
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-md border border-transparent bg-sidebar text-sm font-medium text-sidebar-foreground transition hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}`}
                  onClick={onNavigate}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span>{item.label}</span> : null}
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
  const [collapsed, setCollapsed] = React.useState(false);
  const canAccessAdminUsers = isAuthenticated && isIamAdminEnabled() && hasIamAdminRole(user);
  const canAccessAdminOrganizations = canAccessAdminUsers;
  const canAccessAdminRoles = canAccessAdminUsers && hasSystemAdminRole(user);

  const sidebarLinks: Array<{ to: string; label: string }> = [
    { to: '/', label: t('shell.sidebar.overview') },
    { to: '/plugins/news', label: 'News' },
    ...(canAccessAdminUsers ? [{ to: '/admin/users', label: t('shell.sidebar.userManagement') }] : []),
    ...(canAccessAdminOrganizations ? [{ to: '/admin/organizations', label: t('shell.sidebar.organizationManagement') }] : []),
    ...(canAccessAdminRoles ? [{ to: '/admin/roles', label: t('shell.sidebar.roleManagement') }] : []),
  ];

  return (
    <>
      <aside
        aria-label={t('shell.sidebar.ariaLabel')}
        className={`hidden z-50 overflow-visible border-r border-sidebar-border bg-sidebar shadow-shell transition-[width] duration-200 lg:sticky lg:top-0 lg:block lg:h-screen ${collapsed ? 'lg:w-16' : 'lg:w-72'}`}
      >
        <SidebarPanel
          isLoading={isLoading}
          links={sidebarLinks}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
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
