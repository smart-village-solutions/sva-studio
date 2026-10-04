import React from 'react';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import {
  resolveContentNavigationActiveId,
  type SidebarContentLocation,
} from '../lib/sidebar-content-navigation';
import { logSidebarDebug } from './sidebar-logging';
import { getLinkClasses, isLeafActive, SidebarLeafLink } from './sidebar-nav-link';
import type { SidebarGroupItem, SidebarItem } from './sidebar-model';

type SidebarLocation = SidebarContentLocation;

const resolveGroupActiveChildId = (
  location: SidebarLocation,
  item: SidebarGroupItem
): string | null => {
  if (item.activeChildStrategy === 'contentType') {
    return resolveContentNavigationActiveId(location, item.children, item.knownContentTypes ?? []);
  }

  return item.children.find((child) => isLeafActive(location.pathname, child))?.id ?? null;
};

export const isGroupActive = (location: SidebarLocation, item: SidebarGroupItem) =>
  resolveGroupActiveChildId(location, item) !== null ||
  (item.activeChildStrategy === 'contentType' &&
    (location.pathname === '/admin/content' || location.pathname.startsWith('/admin/content/')));

type SidebarGroupFlyoutProps = Readonly<{
  item: SidebarGroupItem;
  location: SidebarLocation;
  activeChildId: string | null;
  onNavigate?: () => void;
  closeFlyout: () => void;
}>;

const SidebarGroupFlyout = ({
  item,
  location: _location,
  activeChildId,
  onNavigate,
  closeFlyout,
}: SidebarGroupFlyoutProps) => {
  const handleItemClick = () => {
    closeFlyout();
    onNavigate?.();
  };

  return (
    <div
      id={`sidebar-group-${item.id}`}
      className="absolute left-full top-0 z-[100] w-64 rounded-lg border border-sidebar-border bg-card p-3 shadow-shell"
    >
      <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {item.label}
      </p>
      <div className="mt-3 space-y-1">
        {item.children.map((child) => (
          <SidebarLeafLink
            key={child.id}
            item={child}
            isActive={activeChildId === child.id}
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
  activeChildId: string | null;
  onNavigate?: () => void;
}>;

const SidebarGroupContent = ({ item, activeChildId, onNavigate }: SidebarGroupContentProps) => (
  <CollapsibleContent
    id={`sidebar-group-${item.id}`}
    className="mt-1 ml-5 space-y-1 border-l border-sidebar-border/70 pb-1 pl-4"
  >
    {item.children.map((child) => (
      <SidebarLeafLink
        key={child.id}
        item={child}
        isActive={activeChildId === child.id}
        isCollapsed={false}
        isChild
        onClick={onNavigate}
      />
    ))}
  </CollapsibleContent>
);

type SidebarNavItemProps = Readonly<{
  item: SidebarItem;
  location: SidebarLocation;
  isCollapsed: boolean;
  groupOpenState: Readonly<Record<string, boolean>>;
  flyoutGroupId: string | null;
  onNavigate?: () => void;
  onToggleCollapsedGroup: (groupId: string) => void;
  onToggleExpandedGroup: (groupId: string, open: boolean) => void;
  onOpenFlyout: (groupId: string) => void;
  onCloseFlyout: () => void;
}>;

export const SidebarNavItem = ({
  item,
  location,
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
          isActive={isLeafActive(location.pathname, item)}
          isCollapsed={isCollapsed}
          onClick={onNavigate}
        />
      </li>
    );
  }

  const activeChildId = resolveGroupActiveChildId(location, item);
  const isActive = isGroupActive(location, item);
  const persistedOpen = groupOpenState[item.id];
  const isExpanded = isCollapsed ? flyoutGroupId === item.id : (persistedOpen ?? isActive);
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
        event.relatedTarget instanceof HTMLElement
          ? event.relatedTarget.textContent?.trim().slice(0, 80)
          : null,
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
            <SidebarGroupFlyout
              item={item}
              location={location}
              activeChildId={activeChildId}
              onNavigate={onNavigate}
              closeFlyout={onCloseFlyout}
            />
          ) : null}
        </>
      ) : (
        <Collapsible
          open={isExpanded}
          onOpenChange={(open) => onToggleExpandedGroup(item.id, open)}
        >
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
              {isExpanded ? (
                <IconChevronDown className="h-4 w-4" />
              ) : (
                <IconChevronRight className="h-4 w-4 animate-collapse-icon" />
              )}
            </span>
          </CollapsibleTrigger>
          <SidebarGroupContent item={item} activeChildId={activeChildId} onNavigate={onNavigate} />
        </Collapsible>
      )}
    </li>
  );
};
