/**
 * Unit-Tests für Sidebar-Rendering, Abschnittsstruktur und Collapse-Verhalten.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IamContentAccessSummary } from '@sva/core';
import { pluginNews } from '@sva/plugin-news';

import { mergeI18nResources } from '../i18n';
import Sidebar from './Sidebar';

const LICENSE_ISSUE_URL = 'https://github.com/smart-village-solutions/sva-studio/issues/2';
const HELP_DISCUSSIONS_URL = 'https://github.com/smart-village-solutions/sva-studio/discussions';
const SUPPORT_ISSUES_URL = 'https://github.com/smart-village-solutions/sva-studio/issues';
const COCKPIT_URL = 'https://cockpit.guben.de';

const useAuthMock = vi.fn();
const useContentAccessMock = vi.fn();
const useRouterStateMock = vi.fn();
const localStorageState = new Map<string, string>();
type PluginNavigationItemMock = {
  id: string;
  to: string;
  titleKey: string;
  section: 'dataManagement' | 'applications' | 'system';
  requiredAction?: string;
  actionId?: string;
};
const studioPluginNavigationMock = vi.hoisted(() => ({
  items: [
    {
      id: 'news.navigation',
      to: '/plugins/news/review',
      titleKey: 'news.navigation.title',
      section: 'dataManagement',
      requiredAction: 'news.read',
    },
  ] as PluginNavigationItemMock[],
}));
const studioPluginActionLookupMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

beforeAll(() => {
  mergeI18nResources(pluginNews.translations ?? {});
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: React.ReactNode;
    activeOptions?: unknown;
  }) =>
    (() => {
      const { activeOptions: _activeOptions, ...anchorProps } = props;
      const pathname = useRouterStateMock();
      const isActive = pathname === to || pathname.startsWith(`${to}/`);
      return (
        <a href={to} aria-current={isActive ? 'page' : undefined} {...anchorProps}>
          {children}
        </a>
      );
    })(),
  useRouterState: (options?: {
    select?: (state: { location: { pathname: string } }) => unknown;
  }) => {
    const pathname = useRouterStateMock();
    const state = { location: { pathname } };
    return options?.select ? options.select(state) : state;
  },
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../hooks/use-content-access', () => ({
  useContentAccess: () => useContentAccessMock(),
}));

vi.mock('../lib/plugins', () => ({
  get studioPluginNavigation() {
    return studioPluginNavigationMock.items;
  },
  getStudioPluginAction: (actionId: string) => studioPluginActionLookupMock.get(actionId),
  getStudioPluginNavigationModuleId: (item: PluginNavigationItemMock) =>
    item.id.split('.')[0] ?? null,
}));

const unauthenticatedAuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  logout: vi.fn(),
  invalidatePermissions: vi.fn(),
};

type SidebarContentAccessState = {
  readonly access: IamContentAccessSummary | null;
  readonly permissionActions: readonly string[];
  readonly isLoading: boolean;
  readonly error: unknown;
};

const defaultEditableAccessState: IamContentAccessSummary = {
  state: 'editable' as const,
  canRead: true,
  canCreate: true,
  canUpdate: true,
  organizationIds: [],
  sourceKinds: ['direct_role'],
};

const defaultReadOnlyAccessState: IamContentAccessSummary = {
  state: 'read_only' as const,
  canRead: true,
  canCreate: false,
  canUpdate: false,
  organizationIds: [],
  sourceKinds: ['direct_role'],
};

const defaultBlockedAccessState: IamContentAccessSummary = {
  state: 'blocked' as const,
  canRead: false,
  canCreate: false,
  canUpdate: false,
  reasonCode: 'content_read_missing',
  organizationIds: [],
  sourceKinds: [],
};

const defaultBlockedDirectRoleAccessState: IamContentAccessSummary = {
  ...defaultBlockedAccessState,
  sourceKinds: ['direct_role'],
};

const createAuthenticatedAuthState = (user: Record<string, unknown>) => ({
  ...unauthenticatedAuthState,
  user,
  isAuthenticated: true,
});

const createSidebarUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  name: 'Test User',
  roles: ['editor'],
  ...overrides,
});

const createContentAccessState = (
  overrides: Partial<SidebarContentAccessState> = {}
): SidebarContentAccessState => ({
  access: null,
  permissionActions: ['news.read'],
  isLoading: false,
  error: null,
  ...overrides,
});

const setupSidebarSession = (input: Readonly<{
  user?: Record<string, unknown> | null;
  contentAccess?: ReturnType<typeof createContentAccessState>;
}>) => {
  useAuthMock.mockReturnValue(
    input.user ? createAuthenticatedAuthState(input.user) : unauthenticatedAuthState
  );
  useContentAccessMock.mockReturnValue(input.contentAccess ?? createContentAccessState());
};

const renderSidebar = (
  input: Readonly<{
    route?: string;
    user?: Record<string, unknown> | null;
    contentAccess?: ReturnType<typeof createContentAccessState>;
    props?: React.ComponentProps<typeof Sidebar>;
  }> = {}
) => {
  useRouterStateMock.mockReturnValue(input.route ?? '/');
  setupSidebarSession({
    user: input.user,
    contentAccess: input.contentAccess,
  });
  return render(<Sidebar {...input.props} />);
};

beforeEach(() => {
  useRouterStateMock.mockReturnValue('/');
  useContentAccessMock.mockReturnValue({
    access: null,
    permissionActions: ['news.read'],
    isLoading: false,
    error: null,
  });
  studioPluginNavigationMock.items = [
    {
      id: 'news.navigation',
      to: '/plugins/news/review',
      titleKey: 'news.navigation.title',
      section: 'dataManagement',
      requiredAction: 'news.read',
    },
  ];
  studioPluginActionLookupMock.get.mockReset();
  studioPluginActionLookupMock.get.mockReturnValue(undefined);
  localStorageState.clear();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => localStorageState.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStorageState.set(key, value);
      },
      removeItem: (key: string) => {
        localStorageState.delete(key);
      },
    },
  });
});

afterEach(() => {
  cleanup();
  useAuthMock.mockReset();
  useRouterStateMock.mockReset();
  vi.unstubAllEnvs();
});

describe('Sidebar', () => {
  it('rendert im Loading-Zustand keine interaktiven Links', () => {
    useAuthMock.mockReturnValue(unauthenticatedAuthState);

    render(<Sidebar isLoading />);

    expect(screen.getByLabelText('Seitenleiste')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Bereichsnavigation' })).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('rendert die neuen Abschnittsüberschriften und das Benutzer-Untermenü über explizite Admin-Permissions', () => {
    renderSidebar({
      user: createSidebarUser({
        name: 'Admin',
        roles: ['system_admin'],
        instanceId: 'de-musterhausen',
        permissionActions: [
          'experimental.read',
          'iam.user.read',
          'iam.user.write',
          'iam.role.read',
          'iam.role.write',
          'iam.org.read',
          'iam.org.write',
          'iam.legalText.read',
          'iam.governance.read',
          'iam.monitoring.read',
          'integration.manage',
        ],
      }),
      contentAccess: createContentAccessState({
        access: defaultEditableAccessState,
        permissionActions: ['news.read', 'app.read', 'cockpit.read'],
      }),
    });

    expect(screen.getByText('Datenverwaltung')).toBeTruthy();
    expect(screen.getByText('Anwendungen')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Übersicht' }).className).toContain('rounded-lg');
    expect(screen.getByRole('link', { name: 'Übersicht' }).className).toContain('text-sidebar-foreground');
    expect(screen.getByRole('link', { name: 'Übersicht' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Übersicht' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Inhalte' }).getAttribute('href')).toBe(
      '/admin/content'
    );
    expect(screen.getByRole('link', { name: 'App' }).getAttribute('href')).toBe('/app');
    expect(screen.getByRole('link', { name: 'Cockpit' }).getAttribute('href')).toBe(COCKPIT_URL);
    expect(screen.getByRole('link', { name: 'Cockpit' }).getAttribute('target')).toBe('_blank');

    const usersToggle = screen.getByRole('button', { name: 'Benutzer' });
    fireEvent.click(usersToggle);

    expect(screen.getByRole('link', { name: 'Accounts' }).getAttribute('href')).toBe(
      '/admin/users'
    );
    expect(screen.getByRole('link', { name: 'Organisationen' }).getAttribute('href')).toBe(
      '/admin/organizations'
    );
    expect(screen.queryByRole('link', { name: 'Instanzen' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Rollen' }).getAttribute('href')).toBe('/admin/roles');
    expect(screen.getByRole('link', { name: 'Gruppen' }).getAttribute('href')).toBe(
      '/admin/groups'
    );
    expect(screen.getByRole('link', { name: 'Rechtstexte' }).getAttribute('href')).toBe(
      '/admin/legal-texts'
    );
    expect(screen.getByRole('link', { name: 'Datenschutz' }).getAttribute('href')).toBe(
      '/admin/iam'
    );
    expect(screen.getByRole('link', { name: 'Schnittstellen' }).getAttribute('href')).toBe(
      '/interfaces'
    );
    expect(screen.getByRole('link', { name: 'Module' }).getAttribute('href')).toBe('/modules');
    expect(screen.getByRole('link', { name: 'Monitoring' }).getAttribute('href')).toBe(
      '/monitoring'
    );
    expect(screen.getByRole('link', { name: 'Hilfe' }).getAttribute('href')).toBe(
      HELP_DISCUSSIONS_URL
    );
    expect(screen.getByRole('link', { name: 'Support' }).getAttribute('href')).toBe(
      SUPPORT_ISSUES_URL
    );
    expect(screen.getByRole('link', { name: 'Lizenz' }).getAttribute('href')).toBe(
      LICENSE_ISSUE_URL
    );
  });

  it('blendet Gruppen ohne Instanzkontext aus', () => {
    renderSidebar({
      user: createSidebarUser({
        name: 'Admin',
        roles: ['system_admin'],
        permissionActions: ['iam.user.read', 'iam.role.read', 'iam.org.read'],
      }),
    });

    const usersToggle = screen.getByRole('button', { name: 'Benutzer' });
    fireEvent.click(usersToggle);

    expect(screen.queryByRole('link', { name: 'Gruppen' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Rollen' }).getAttribute('href')).toBe('/admin/roles');
  });

  it('zeigt Benutzerliste und Rollen auch fuer Plattform-Admins ohne Tenant-Role-Permissions an', () => {
    renderSidebar({
      user: createSidebarUser({
        name: 'Platform Admin',
        roles: ['instance_registry_admin'],
        permissionActions: [],
      }),
      contentAccess: createContentAccessState({
        access: null,
        permissionActions: [],
      }),
    });

    const usersToggle = screen.getByRole('button', { name: 'Benutzer' });
    fireEvent.click(usersToggle);

    expect(screen.getByRole('link', { name: 'Accounts' }).getAttribute('href')).toBe('/admin/users');
    expect(screen.getByRole('link', { name: 'Rollen' }).getAttribute('href')).toBe('/admin/roles');
    expect(screen.queryByRole('link', { name: 'Gruppen' })).toBeNull();
  });

  it('rendert Schnittstellen mit integration.manage auch ohne Legacy-Rollenname', () => {
    renderSidebar({
      user: createSidebarUser({
        name: 'Interface Manager',
        roles: ['custom_operator'],
        permissionActions: ['integration.manage', 'experimental.read'],
      }),
      contentAccess: createContentAccessState({
        access: {
          ...defaultReadOnlyAccessState,
          reasonCode: 'content_update_missing',
        },
      }),
    });

    expect(screen.getByRole('link', { name: 'Schnittstellen' }).getAttribute('href')).toBe(
      '/interfaces'
    );
    expect(screen.getByRole('link', { name: 'Hilfe' }).getAttribute('href')).toBe(
      HELP_DISCUSSIONS_URL
    );
    expect(screen.getByRole('link', { name: 'Support' }).getAttribute('href')).toBe(
      SUPPORT_ISSUES_URL
    );
    expect(screen.getByRole('link', { name: 'Lizenz' }).getAttribute('href')).toBe(
      LICENSE_ISSUE_URL
    );
    expect(screen.queryByRole('button', { name: 'Benutzer' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Module' })).toBeNull();
  });

  it('zeigt den Modullink fuer Tenant-Nutzer ohne Root-Systemrechte', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'tenant-user',
        name: 'Tenant User',
        instanceId: 'de-musterhausen',
      }),
      contentAccess: createContentAccessState({
        access: defaultReadOnlyAccessState,
      }),
    });

    expect(screen.getByRole('link', { name: 'Module' }).getAttribute('href')).toBe('/modules');
    expect(screen.queryByRole('link', { name: 'Monitoring' })).toBeNull();
  });

  it('rendert Hilfe, Support und Lizenz innerhalb der Bereichsnavigation', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'experimental-user',
        name: 'Experimental User',
        permissionActions: ['experimental.read'],
      }),
    });

    const navigation = screen.getByRole('navigation', { name: 'Bereichsnavigation' });

    expect(within(navigation).getByRole('link', { name: 'Hilfe' }).getAttribute('href')).toBe(
      HELP_DISCUSSIONS_URL
    );
    expect(within(navigation).getByRole('link', { name: 'Support' }).getAttribute('href')).toBe(
      SUPPORT_ISSUES_URL
    );
    expect(within(navigation).getByRole('link', { name: 'Lizenz' }).getAttribute('href')).toBe(
      LICENSE_ISSUE_URL
    );
  });

  it('zeigt Unterpunkte als Flyout, wenn die Desktop-Sidebar eingeklappt ist', () => {
    window.localStorage.setItem('sva-studio-sidebar-collapsed', '1');
    renderSidebar({
      user: createSidebarUser({
        name: 'Admin',
        roles: ['system_admin'],
        instanceId: 'de-musterhausen',
        permissionActions: [
          'iam.user.read',
          'iam.user.write',
          'iam.role.read',
          'iam.role.write',
          'iam.org.read',
          'iam.org.write',
          'iam.governance.read',
        ],
      }),
    });

    expect(screen.getByRole('button', { name: 'Seitenleiste ausklappen' })).toBeTruthy();

    const usersToggle = screen.getByRole('button', { name: 'Benutzer' });
    fireEvent.click(usersToggle);

    expect(screen.getByRole('link', { name: 'Accounts' }).getAttribute('href')).toBe(
      '/admin/users'
    );
    expect(screen.queryByRole('link', { name: 'Instanzen' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Gruppen' }).getAttribute('href')).toBe(
      '/admin/groups'
    );
    expect(screen.getByRole('link', { name: 'Datenschutz' }).getAttribute('href')).toBe(
      '/admin/iam'
    );
  });

  it('schaltet die Sidebar um und verwaltet Flyout-Fokus und Hover im eingeklappten Zustand', () => {
    renderSidebar({
      user: createSidebarUser({
        name: 'Admin',
        roles: ['system_admin'],
        permissionActions: ['iam.user.read'],
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Seitenleiste einklappen' }));
    expect(screen.getByRole('button', { name: 'Seitenleiste ausklappen' })).toBeTruthy();

    const usersToggle = screen.getByRole('button', { name: 'Benutzer' });
    const usersItem = usersToggle.closest('li');
    expect(usersItem).toBeTruthy();

    fireEvent.focus(usersToggle);
    expect(screen.getByRole('link', { name: 'Accounts' })).toBeTruthy();

    fireEvent.blur(usersToggle, { relatedTarget: document.body });
    expect(screen.queryByRole('link', { name: 'Accounts' })).toBeNull();

    fireEvent.mouseEnter(usersItem!);
    expect(screen.getByRole('link', { name: 'Accounts' })).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: 'Accounts' }));
    expect(screen.queryByRole('link', { name: 'Accounts' })).toBeNull();

    fireEvent.mouseEnter(usersItem!);
    expect(screen.getByRole('link', { name: 'Accounts' })).toBeTruthy();

    fireEvent.mouseLeave(usersItem!);
    expect(screen.queryByRole('link', { name: 'Accounts' })).toBeNull();
  });

  it('schliesst die mobile Navigation nach einem Klick auf einen Link', () => {
    const onMobileOpenChange = vi.fn();
    useAuthMock.mockReturnValue(unauthenticatedAuthState);

    render(<Sidebar isMobileOpen onMobileOpenChange={onMobileOpenChange} />);

    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Seitenleiste' })).getByRole('link', {
        name: 'Übersicht',
      })
    );

    expect(onMobileOpenChange).toHaveBeenCalledWith(false);
  });

  it('versteckt den Inhalte-Link ohne effektive Content-Leseberechtigung', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-2',
        name: 'Viewer',
        roles: ['viewer'],
      }),
      contentAccess: createContentAccessState({
        access: defaultBlockedAccessState,
      }),
    });

    expect(screen.queryByRole('link', { name: 'Inhalte' })).toBeNull();
  });

  it('versteckt den Medien-Link ohne media.read-Berechtigung oder ohne Modulzuweisung', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-2',
        name: 'Editor',
        assignedModules: ['news'],
      }),
    });

    expect(screen.queryByRole('link', { name: 'Medien' })).toBeNull();
  });

  it('zeigt den Medien-Link nur bei zugewiesenem Modul und media.read-Berechtigung', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-2',
        name: 'Editor',
        assignedModules: ['media'],
      }),
      contentAccess: createContentAccessState({
        permissionActions: ['media.read'],
      }),
    });

    expect(screen.getByRole('link', { name: 'Medien' }).getAttribute('href')).toBe('/admin/media');
  });

  it('zeigt den Medien-Link auch ohne content.read, solange media-Modul und media.read vorhanden sind', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-2',
        name: 'Editor',
        assignedModules: ['media'],
      }),
      contentAccess: createContentAccessState({
        access: defaultBlockedDirectRoleAccessState,
        permissionActions: ['media.read'],
      }),
    });

    expect(screen.getByRole('link', { name: 'Medien' }).getAttribute('href')).toBe('/admin/media');
    expect(screen.queryByRole('link', { name: 'Inhalte' })).toBeNull();
  });

  it('zeigt den Kategorien-Link auch ohne content.read, solange categories.read vorhanden ist', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-2',
        name: 'Editor',
        assignedModules: ['categories'],
      }),
      contentAccess: createContentAccessState({
        access: defaultBlockedDirectRoleAccessState,
        permissionActions: ['categories.read'],
      }),
    });

    expect(screen.getByRole('link', { name: 'Kategorien' }).getAttribute('href')).toBe('/categories');
    expect(screen.queryByRole('link', { name: 'Inhalte' })).toBeNull();
  });

  it('versteckt den Kategorien-Link ohne zugewiesenes Kategorien-Modul trotz categories.read', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-2',
        name: 'Editor',
        assignedModules: ['news'],
      }),
      contentAccess: createContentAccessState({
        access: defaultBlockedDirectRoleAccessState,
        permissionActions: ['categories.read'],
      }),
    });

    expect(screen.queryByRole('link', { name: 'Kategorien' })).toBeNull();
  });

  it('versteckt den Kategorien-Link ohne categories.read trotz content.read', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-2',
        name: 'Editor',
        assignedModules: ['categories'],
      }),
      contentAccess: createContentAccessState({
        access: defaultEditableAccessState,
      }),
    });

    expect(screen.getByRole('link', { name: 'Inhalte' }).getAttribute('href')).toBe('/admin/content');
    expect(screen.queryByRole('link', { name: 'Kategorien' })).toBeNull();
  });

  it('zeigt im Bereich Anwendungen nur den App-Link mit app.read-Berechtigung', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-3',
        name: 'App Reader',
        permissionActions: ['experimental.read'],
      }),
      contentAccess: createContentAccessState({
        access: defaultReadOnlyAccessState,
        permissionActions: ['app.read'],
      }),
    });

    expect(screen.getByText('Anwendungen')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'App' }).getAttribute('href')).toBe('/app');
    expect(screen.queryByRole('link', { name: 'Cockpit' })).toBeNull();
  });

  it('zeigt im Bereich Anwendungen nur den Cockpit-Link mit cockpit.read-Berechtigung', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-4',
        name: 'Cockpit Reader',
        permissionActions: ['experimental.read'],
      }),
      contentAccess: createContentAccessState({
        access: defaultReadOnlyAccessState,
        permissionActions: ['cockpit.read'],
      }),
    });

    expect(screen.getByText('Anwendungen')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'App' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Cockpit' }).getAttribute('href')).toBe(COCKPIT_URL);
  });

  it('blendet den Bereich Anwendungen komplett aus, wenn weder app.read noch cockpit.read vorhanden ist', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-5',
        name: 'Restricted User',
        permissionActions: ['experimental.read'],
      }),
      contentAccess: createContentAccessState({
        access: defaultReadOnlyAccessState,
      }),
    });

    expect(screen.queryByText('Anwendungen')).toBeNull();
    expect(screen.queryByRole('link', { name: 'App' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Cockpit' })).toBeNull();
  });

  it('zeigt experimentelle Footer-Links auch ohne Fachrechte, aber keine fachlichen Experimental-Menues', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-6',
        name: 'Experimental Only',
        permissionActions: ['experimental.read'],
      }),
      contentAccess: createContentAccessState({
        access: defaultReadOnlyAccessState,
      }),
    });

    expect(screen.getByRole('link', { name: 'Hilfe' }).getAttribute('href')).toBe(HELP_DISCUSSIONS_URL);
    expect(screen.getByRole('link', { name: 'Support' }).getAttribute('href')).toBe(SUPPORT_ISSUES_URL);
    expect(screen.getByRole('link', { name: 'Lizenz' }).getAttribute('href')).toBe(LICENSE_ISSUE_URL);
    expect(screen.queryByRole('link', { name: 'App' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Cockpit' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Monitoring' })).toBeNull();
  });

  it('versteckt experimentelle Navigation ohne experimental.read trotz vorhandener Fachrechte', () => {
    renderSidebar({
      user: createSidebarUser({
        id: 'user-7',
        name: 'No Experimental',
        permissionActions: ['iam.monitoring.read'],
      }),
      contentAccess: createContentAccessState({
        access: defaultReadOnlyAccessState,
        permissionActions: ['app.read', 'cockpit.read'],
      }),
    });

    expect(screen.queryByRole('link', { name: 'App' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Cockpit' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Monitoring' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Hilfe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Support' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Lizenz' })).toBeNull();
  });

  it('rendert benutzerdefinierte Plugin-Navigation innerhalb der Datenverwaltung und markiert sie als aktiv', () => {
    renderSidebar({
      route: '/plugins/news/review',
      user: createSidebarUser({
        name: 'Editor',
        assignedModules: ['news'],
      }),
      contentAccess: createContentAccessState({
        access: defaultEditableAccessState,
      }),
    });

    const navigation = screen.getByRole('navigation', { name: 'Bereichsnavigation' });
    const newsLink = within(navigation).getByRole('link', { name: 'News' });

    expect(newsLink.getAttribute('href')).toBe('/plugins/news/review');
    expect(newsLink.getAttribute('aria-current')).toBe('page');
  });

  it('blendet Plugin-Navigation fail-closed aus, wenn das Modul der aktiven Instanz nicht zugewiesen ist', () => {
    renderSidebar({
      user: createSidebarUser({
        name: 'Editor',
        assignedModules: [],
      }),
    });

    expect(screen.queryByRole('link', { name: 'News' })).toBeNull();
  });

  it('blendet Plugin-Navigation ohne passende Payload-Update-Berechtigung aus', () => {
    studioPluginNavigationMock.items = [
      {
        id: 'news.write',
        to: '/plugins/news/review',
        titleKey: 'news.navigation.title',
        section: 'dataManagement',
        requiredAction: 'content.updatePayload',
      },
    ];
    renderSidebar({
      user: createSidebarUser({
        name: 'Reader',
      }),
      contentAccess: createContentAccessState({
        access: {
          ...defaultReadOnlyAccessState,
          canCreate: true,
        },
      }),
    });

    expect(screen.queryByRole('link', { name: 'News' })).toBeNull();
  });

  it('löst Plugin-Navigation über die Action-Registry auf, wenn actionId gesetzt ist', () => {
    studioPluginNavigationMock.items = [
      {
        id: 'news.publish',
        to: '/plugins/news/publish',
        titleKey: 'news.navigation.title',
        section: 'dataManagement',
        actionId: 'news.publish',
      },
    ];
    studioPluginActionLookupMock.get.mockReturnValue({
      actionId: 'news.publish',
      namespace: 'news',
      actionName: 'publish',
      ownerPluginId: 'news',
      titleKey: 'news.actions.publish',
      requiredAction: 'news.read',
    });
    renderSidebar({
      user: createSidebarUser({
        name: 'Editor',
        assignedModules: ['news'],
      }),
      contentAccess: createContentAccessState({
        access: defaultEditableAccessState,
      }),
    });

    expect(screen.getByRole('link', { name: 'news.actions.publish' }).getAttribute('href')).toBe(
      '/plugins/news/publish'
    );
    expect(studioPluginActionLookupMock.get).toHaveBeenCalledWith('news.publish');
  });

  it('blendet Plugin-Navigation fail-closed aus, wenn nur eine feingranulare Update-Berechtigung verlangt wird', () => {
    studioPluginNavigationMock.items = [
      {
        id: 'news.publish',
        to: '/plugins/news/publish',
        titleKey: 'news.navigation.title',
        section: 'dataManagement',
        requiredAction: 'content.updatePayload',
      },
    ];
    renderSidebar({
      user: createSidebarUser({
        name: 'Editor',
      }),
      contentAccess: createContentAccessState({
        permissionActions: [],
      }),
    });

    expect(screen.queryByRole('link', { name: 'News' })).toBeNull();
  });
});
