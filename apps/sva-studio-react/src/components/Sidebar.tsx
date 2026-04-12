/**
 * Sidebar der App-Shell mit Bereichsnavigation, Untermenüs und Desktop-Collapse.
 */
import {
  IconActivityHeartbeat,
  IconAppWindow,
  IconArticle,
  IconBuildingCommunity,
  IconCategory,
  IconCertificate,
  IconChevronLeft,
  IconChevronDown,
  IconChevronRight,
  IconFileText,
  IconGauge,
  IconHeadset,
  IconHelpCircle,
  IconHierarchy3,
  IconLayoutDashboard,
  IconPackages,
  IconPhoto,
  IconPlugConnected,
  IconShieldCheck,
  IconShieldLock,
  IconUserSquareRounded,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react';
import { Link, useRouterState } from '@tanstack/react-router';
import React from 'react';

import { t } from '../i18n';
import { useContentAccess } from '../hooks/use-content-access';
import {
  hasIamAdminRole,
  hasInstanceRegistryAdminRole,
  hasInterfacesAccessRole,
  hasSystemAdminRole,
  isIamAdminEnabled,
  isIamUiEnabled,
} from '../lib/iam-admin-access';
import {
  createOperationLogger,
  logBrowserOperationStart,
  logBrowserOperationSuccess,
} from '../lib/browser-operation-logging';
import { useAuth } from '../providers/auth-provider';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Sheet, SheetContent } from './ui/sheet';

type SidebarProps = Readonly<{
  isLoading?: boolean;
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}>;

type SidebarLeafItem = {
  readonly kind: 'link';
  readonly id: string;
  readonly to?: string;
  readonly href?: string;
  readonly label: string;
  readonly icon: Icon;
  readonly exact?: boolean;
};

type SidebarGroupItem = {
  readonly kind: 'group';
  readonly id: string;
  readonly label: string;
  readonly icon: Icon;
  readonly children: readonly SidebarLeafItem[];
};

type SidebarItem = SidebarLeafItem | SidebarGroupItem;

type SidebarSection = {
  readonly id: string;
  readonly label: string;
  readonly items: readonly SidebarItem[];
};

type SidebarPanelProps = Readonly<{
  isLoading: boolean;
  sections: readonly SidebarSection[];
  footerItems: readonly SidebarLeafItem[];
  isCollapsed: boolean;
  allowCollapse: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  showMobileHeader?: boolean;
  onCloseMobileNavigation?: () => void;
}>;

const sidebarSkeletonKeys = [
  'sidebar-skeleton-a',
  'sidebar-skeleton-b',
  'sidebar-skeleton-c',
  'sidebar-skeleton-d',
] as const;

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'sva-studio-sidebar-collapsed';
const HELP_DISCUSSIONS_URL = 'https://github.com/smart-village-solutions/sva-studio/discussions';
const SUPPORT_ISSUES_URL = 'https://github.com/smart-village-solutions/sva-studio/issues';
const LICENSE_ISSUE_URL = 'https://github.com/smart-village-solutions/sva-studio/issues/2';
const COCKPIT_URL = 'https://cockpit.guben.de';
const sidebarLogger = createOperationLogger('sidebar', 'debug');

const isSidebarDebugEnabled = () => {
  if (typeof process !== 'undefined' && typeof process.env?.NODE_ENV === 'string') {
    return process.env.NODE_ENV !== 'production';
  }

  const meta = import.meta as ImportMeta & { env?: { DEV?: boolean; PROD?: boolean } };
  if (typeof meta.env?.DEV === 'boolean') {
    return meta.env.DEV;
  }
  if (typeof meta.env?.PROD === 'boolean') {
    return !meta.env.PROD;
  }

  return true;
};

const logSidebarDebug = (eventName: string, meta: Record<string, unknown>) => {
  if (!isSidebarDebugEnabled()) {
    return;
  }

  logBrowserOperationStart(sidebarLogger, eventName, meta);
};

const isLeafActive = (pathname: string, item: SidebarLeafItem) => {
  if (!item.to) {
    return false;
  }

  if (item.exact) {
    return pathname === item.to;
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`);
};

const isGroupActive = (pathname: string, item: SidebarGroupItem) =>
  item.children.some((child) => isLeafActive(pathname, child));

const getLinkClasses = (isActive: boolean, isCollapsed: boolean, isChild = false) =>
  [
    'flex items-center rounded-xl border text-sidebar-foreground transition',
    isChild
      ? 'gap-2.5 px-3 py-2 text-xs font-medium'
      : `gap-3 ${isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5 text-sm font-medium'}`,
    isActive
      ? 'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-shell'
      : 'border-transparent bg-sidebar hover:border-sidebar-primary hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
  ].join(' ');

type SidebarLeafLinkProps = Readonly<{
  item: SidebarLeafItem;
  isActive: boolean;
  isCollapsed: boolean;
  isChild?: boolean;
  onClick?: () => void;
}>;

const SidebarLeafLink = ({ item, isActive, isCollapsed, isChild = false, onClick }: SidebarLeafLinkProps) => {
  const IconComponent = item.icon;
  const showLabel = isCollapsed === false;
  const content = (
    <>
      <IconComponent className={isChild ? 'h-4 w-4 shrink-0' : 'h-5 w-5 shrink-0'} />
      {showLabel ? <span className="truncate">{item.label}</span> : null}
    </>
  );

  if (item.to) {
    return (
      <Link
        activeOptions={item.exact ? { exact: true } : undefined}
        to={item.to}
        className={getLinkClasses(isActive, isCollapsed, isChild)}
        aria-label={isCollapsed ? item.label : undefined}
        title={isCollapsed ? item.label : undefined}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  return (
    <a
      href={item.href}
      className={getLinkClasses(false, isCollapsed, isChild)}
      aria-label={isCollapsed ? item.label : undefined}
      title={isCollapsed ? item.label : undefined}
      onClick={onClick}
      rel="noopener noreferrer"
      target="_blank"
    >
      {content}
    </a>
  );
};

type SidebarGroupFlyoutProps = Readonly<{
  item: SidebarGroupItem;
  pathname: string;
  onNavigate?: () => void;
  closeFlyout: () => void;
}>;

const SidebarGroupFlyout = ({ item, pathname, onNavigate, closeFlyout }: SidebarGroupFlyoutProps) => {
  const handleItemClick = () => {
    closeFlyout();
    onNavigate?.();
  };

  return (
    <div
      id={`sidebar-group-${item.id}`}
      className="absolute left-full top-0 z-[100] w-64 rounded-2xl border border-sidebar-border bg-card p-3 shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
    >
      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
      <div className="mt-3 space-y-1">
        {item.children.map((child) => (
          <SidebarLeafLink
            key={child.id}
            item={child}
            isActive={isLeafActive(pathname, child)}
            isCollapsed={false}
            isChild
            onClick={handleItemClick}
          />
        ))}
      </div>
    </div>
  );
};

type SidebarGroupContentProps = Readonly<{
  item: SidebarGroupItem;
  pathname: string;
  onNavigate?: () => void;
}>;

const SidebarGroupContent = ({ item, pathname, onNavigate }: SidebarGroupContentProps) => (
  <CollapsibleContent
    id={`sidebar-group-${item.id}`}
    className="mt-1 ml-5 space-y-1 border-l border-sidebar-border/70 pb-1 pl-4"
  >
    {item.children.map((child) => (
      <SidebarLeafLink
        key={child.id}
        item={child}
        isActive={isLeafActive(pathname, child)}
        isCollapsed={false}
        isChild
        onClick={onNavigate}
      />
    ))}
  </CollapsibleContent>
);

type SidebarNavItemProps = Readonly<{
  item: SidebarItem;
  pathname: string;
  isCollapsed: boolean;
  groupOpenState: Readonly<Record<string, boolean>>;
  flyoutGroupId: string | null;
  onNavigate?: () => void;
  onToggleCollapsedGroup: (groupId: string) => void;
  onToggleExpandedGroup: (groupId: string, open: boolean) => void;
  onOpenFlyout: (groupId: string) => void;
  onCloseFlyout: () => void;
}>;

const SidebarNavItem = ({
  item,
  pathname,
  isCollapsed,
  groupOpenState,
  flyoutGroupId,
  onNavigate,
  onToggleCollapsedGroup,
  onToggleExpandedGroup,
  onOpenFlyout,
  onCloseFlyout,
}: SidebarNavItemProps) => {
  if (item.kind === 'link') {
    return (
      <li key={item.id}>
        <SidebarLeafLink
          item={item}
          isActive={isLeafActive(pathname, item)}
          isCollapsed={isCollapsed}
          onClick={onNavigate}
        />
      </li>
    );
  }

  const isActive = isGroupActive(pathname, item);
  const persistedOpen = groupOpenState[item.id];
  const isExpanded = isCollapsed ? flyoutGroupId === item.id : persistedOpen ?? isActive;
  const IconComponent = item.icon;
  const handleBlurCapture = (event: React.FocusEvent<HTMLLIElement>) => {
    logSidebarDebug('sidebar_group_blur_capture', {
      item_id: item.id,
      item_label: item.label,
      is_collapsed: isCollapsed,
      is_active: isActive,
      is_expanded: isExpanded,
      related_target_tag:
        event.relatedTarget instanceof HTMLElement ? event.relatedTarget.tagName : null,
      related_target_text:
        event.relatedTarget instanceof HTMLElement ? event.relatedTarget.textContent?.trim().slice(0, 80) : null,
    });
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      onCloseFlyout();
    }
  };

  return (
    <li
      key={item.id}
      className="relative"
      onMouseEnter={isCollapsed ? () => onOpenFlyout(item.id) : undefined}
      onMouseLeave={isCollapsed ? onCloseFlyout : undefined}
      onBlurCapture={isCollapsed ? handleBlurCapture : undefined}
    >
      {isCollapsed ? (
        <>
          <button
            type="button"
            className={`${getLinkClasses(isActive || isExpanded, true)} w-full`}
            aria-controls={`sidebar-group-${item.id}`}
            aria-expanded={isExpanded}
            aria-label={item.label}
            title={item.label}
            onPointerDown={() => {
              logSidebarDebug('sidebar_group_pointer_down', {
                item_id: item.id,
                item_label: item.label,
                is_collapsed: true,
                is_active: isActive,
                is_expanded: isExpanded,
              });
            }}
            onMouseDown={() => {
              logSidebarDebug('sidebar_group_mouse_down', {
                item_id: item.id,
                item_label: item.label,
                is_collapsed: true,
                is_active: isActive,
                is_expanded: isExpanded,
              });
            }}
            onClick={() => {
              logSidebarDebug('sidebar_group_click', {
                item_id: item.id,
                item_label: item.label,
                is_collapsed: true,
                is_active: isActive,
                is_expanded: isExpanded,
              });
              onToggleCollapsedGroup(item.id);
            }}
            onFocus={() => {
              logSidebarDebug('sidebar_group_focus', {
                item_id: item.id,
                item_label: item.label,
                is_collapsed: true,
                is_active: isActive,
                is_expanded: isExpanded,
              });
              onOpenFlyout(item.id);
            }}
          >
            <IconComponent className="h-5 w-5 shrink-0" />
          </button>

          {isExpanded ? (
            <SidebarGroupFlyout item={item} pathname={pathname} onNavigate={onNavigate} closeFlyout={onCloseFlyout} />
          ) : null}
        </>
      ) : (
        <Collapsible open={isExpanded} onOpenChange={(open) => onToggleExpandedGroup(item.id, open)}>
          <CollapsibleTrigger
            className={`w-full ${getLinkClasses(isActive || isExpanded, false)}`}
            aria-controls={`sidebar-group-${item.id}`}
            onPointerDown={() => {
              logSidebarDebug('sidebar_group_pointer_down', {
                item_id: item.id,
                item_label: item.label,
                is_collapsed: false,
                is_active: isActive,
                is_expanded: isExpanded,
              });
            }}
            onMouseDown={() => {
              logSidebarDebug('sidebar_group_mouse_down', {
                item_id: item.id,
                item_label: item.label,
                is_collapsed: false,
                is_active: isActive,
                is_expanded: isExpanded,
              });
            }}
            onFocus={() => {
              logSidebarDebug('sidebar_group_focus', {
                item_id: item.id,
                item_label: item.label,
                is_collapsed: false,
                is_active: isActive,
                is_expanded: isExpanded,
              });
            }}
            onClick={() => {
              logSidebarDebug('sidebar_group_click', {
                item_id: item.id,
                item_label: item.label,
                is_collapsed: false,
                is_active: isActive,
                is_expanded: isExpanded,
              });
            }}
          >
            <IconComponent className="h-5 w-5 shrink-0" />
            <span className="truncate">{item.label}</span>
            <span className="ml-auto inline-flex h-5 w-5 items-center justify-center text-muted-foreground">
              {isExpanded ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
            </span>
          </CollapsibleTrigger>
          <SidebarGroupContent item={item} pathname={pathname} onNavigate={onNavigate} />
        </Collapsible>
      )}
    </li>
  );
};

const SidebarPanel = ({
  isLoading,
  sections,
  footerItems,
  isCollapsed,
  allowCollapse,
  onToggleCollapsed,
  onNavigate,
  showMobileHeader = false,
  onCloseMobileNavigation,
}: SidebarPanelProps) => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [groupOpenState, setGroupOpenState] = React.useState<Record<string, boolean>>({});
  const [flyoutGroupId, setFlyoutGroupId] = React.useState<string | null>(null);

  const toggleCollapsedGroup = (groupId: string) => {
    logSidebarDebug('sidebar_toggle_collapsed_group', {
      group_id: groupId,
      pathname,
      is_collapsed: isCollapsed,
      current_flyout_group_id: flyoutGroupId,
    });
    setFlyoutGroupId((current) => (current === groupId ? null : groupId));
  };

  const toggleExpandedGroup = (groupId: string, open: boolean) => {
    logSidebarDebug('sidebar_toggle_expanded_group', {
      group_id: groupId,
      pathname,
      is_collapsed: isCollapsed,
      open,
      current_group_open_state: groupOpenState,
    });
    setGroupOpenState((current) => ({
      ...current,
      [groupId]: open,
    }));
  };

  const closeFlyout = () => {
    logSidebarDebug('sidebar_close_flyout', {
      pathname,
      is_collapsed: isCollapsed,
      current_flyout_group_id: flyoutGroupId,
    });
    setFlyoutGroupId(null);
  };

  const openFlyout = (groupId: string) => {
    logSidebarDebug('sidebar_open_flyout', {
      group_id: groupId,
      pathname,
      is_collapsed: isCollapsed,
      current_flyout_group_id: flyoutGroupId,
    });
    setFlyoutGroupId(groupId);
  };

  React.useEffect(() => {
    if (!isSidebarDebugEnabled()) {
      return;
    }

    logBrowserOperationSuccess(sidebarLogger, 'sidebar_state_snapshot', {
      pathname,
      is_collapsed: isCollapsed,
      flyout_group_id: flyoutGroupId,
      group_open_state: groupOpenState,
      sections_count: sections.length,
    }, 'debug');
  }, [flyoutGroupId, groupOpenState, isCollapsed, pathname, sections.length]);
  const showAppTitle = isCollapsed === false;
  const showFooter = isLoading === false;

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4">
        <div className={`relative flex min-h-12 items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {showAppTitle ? <p className="text-3xl font-semibold text-foreground">{t('shell.appName')}</p> : null}
          {allowCollapse ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="absolute right-0 top-1/2 z-[100] hidden h-10 w-10 -translate-y-1/2 translate-x-[calc(60%+12px)] rounded-full border-sidebar-border bg-card shadow-shell lg:inline-flex"
              aria-label={isCollapsed ? t('shell.sidebar.expand') : t('shell.sidebar.collapse')}
              onClick={onToggleCollapsed}
            >
              {isCollapsed ? <IconChevronRight className="h-5 w-5" /> : <IconChevronLeft className="h-5 w-5" />}
            </Button>
          ) : null}
          {showMobileHeader ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="border-sidebar-border bg-card shadow-shell"
              aria-label={t('shell.header.closeNavigation')}
              onClick={onCloseMobileNavigation}
            >
              <IconChevronRight className="h-5 w-5 rotate-180" />
            </Button>
          ) : null}
        </div>
      </div>

      <nav
        aria-label={t('shell.sidebar.navAriaLabel')}
        className={`flex-1 min-h-0 px-3 py-4 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}`}
      >
          {isLoading ? (
            <ul className="space-y-2">
              {sidebarSkeletonKeys.map((key) => (
                <li key={key}>
                  <span
                    aria-hidden="true"
                    className={`block animate-pulse rounded-xl border border-sidebar-border bg-muted ${
                      isCollapsed ? 'mx-auto h-11 w-11' : 'h-11 w-full'
                    }`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-5">
              {sections.map((section) => (
                <section key={section.id} className="space-y-2">
                  {isCollapsed ? (
                    <div className="px-2" aria-hidden="true">
                      <span className="mx-auto block h-px w-8 bg-sidebar-border" />
                    </div>
                  ) : (
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      {section.label}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {section.items.map((item) => (
                      <SidebarNavItem
                        key={item.id}
                        item={item}
                        pathname={pathname}
                        isCollapsed={isCollapsed}
                        groupOpenState={groupOpenState}
                        flyoutGroupId={flyoutGroupId}
                        onNavigate={onNavigate}
                        onToggleCollapsedGroup={toggleCollapsedGroup}
                        onToggleExpandedGroup={toggleExpandedGroup}
                        onOpenFlyout={openFlyout}
                        onCloseFlyout={closeFlyout}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
      </nav>

      {showFooter ? (
        <div className="px-3 py-4">
          <ul className="space-y-1">
            {footerItems.map((item) => (
              <li key={item.id}>
                <SidebarLeafLink
                  item={item}
                  isActive={isLeafActive(pathname, item)}
                  isCollapsed={isCollapsed}
                  onClick={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Rendert die Seitenleiste inklusive Navigation, Collapse und mobilem Drawer.
 */
export default function Sidebar({ isLoading = false, isMobileOpen = false, onMobileOpenChange }: SidebarProps) {
  const { user, isAuthenticated } = useAuth();
  const contentAccessApi = useContentAccess();
  const canAccessWorkspace = isAuthenticated && isIamUiEnabled();
  const canAccessContent =
    canAccessWorkspace && (contentAccessApi.isLoading || contentAccessApi.access?.canRead === true);
  const canAccessAdminUsers = isAuthenticated && isIamAdminEnabled() && hasIamAdminRole(user);
  const canAccessAdminOrganizations = canAccessAdminUsers;
  const canAccessAdminInstances = isAuthenticated && isIamAdminEnabled() && hasInstanceRegistryAdminRole(user);
  const canAccessAdminRoles = canAccessAdminUsers && hasSystemAdminRole(user);
  const canAccessAdminPrivacy = canAccessAdminUsers;
  const canAccessInterfaces = isAuthenticated && isIamUiEnabled() && hasInterfacesAccessRole(user);
  const canAccessSystemTools = canAccessAdminRoles;

  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [hasLoadedCollapsePreference, setHasLoadedCollapsePreference] = React.useState(false);

  React.useEffect(() => {
    if (globalThis.window === undefined) {
      return;
    }
    setIsCollapsed(globalThis.window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1');
    setHasLoadedCollapsePreference(true);
  }, []);

  React.useEffect(() => {
    if (globalThis.window === undefined || hasLoadedCollapsePreference === false) {
      return;
    }
    globalThis.window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, isCollapsed ? '1' : '0');
  }, [hasLoadedCollapsePreference, isCollapsed]);

  const sections = React.useMemo<readonly SidebarSection[]>(() => {
    const dataManagementItems: SidebarItem[] = [
      {
        kind: 'link',
        id: 'overview',
        to: '/',
        label: t('shell.sidebar.overview'),
        icon: IconLayoutDashboard,
        exact: true,
      },
      ...(canAccessContent
        ? [
            {
              kind: 'link' as const,
              id: 'content',
              to: '/content',
              label: t('shell.sidebar.content'),
              icon: IconArticle,
            },
            {
              kind: 'link' as const,
              id: 'media',
              to: '/media',
              label: t('shell.sidebar.media'),
              icon: IconPhoto,
            },
            {
              kind: 'link' as const,
              id: 'categories',
              to: '/categories',
              label: t('shell.sidebar.categories'),
              icon: IconCategory,
            },
          ]
        : []),
    ];

    const applicationItems: SidebarItem[] = canAccessWorkspace
      ? [
          {
            kind: 'link',
            id: 'app',
            to: '/app',
            label: t('shell.sidebar.app'),
            icon: IconAppWindow,
          },
          {
            kind: 'link',
            id: 'cockpit',
            href: COCKPIT_URL,
            label: t('shell.sidebar.cockpit'),
            icon: IconGauge,
          },
        ]
      : [];

    const userChildren: SidebarLeafItem[] = [
      ...(canAccessAdminUsers
        ? [
            {
              kind: 'link' as const,
              id: 'accounts',
              to: '/admin/users',
              label: t('shell.sidebar.accounts'),
              icon: IconUserSquareRounded,
            },
          ]
        : []),
      ...(canAccessAdminOrganizations
        ? [
            {
              kind: 'link' as const,
              id: 'organizations',
              to: '/admin/organizations',
              label: t('shell.sidebar.organizations'),
              icon: IconBuildingCommunity,
            },
          ]
        : []),
      ...(canAccessAdminInstances
        ? [
            {
              kind: 'link' as const,
              id: 'instances',
              to: '/admin/instances',
              label: t('shell.sidebar.instances'),
              icon: IconHierarchy3,
            },
          ]
        : []),
      ...(canAccessAdminRoles
        ? [
            {
              kind: 'link' as const,
              id: 'roles',
              to: '/admin/roles',
              label: t('shell.sidebar.roles'),
              icon: IconShieldLock,
            },
            {
              kind: 'link' as const,
              id: 'groups',
              to: '/admin/groups',
              label: t('shell.sidebar.groups'),
              icon: IconUsersGroup,
            },
            {
              kind: 'link' as const,
              id: 'legal-texts',
              to: '/admin/legal-texts',
              label: t('shell.sidebar.legalTexts'),
              icon: IconFileText,
            },
          ]
        : []),
      ...(canAccessAdminPrivacy
        ? [
            {
              kind: 'link' as const,
              id: 'privacy',
              to: '/admin/iam',
              label: t('shell.sidebar.privacy'),
              icon: IconShieldCheck,
            },
          ]
        : []),
    ];

    const systemItems: SidebarItem[] = [
      ...(userChildren.length > 0
        ? [
            {
              kind: 'group' as const,
              id: 'users',
              label: t('shell.sidebar.users'),
              icon: IconUsersGroup,
              children: userChildren,
            },
          ]
        : []),
      ...(canAccessInterfaces
        ? [
            {
              kind: 'link' as const,
              id: 'interfaces',
              to: '/interfaces',
              label: t('shell.sidebar.interfaces'),
              icon: IconPlugConnected,
            },
          ]
        : []),
      ...(canAccessSystemTools
        ? [
            {
              kind: 'link' as const,
              id: 'modules',
              to: '/modules',
              label: t('shell.sidebar.modules'),
              icon: IconPackages,
            },
            {
              kind: 'link' as const,
              id: 'monitoring',
              to: '/monitoring',
              label: t('shell.sidebar.monitoring'),
              icon: IconActivityHeartbeat,
            },
          ]
        : []),
    ];

    return [
      {
        id: 'data-management',
        label: t('shell.sidebar.sections.dataManagement'),
        items: dataManagementItems,
      },
      ...(applicationItems.length > 0
        ? [
            {
              id: 'applications',
              label: t('shell.sidebar.sections.applications'),
              items: applicationItems,
            },
          ]
        : []),
      ...(systemItems.length > 0
        ? [
            {
              id: 'system',
              label: t('shell.sidebar.sections.system'),
              items: systemItems,
            },
          ]
        : []),
    ];
  }, [
    canAccessAdminOrganizations,
    canAccessAdminInstances,
    canAccessAdminPrivacy,
    canAccessAdminRoles,
    canAccessAdminUsers,
    canAccessInterfaces,
    canAccessSystemTools,
    canAccessWorkspace,
  ]);

  const footerItems = React.useMemo<readonly SidebarLeafItem[]>(
    () => [
      {
        kind: 'link',
        id: 'help',
        href: HELP_DISCUSSIONS_URL,
        label: t('shell.sidebar.help'),
        icon: IconHelpCircle,
      },
      {
        kind: 'link',
        id: 'support',
        href: SUPPORT_ISSUES_URL,
        label: t('shell.sidebar.support'),
        icon: IconHeadset,
      },
      {
        kind: 'link',
        id: 'license',
        href: LICENSE_ISSUE_URL,
        label: t('shell.sidebar.license'),
        icon: IconCertificate,
      },
    ],
    []
  );

  return (
    <>
      <aside
        aria-label={t('shell.sidebar.ariaLabel')}
        className={`relative z-[90] hidden overflow-visible border-r border-sidebar-border bg-sidebar shadow-shell transition-[width] duration-200 lg:sticky lg:top-0 lg:block lg:h-screen ${
          isCollapsed ? 'lg:w-20' : 'lg:w-80'
        }`}
      >
        <SidebarPanel
          isLoading={isLoading}
          sections={sections}
          footerItems={footerItems}
          isCollapsed={isCollapsed}
          allowCollapse
          onToggleCollapsed={() => setIsCollapsed((current) => !current)}
        />
      </aside>
      <Sheet open={isMobileOpen} onOpenChange={onMobileOpenChange ?? (() => undefined)}>
        <SheetContent
          aria-label={t('shell.sidebar.ariaLabel')}
          closeLabel={t('shell.header.closeNavigation')}
          description={t('shell.sidebar.ariaLabel')}
          className="p-0"
          side="left"
        >
          <aside id="mobile-sidebar" aria-label={t('shell.sidebar.ariaLabel')} className="h-full bg-sidebar">
            <SidebarPanel
              isLoading={isLoading}
              sections={sections}
              footerItems={footerItems}
              isCollapsed={false}
              allowCollapse={false}
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
