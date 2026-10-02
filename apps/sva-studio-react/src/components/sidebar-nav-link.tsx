import { Link } from '@tanstack/react-router';
import { Button } from '@sva/studio-ui-react';
import type { SidebarLeafItem } from './sidebar-model';

export const isLeafActive = (pathname: string, item: SidebarLeafItem) => {
  if (!item.to) {
    return false;
  }

  if (item.exact) {
    return pathname === item.to;
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`);
};

export const getLinkClasses = (isActive: boolean, isCollapsed: boolean, isChild = false) =>
  [
    'flex items-center rounded-lg border text-sidebar-foreground transition',
    isChild
      ? 'gap-2.5 px-3 py-2 text-xs font-medium'
      : `gap-3 ${isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5 text-sm font-medium'}`,
    isActive
      ? 'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-shell'
      : 'border-transparent bg-sidebar hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  ].join(' ');

type SidebarLeafLinkProps = Readonly<{
  item: SidebarLeafItem;
  isActive: boolean;
  isCollapsed: boolean;
  isChild?: boolean;
  onClick?: () => void;
}>;

export const SidebarLeafLink = ({
  item,
  isActive,
  isCollapsed,
  isChild = false,
  onClick,
}: SidebarLeafLinkProps) => {
  const IconComponent = item.icon;
  const showLabel = isCollapsed === false;
  const content = (
    <>
      <IconComponent className={isChild ? 'h-4 w-4 shrink-0' : 'h-5 w-5 shrink-0'} />
      {showLabel ? <span className="truncate">{item.label}</span> : null}
    </>
  );

  if (item.to) {
    if (item.appearance === 'primary') {
      return (
        <Button
          asChild
          className={`h-11 rounded-lg font-semibold shadow-sm ${
            isCollapsed ? 'w-11 justify-center px-0' : 'w-full justify-start gap-3 px-3'
          }`}
        >
          <Link
            activeOptions={item.exact ? { exact: true } : undefined}
            to={item.to}
            search={item.search}
            aria-current={isActive ? 'page' : undefined}
            aria-label={isCollapsed ? item.label : undefined}
            title={isCollapsed ? item.label : undefined}
            onClick={onClick}
          >
            {content}
          </Link>
        </Button>
      );
    }

    return (
      <Link
        activeOptions={item.exact ? { exact: true } : undefined}
        to={item.to}
        search={item.search}
        className={getLinkClasses(isActive, isCollapsed, isChild)}
        aria-current={isActive ? 'page' : undefined}
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
