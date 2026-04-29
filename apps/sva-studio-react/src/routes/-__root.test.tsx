import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useRouterStateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  HeadContent: () => null,
  Outlet: () => <div data-testid="outlet" />,
  Scripts: () => null,
  createRootRoute: (options: unknown) => options,
  useRouterState: (input: { select: (state: any) => unknown }) => useRouterStateMock(input),
}));

vi.mock('@tanstack/react-devtools', () => ({
  TanStackDevtools: () => <div data-testid="tanstack-devtools" />,
}));

vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => <div data-testid="router-devtools-panel" />,
}));

vi.mock('@tanstack/react-start', () => ({
  createServerOnlyFn: (fn: () => Promise<unknown>) => fn,
}));

vi.mock('../components/AppShell', () => ({
  default: ({
    children,
    isLoading,
    currentPathname,
  }: {
    children: React.ReactNode;
    isLoading: boolean;
    currentPathname: string;
  }) => (
    <div data-current-pathname={currentPathname} data-is-loading={String(isLoading)} data-testid="app-shell">
      {children}
    </div>
  ),
}));

vi.mock('../components/DevelopmentLogConsole', () => ({
  default: () => <div data-testid="development-log-console" />,
}));

vi.mock('../components/ErrorFallback', () => ({
  default: () => <div data-testid="error-fallback" />,
}));

vi.mock('../components/NotFound', () => ({
  default: () => <div data-testid="not-found" />,
}));

vi.mock('../providers/auth-provider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../providers/locale-provider', () => ({
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../providers/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../i18n', () => ({
  t: (key: string) => key,
}));

describe('root route document', () => {
  beforeEach(() => {
    useRouterStateMock.mockImplementation(({ select }) =>
      select({
        status: 'idle',
        isLoading: false,
        location: { pathname: '/admin/users' },
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('returns stable root head metadata', async () => {
    const { getRootHead } = await import('./__root');

    expect(getRootHead()).toEqual({
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: 'SVA Studio' },
      ],
      links: [{ rel: 'stylesheet', href: expect.any(String) }],
    });
  });

  it('renders the app shell and focuses main content from the skip link', async () => {
    const { RootDocument } = await import('./__root');

    render(
      <>
        <main id="main-content" tabIndex={-1} />
        <RootDocument>
          <div>content</div>
        </RootDocument>
      </>,
    );

    const skipLink = screen.getByRole('link', { name: 'shell.skipToContent' });
    fireEvent.click(skipLink);

    await waitFor(() => {
      expect(screen.getByTestId('app-shell').getAttribute('data-current-pathname')).toBe('/admin/users');
      expect(document.getElementById('main-content')).toBe(document.activeElement);
    });
  });

  it('updates the document title for plugin routes', async () => {
    useRouterStateMock.mockImplementation(({ select }) =>
      select({
        status: 'idle',
        isLoading: false,
        location: { pathname: '/admin/news' },
      }),
    );

    const { RootDocument } = await import('./__root');

    render(
      <>
        <main id="main-content" tabIndex={-1} />
        <RootDocument>
          <div>content</div>
        </RootDocument>
      </>,
    );

    await waitFor(() => {
      expect(document.title).toBe('news.navigation.title | SVA Studio');
    });
  });

  it('marks the shell as loading after hydration when the router is pending', async () => {
    useRouterStateMock.mockImplementation(({ select }) =>
      select({
        status: 'pending',
        isLoading: true,
        location: { pathname: '/admin/users' },
      }),
    );

    const { RootDocument } = await import('./__root');

    render(
      <RootDocument>
        <div>content</div>
      </RootDocument>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('app-shell').getAttribute('data-is-loading')).toBe('true');
    });
  });
});
