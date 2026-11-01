/** Sidebar der App-Shell mit Bereichsnavigation, Untermenüs und Desktop-Collapse. */
import {
  FileBadge as IconCertificate,
  Headset as IconHeadset,
  LifeBuoy as IconHelpCircle,
  Users as IconUsersGroup,
} from 'lucide-react';
import React from 'react';
import { Sheet, SheetContent } from './ui/sheet';
import { t } from '../i18n';
import { SidebarPanel } from './sidebar-panel';
import { useSidebarAccess } from './sidebar-access';
import { useSidebarSections } from './sidebar-sections';
import type { SidebarLeafItem } from './sidebar-model';

type SidebarProps = Readonly<{
  isLoading?: boolean;
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}>;

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'sva-studio-sidebar-collapsed';
const COMMUNITY_URL = 'https://verwaltungen-havelland.humhub.smart-village.app/s/sva-community/';
const HELP_DOCUMENTATION_URL =
  'https://smart-village-solutions.github.io/sva-studio-user-documentation/';
const SUPPORT_ISSUES_URL = 'https://github.com/smart-village-solutions/sva-studio/issues';
const LICENSE_URL = 'https://github.com/smart-village-solutions/sva-studio/blob/main/LICENSE';
/**
 * Rendert die Seitenleiste inklusive Navigation, Collapse und mobilem Drawer.
 */
export default function Sidebar({
  isLoading = false,
  isMobileOpen = false,
  onMobileOpenChange,
}: SidebarProps) {
  const access = useSidebarAccess();
  const { user, canAccessExperimentalFeatures } = access;
  const tenantName = user?.instanceDisplayName?.trim() || user?.instanceId?.trim() || undefined;
  const [collapsePreference, setCollapsePreference] = React.useState<boolean | null>(null);
  const [compactDesktop, setCompactDesktop] = React.useState(false);
  const isCollapsed = collapsePreference ?? compactDesktop;

  React.useEffect(() => {
    if (globalThis.window === undefined) {
      return;
    }
    const preference = globalThis.window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    setCollapsePreference(preference === '1' ? true : preference === '0' ? false : null);
    const media = globalThis.window.matchMedia('(min-width: 1280px)');
    const updateViewport = () => setCompactDesktop(!media.matches);
    updateViewport();
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setCollapsePreference(next);
    globalThis.window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
  };

  const sections = useSidebarSections(access);

  const footerItems = React.useMemo<readonly SidebarLeafItem[]>(
    () => [
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
    [canAccessExperimentalFeatures]
  );

  return (
    <>
      <aside
        aria-label={t('shell.sidebar.ariaLabel')}
        className={`relative z-[90] hidden shrink-0 overflow-visible border-r border-sidebar-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:block lg:h-screen ${
          collapsePreference === null ? 'lg:w-20 xl:w-72' : isCollapsed ? 'lg:w-20' : 'lg:w-72'
        }`}
      >
        <SidebarPanel
          isLoading={isLoading}
          sections={sections}
          footerItems={footerItems}
          isCollapsed={isCollapsed}
          tenantName={tenantName}
          allowCollapse
          onToggleCollapsed={toggleCollapsed}
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
