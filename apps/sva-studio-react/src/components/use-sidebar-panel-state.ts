import React from 'react';
import { useRouterState } from '@tanstack/react-router';
import { isDevelopmentBrowserEnv } from '../lib/browser-env';
import { logBrowserOperationSuccess } from '../lib/browser-operation-logging';
import { sidebarLogger, logSidebarDebug } from './sidebar-logging';

export const useSidebarPanelState = (isCollapsed: boolean, sectionsCount: number) => {
  const location = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      search: state.location.search as Readonly<Record<string, unknown>>,
    }),
  });
  const pathname = location.pathname;
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
    if (!isDevelopmentBrowserEnv()) {
      return;
    }

    logBrowserOperationSuccess(
      sidebarLogger,
      'sidebar_state_snapshot',
      {
        pathname,
        is_collapsed: isCollapsed,
        flyout_group_id: flyoutGroupId,
        group_open_state: groupOpenState,
        sections_count: sectionsCount,
      },
      'debug'
    );
  }, [flyoutGroupId, groupOpenState, isCollapsed, pathname, sectionsCount]);
  return {
    location,
    pathname,
    groupOpenState,
    flyoutGroupId,
    toggleCollapsedGroup,
    toggleExpandedGroup,
    closeFlyout,
    openFlyout,
  };
};
