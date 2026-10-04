/** Sidebar der App-Shell mit Bereichsnavigation, Untermenüs und Desktop-Collapse. */
import { IconCertificate, IconHeadset, IconHelpCircle } from '@tabler/icons-react';
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
const HELP_DISCUSSIONS_URL = 'https://github.com/smart-village-solutions/sva-studio/discussions';
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

  const sections = useSidebarSections(access);

  const footerItems = React.useMemo<readonly SidebarLeafItem[]>(
    () => [
      ...(canAccessExperimentalFeatures
        ? [
            {
              kind: 'link' as const,
              id: 'help',
              href: HELP_DISCUSSIONS_URL,
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
        className={`relative z-[90] hidden overflow-visible border-r border-sidebar-border bg-sidebar shadow-shell transition-[width] duration-200 lg:sticky lg:top-0 lg:block lg:h-screen ${
          isCollapsed ? 'lg:w-20' : 'lg:w-72'
        }`}
      >
        <SidebarPanel
          isLoading={isLoading}
          sections={sections}
          footerItems={footerItems}
          isCollapsed={isCollapsed}
          tenantName={tenantName}
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
