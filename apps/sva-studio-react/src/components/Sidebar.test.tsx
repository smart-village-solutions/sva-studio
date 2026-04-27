/**
 * Unit-Tests für Sidebar-Rendering, Abschnittsstruktur und Collapse-Verhalten.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
      to: '/plugins/news',
      titleKey: 'news.navigation.title',
      section: 'dataManagement',
      requiredAction: 'news.read',
    },
  ] as PluginNavigationItemMock[],
}));
const studioPluginActionLookupMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: React.ReactNode;
    activeOptions?: unknown;
  }) => (
    (() => {
      const { activeOptions: _activeOptions, ...anchorProps } = props;
      const pathname = useRouterStateMock();
      const isActive = pathname === to || pathname.startsWith(`${to}/`);
      return (
        <a href={to} aria-current={isActive ? 'page' : undefined} {...anchorProps}>
          {children}
        </a>
      );
    })()
  ),
  useRouterState: (options?: { select?: (state: { location: { pathname: string } }) => unknown }) => {
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
      to: '/plugins/news',
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

  it('rendert die neuen Abschnittsüberschriften und das Benutzer-Untermenü für system_admin', () => {
    useAuthMock.mockReturnValue({
      ...unauthenticatedAuthState,
      user: {
        id: 'user-1',
        name: 'Admin',
        roles: ['system_admin', 'instance_registry_admin'],
      },
      isAuthenticated: true,
    });
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: ['direct_role'],
      },
      permissionActions: ['news.read'],
      isLoading: false,
      error: null,
    });

    render(<Sidebar />);

    expect(screen.getByText('Datenverwaltung')).toBeTruthy();
    expect(screen.getByText('Anwendungen')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Übersicht' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Inhalte' }).getAttribute('href')).toBe('/admin/content');
    expect(screen.getByRole('link', { name: 'App' }).getAttribute('href')).toBe('/app');
    expect(screen.getByRole('link', { name: 'Cockpit' }).getAttribute('href')).toBe(COCKPIT_URL);
    expect(screen.getByRole('link', { name: 'Cockpit' }).getAttribute('target')).toBe('_blank');

    const usersToggle = screen.getByRole('button', { name: 'Benutzer' });
    fireEvent.click(usersToggle);

    expect(screen.getByRole('link', { name: 'Accounts' }).getAttribute('href')).toBe('/admin/users');
    expect(screen.getByRole('link', { name: 'Organisationen' }).getAttribute('href')).toBe('/admin/organizations');
    expect(screen.getByRole('link', { name: 'Instanzen' }).getAttribute('href')).toBe('/admin/instances');
    expect(screen.getByRole('link', { name: 'Rollen' }).getAttribute('href')).toBe('/admin/roles');
    expect(screen.getByRole('link', { name: 'Gruppen' }).getAttribute('href')).toBe('/admin/groups');
    expect(screen.getByRole('link', { name: 'Rechtstexte' }).getAttribute('href')).toBe('/admin/legal-texts');
    expect(screen.getByRole('link', { name: 'Datenschutz' }).getAttribute('href')).toBe('/admin/iam');
    expect(screen.getByRole('link', { name: 'Schnittstellen' }).getAttribute('href')).toBe('/interfaces');
    expect(screen.getByRole('link', { name: 'Module' }).getAttribute('href')).toBe('/modules');
    expect(screen.getByRole('link', { name: 'Monitoring' }).getAttribute('href')).toBe('/monitoring');
    expect(screen.getByRole('link', { name: 'Hilfe' }).getAttribute('href')).toBe(HELP_DISCUSSIONS_URL);
    expect(screen.getByRole('link', { name: 'Support' }).getAttribute('href')).toBe(SUPPORT_ISSUES_URL);
    expect(screen.getByRole('link', { name: 'Lizenz' }).getAttribute('href')).toBe(LICENSE_ISSUE_URL);
  });

  it('rendert Schnittstellen fuer interface_manager ohne System-Untermenue', () => {
    useAuthMock.mockReturnValue({
      ...unauthenticatedAuthState,
      user: {
        id: 'user-1',
        name: 'Interface Manager',
        roles: ['interface_manager'],
      },
      isAuthenticated: true,
    });
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'read_only',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        reasonCode: 'content_update_missing',
        organizationIds: [],
        sourceKinds: ['direct_role'],
      },
      isLoading: false,
      error: null,
    });

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Schnittstellen' }).getAttribute('href')).toBe('/interfaces');
    expect(screen.getByRole('link', { name: 'Hilfe' }).getAttribute('href')).toBe(HELP_DISCUSSIONS_URL);
    expect(screen.getByRole('link', { name: 'Support' }).getAttribute('href')).toBe(SUPPORT_ISSUES_URL);
    expect(screen.getByRole('link', { name: 'Lizenz' }).getAttribute('href')).toBe(LICENSE_ISSUE_URL);
    expect(screen.queryByRole('button', { name: 'Benutzer' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Module' })).toBeNull();
  });


  it('zeigt Unterpunkte als Flyout, wenn die Desktop-Sidebar eingeklappt ist', () => {
    window.localStorage.setItem('sva-studio-sidebar-collapsed', '1');
    useAuthMock.mockReturnValue({
      ...unauthenticatedAuthState,
      user: {
        id: 'user-1',
        name: 'Admin',
        roles: ['system_admin', 'instance_registry_admin'],
      },
      isAuthenticated: true,
    });
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: ['direct_role'],
      },
      permissionActions: ['news.read'],
      isLoading: false,
      error: null,
    });

    render(<Sidebar />);

    expect(screen.getByRole('button', { name: 'Seitenleiste ausklappen' })).toBeTruthy();

    const usersToggle = screen.getByRole('button', { name: 'Benutzer' });
    fireEvent.click(usersToggle);

    expect(screen.getByRole('link', { name: 'Accounts' }).getAttribute('href')).toBe('/admin/users');
    expect(screen.getByRole('link', { name: 'Instanzen' }).getAttribute('href')).toBe('/admin/instances');
    expect(screen.getByRole('link', { name: 'Gruppen' }).getAttribute('href')).toBe('/admin/groups');
    expect(screen.getByRole('link', { name: 'Datenschutz' }).getAttribute('href')).toBe('/admin/iam');
  });

  it('schaltet die Sidebar um und verwaltet Flyout-Fokus und Hover im eingeklappten Zustand', () => {
    useAuthMock.mockReturnValue({
      ...unauthenticatedAuthState,
      user: {
        id: 'user-1',
        name: 'Admin',
        roles: ['system_admin'],
      },
      isAuthenticated: true,
    });
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: ['direct_role'],
      },
      permissionActions: ['news.read'],
      isLoading: false,
      error: null,
    });

    render(<Sidebar />);

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
      within(screen.getByRole('dialog', { name: 'Seitenleiste' })).getByRole('link', { name: 'Übersicht' })
    );

    expect(onMobileOpenChange).toHaveBeenCalledWith(false);
  });

  it('versteckt den Inhalte-Link ohne effektive Content-Leseberechtigung', () => {
    useAuthMock.mockReturnValue({
      ...unauthenticatedAuthState,
      user: {
        id: 'user-2',
        name: 'Viewer',
        roles: ['viewer'],
      },
      isAuthenticated: true,
    });
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'blocked',
        canRead: false,
        canCreate: false,
        canUpdate: false,
        reasonCode: 'content_read_missing',
        organizationIds: [],
        sourceKinds: [],
      },
      isLoading: false,
      error: null,
    });

    render(<Sidebar />);

    expect(screen.queryByRole('link', { name: 'Inhalte' })).toBeNull();
  });

  it('rendert den News-Plugin-Navigationspunkt innerhalb der Datenverwaltung und markiert ihn als aktiv', () => {
    useRouterStateMock.mockReturnValue('/plugins/news');
    useAuthMock.mockReturnValue({
      ...unauthenticatedAuthState,
      user: {
        id: 'user-1',
        name: 'Editor',
        roles: ['editor'],
      },
      isAuthenticated: true,
    });
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: ['direct_role'],
      },
      permissionActions: ['news.read'],
      isLoading: false,
      error: null,
    });

    render(<Sidebar />);

    const navigation = screen.getByRole('navigation', { name: 'Bereichsnavigation' });
    const newsLink = within(navigation).getByRole('link', { name: 'News' });

    expect(newsLink.getAttribute('href')).toBe('/plugins/news');
    expect(newsLink.getAttribute('aria-current')).toBe('page');
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
    useAuthMock.mockReturnValue({
      ...unauthenticatedAuthState,
      user: {
        id: 'user-1',
        name: 'Reader',
        roles: ['editor'],
      },
      isAuthenticated: true,
    });
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'read_only',
        canRead: true,
        canCreate: true,
        canUpdate: false,
        organizationIds: [],
        sourceKinds: ['direct_role'],
      },
      isLoading: false,
      error: null,
    });

    render(<Sidebar />);

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
    useAuthMock.mockReturnValue({
      ...unauthenticatedAuthState,
      user: {
        id: 'user-1',
        name: 'Editor',
        roles: ['editor'],
      },
      isAuthenticated: true,
    });
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: ['direct_role'],
      },
      permissionActions: ['news.read'],
      isLoading: false,
      error: null,
    });

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'news.actions.publish' }).getAttribute('href')).toBe('/plugins/news/publish');
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
    useAuthMock.mockReturnValue({
      ...unauthenticatedAuthState,
      user: {
        id: 'user-1',
        name: 'Editor',
        roles: ['editor'],
      },
      isAuthenticated: true,
    });
    useContentAccessMock.mockReturnValue({
      access: {
        state: 'editable',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        organizationIds: [],
        sourceKinds: ['direct_role'],
      },
      isLoading: false,
      error: null,
    });

    render(<Sidebar />);

    expect(screen.queryByRole('link', { name: 'News' })).toBeNull();
  });
});
