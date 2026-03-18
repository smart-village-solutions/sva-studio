/**
 * Unit-Tests für Sidebar-Rendering, Abschnittsstruktur und Collapse-Verhalten.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Sidebar from './Sidebar';

const useAuthMock = vi.fn();
const useRouterStateMock = vi.fn();
const localStorageState = new Map<string, string>();

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
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
        roles: ['system_admin'],
      },
      isAuthenticated: true,
    });

    render(<Sidebar />);

    expect(screen.getByText('Datenverwaltung')).toBeTruthy();
    expect(screen.getByText('Anwendungen')).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Übersicht' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Inhalte' }).getAttribute('href')).toBe('/content');
    expect(screen.getByRole('link', { name: 'App' }).getAttribute('href')).toBe('/app');

    const usersToggle = screen.getByRole('button', { name: 'Benutzer' });
    fireEvent.click(usersToggle);

    expect(screen.getByRole('link', { name: 'Accounts' }).getAttribute('href')).toBe('/admin/users');
    expect(screen.getByRole('link', { name: 'Organisationen' }).getAttribute('href')).toBe('/admin/organizations');
    expect(screen.getByRole('link', { name: 'Rollen' }).getAttribute('href')).toBe('/admin/roles');
    expect(screen.getByRole('link', { name: 'Gruppen' }).getAttribute('href')).toBe('/admin/groups');
    expect(screen.getByRole('link', { name: 'Rechtstexte' }).getAttribute('href')).toBe('/admin/legal-texts');
    expect(screen.getByRole('link', { name: 'Datenschutz' }).getAttribute('href')).toBe('/admin/iam');
    expect(screen.getByRole('link', { name: 'Schnittstellen' }).getAttribute('href')).toBe('/interfaces');
    expect(screen.getByRole('link', { name: 'Module' }).getAttribute('href')).toBe('/modules');
    expect(screen.getByRole('link', { name: 'Monitoring' }).getAttribute('href')).toBe('/monitoring');
    expect(screen.getByRole('link', { name: 'Hilfe' }).getAttribute('href')).toBe('/help');
    expect(screen.getByRole('link', { name: 'Support' }).getAttribute('href')).toBe('/support');
    expect(screen.getByRole('link', { name: 'Lizenz' }).getAttribute('href')).toBe('/license');
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

    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Schnittstellen' }).getAttribute('href')).toBe('/interfaces');
    expect(screen.getByRole('link', { name: 'Hilfe' }).getAttribute('href')).toBe('/help');
    expect(screen.getByRole('link', { name: 'Support' }).getAttribute('href')).toBe('/support');
    expect(screen.getByRole('link', { name: 'Lizenz' }).getAttribute('href')).toBe('/license');
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
        roles: ['system_admin'],
      },
      isAuthenticated: true,
    });

    render(<Sidebar />);

    expect(screen.getByRole('button', { name: 'Seitenleiste ausklappen' })).toBeTruthy();

    const usersToggle = screen.getByRole('button', { name: 'Benutzer' });
    fireEvent.click(usersToggle);

    expect(screen.getByRole('link', { name: 'Accounts' }).getAttribute('href')).toBe('/admin/users');
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
});
