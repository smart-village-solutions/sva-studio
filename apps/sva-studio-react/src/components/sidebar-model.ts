import type { Icon } from '@tabler/icons-react';

export type SidebarLeafItem = {
  readonly kind: 'link';
  readonly id: string;
  readonly to?: string;
  readonly href?: string;
  readonly label: string;
  readonly icon: Icon;
  readonly exact?: boolean;
  readonly section?: 'dataManagement' | 'applications' | 'system';
  readonly moduleId?: string | null;
  readonly search?: (current: Readonly<Record<string, unknown>>) => Record<string, unknown>;
  readonly contentType?: string | null;
  readonly activePathPrefixes?: readonly string[];
  readonly appearance?: 'default' | 'primary';
};

export type SidebarGroupItem = {
  readonly kind: 'group';
  readonly id: string;
  readonly label: string;
  readonly icon: Icon;
  readonly children: readonly SidebarLeafItem[];
  readonly activeChildStrategy?: 'contentType';
  readonly knownContentTypes?: readonly string[];
};

export type SidebarItem = SidebarLeafItem | SidebarGroupItem;

export type SidebarSection = {
  readonly id: string;
  readonly label: string;
  readonly items: readonly SidebarItem[];
};

export type SidebarPanelProps = Readonly<{
  isLoading: boolean;
  sections: readonly SidebarSection[];
  footerItems: readonly SidebarLeafItem[];
  isCollapsed: boolean;
  tenantName?: string;
  allowCollapse: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  showMobileHeader?: boolean;
  onCloseMobileNavigation?: () => void;
}>;
