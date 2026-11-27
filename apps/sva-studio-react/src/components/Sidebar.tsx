/** Sidebar der App-Shell mit Bereichsnavigation, Untermenüs und Desktop-Collapse. */
import {
  IconCertificate,
  IconHistory,
  IconHeadset,
  IconLifebuoy as IconHelpCircle,
  IconUsersGroup,
} from '@tabler/icons-react';
import React from 'react';
import { Sheet, SheetContent } from './ui/sheet';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { t } from '../i18n';
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from '../lib/theme';
import { SidebarPanel } from './sidebar-panel';
import { useSidebarAccess, type DocumentNavigation } from './sidebar-access';
import { useSidebarSections } from './sidebar-sections';
import type { SidebarLeafItem } from './sidebar-model';

type SidebarProps = Readonly<{
  initialNavigation?: DocumentNavigation;
  isLoading?: boolean;
  showChangelogLink?: boolean;
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}>;


const COMMUNITY_URL = 'https://verwaltungen-havelland.humhub.smart-village.app/s/sva-community/';
const HELP_DOCUMENTATION_URL =
  'https://smart-village-solutions.github.io/sva-studio-user-documentation/';
const SUPPORT_ISSUES_URL = 'https://github.com/smart-village-solutions/sva-studio/issues';
const LICENSE_URL = 'https://github.com/smart-village-solutions/sva-studio/blob/main/LICENSE';
/**
 * Rendert die Seitenleiste inklusive Navigation, Collapse und mobilem Drawer.
 */
export default function Sidebar({
  initialNavigation,
  isLoading = false,
  showChangelogLink = false,
  isMobileOpen = false,
  onMobileOpenChange,
}: SidebarProps) {
  const access = useSidebarAccess(initialNavigation);
  const { user, canAccessExperimentalFeatures } = access;
  const organization = useOrganizationContext();
  const tenantName = user?.instanceDisplayName?.trim() || user?.instanceId?.trim() || undefined;
  const [desktopCollapsed, setDesktopCollapsed] = React.useState<boolean | null>(null);
  const desktopSidebar = React.useRef<HTMLElement>(null);
  const restoreToggleFocus = React.useRef(false);

  React.useLayoutEffect(() => {
    if (restoreToggleFocus.current) {
      desktopSidebar.current?.querySelector<HTMLElement>('[data-sidebar-toggle]')?.focus();
      restoreToggleFocus.current = false;
    }
  }, [desktopCollapsed]);

  React.useEffect(() => {
    const { documentElement } = document;
    const media = window.matchMedia('(min-width: 1280px)');
    const updateViewport = () => {
      const preference = documentElement.dataset.sidebarCollapse;
      setDesktopCollapsed(preference === undefined ? !media.matches : preference === '1');
    };
    try {
      const preference = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (preference === '1' || preference === '0') {
        documentElement.dataset.sidebarCollapse = preference;
      } else {
        delete documentElement.dataset.sidebarCollapse;
      }
    } catch {
      // The current tab can still toggle the sidebar when storage is disabled.
    }
    updateViewport();
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  const toggleCollapsed = (next: boolean) => {
    restoreToggleFocus.current = true;
    const preference = next ? '1' : '0';
    document.documentElement.dataset.sidebarCollapse = preference;
    setDesktopCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, preference);
    } catch {
      // The layout change remains active for this document.
    }
  };

  const currentSections = useSidebarSections(access);
  const { isLoading: isAccessLoading, error: accessError } = access.contentAccessApi;
  const scopeKey =
    user &&
    access.canAccessWorkspace &&
    !organization.isLoading &&
    !organization.isUpdating &&
    !organization.error
      ? JSON.stringify([
          user.id,
          user.instanceId,
          organization.context?.activeOrganizationId ?? null,
        ])
      : null;
  const confirmedSections = React.useRef<{
    scopeKey: string;
    sections: typeof currentSections;
  } | null>(null);

  React.useEffect(() => {
    if (!scopeKey || accessError) {
      confirmedSections.current = null;
    } else if (!isAccessLoading) {
      confirmedSections.current = { scopeKey, sections: currentSections };
    } else if (confirmedSections.current?.scopeKey !== scopeKey) {
      confirmedSections.current = null;
    }
  }, [accessError, currentSections, isAccessLoading, scopeKey]);

  // Keep only the rendered navigation while the current scope is revalidated.
  const previous = confirmedSections.current;
  const sections =
    isAccessLoading && previous && previous.scopeKey === scopeKey
      ? previous.sections
      : currentSections;

  const footerItems = React.useMemo<readonly SidebarLeafItem[]>(
    () => [
      ...(user || showChangelogLink
        ? [
            {
              kind: 'link' as const,
              id: 'changelog',
              to: '/changelog',
              label: t('shell.sidebar.changelog'),
              icon: IconHistory,
            },
          ]
        : []),
      ...(canAccessExperimentalFeatures
        ? [
            {
              kind: 'link' as const,
              id: 'community',
              href: COMMUNITY_URL,
              label: t('shell.sidebar.community'),
              icon: IconUsersGroup,
            },
            {
              kind: 'link' as const,
              id: 'help',
              href: HELP_DOCUMENTATION_URL,
              label: t('shell.sidebar.help'),
              icon: IconHelpCircle,
            },
            {
              kind: 'link' as const,
              id: 'support',
              href: SUPPORT_ISSUES_URL,
              label: t('shell.sidebar.support'),
              icon: IconHeadset,
            },
            {
              kind: 'link' as const,
              id: 'license',
              href: LICENSE_URL,
              label: t('shell.sidebar.license'),
              icon: IconCertificate,
            },
          ]
        : []),
    ],
    [canAccessExperimentalFeatures, showChangelogLink, user]
  );

  return (
    <>
      <aside
        ref={desktopSidebar}
        aria-label={t('shell.sidebar.ariaLabel')}
        className="studio-desktop-sidebar relative z-[90] hidden shrink-0 overflow-visible border-r border-sidebar-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:block lg:h-screen"
      >
        {[false, true].map((isCollapsed) =>
          desktopCollapsed === null || desktopCollapsed === isCollapsed ? (
            <div
              key={String(isCollapsed)}
              data-sidebar-panel={isCollapsed ? 'compact' : 'expanded'}
              className="h-full"
            >
              <SidebarPanel
                isLoading={isLoading}
                sections={sections}
                footerItems={footerItems}
                isCollapsed={isCollapsed}
                tenantName={tenantName}
                allowCollapse
                onToggleCollapsed={() => toggleCollapsed(!isCollapsed)}
              />
            </div>
          ) : null
        )}
      </aside>
      <Sheet open={isMobileOpen} onOpenChange={onMobileOpenChange ?? (() => undefined)}>
        <SheetContent
          aria-label={t('shell.sidebar.ariaLabel')}
          closeLabel={t('shell.header.closeNavigation')}
          description={t('shell.sidebar.ariaLabel')}
          className="p-0"
          side="left"
        >
          <aside
            id="mobile-sidebar"
            aria-label={t('shell.sidebar.ariaLabel')}
            className="h-full bg-sidebar"
          >
            <SidebarPanel
              isLoading={isLoading}
              sections={sections}
              footerItems={footerItems}
              isCollapsed={false}
              tenantName={tenantName}
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
