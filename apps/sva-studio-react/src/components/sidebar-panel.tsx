import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Button } from '@sva/studio-ui-react';
import { t } from '../i18n';
import { useStudioBranding } from '../providers/studio-branding-provider';
import { SidebarNavItem } from './sidebar-nav-group';
import { useSidebarPanelState } from './use-sidebar-panel-state';
import { isLeafActive, SidebarLeafLink } from './sidebar-nav-link';
import type { SidebarPanelProps } from './sidebar-model';

const sidebarSkeletonKeys = [
  'sidebar-skeleton-a',
  'sidebar-skeleton-b',
  'sidebar-skeleton-c',
  'sidebar-skeleton-d',
] as const;

export const SidebarPanel = ({
  isLoading,
  sections,
  footerItems,
  isCollapsed,
  tenantName,
  allowCollapse,
  onToggleCollapsed,
  onNavigate,
  showMobileHeader = false,
  onCloseMobileNavigation,
}: SidebarPanelProps) => {
  const { appName } = useStudioBranding();
  const {
    location,
    pathname,
    groupOpenState,
    flyoutGroupId,
    toggleCollapsedGroup,
    toggleExpandedGroup,
    closeFlyout,
    openFlyout,
  } = useSidebarPanelState(isCollapsed, sections.length);
  const showAppTitle = isCollapsed === false;
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4">
        <div
          className={`relative flex min-h-12 items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}
        >
          {showAppTitle ? (
            <div className="min-w-0">
              <p className="text-3xl font-semibold text-foreground">{appName}</p>
              {tenantName ? (
                <p
                  className="truncate text-xs font-medium text-muted-foreground"
                  title={tenantName}
                >
                  {tenantName}
                </p>
              ) : null}
            </div>
          ) : null}
          {allowCollapse ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-0 top-1/2 z-[100] hidden h-9 w-9 -translate-y-1/2 translate-x-[calc(60%+12px)] rounded-full border-sidebar-border bg-card shadow-shell lg:inline-flex"
              aria-label={isCollapsed ? t('shell.sidebar.expand') : t('shell.sidebar.collapse')}
              onClick={onToggleCollapsed}
            >
              {isCollapsed ? (
                <IconChevronRight className="h-4 w-4" />
              ) : (
                <IconChevronLeft className="h-4 w-4" />
              )}
            </Button>
          ) : null}
          {showMobileHeader ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
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
                  className={`block animate-skeleton rounded-xl border border-sidebar-border ${
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
                      location={location}
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

            {footerItems.length > 0 ? (
              <section className="space-y-1 pt-4">
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
              </section>
            ) : null}
          </div>
        )}
      </nav>
    </div>
  );
};
