import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useRouterStateMock = vi.fn();
const useMatchesMock = vi.fn();
const activeLocaleMock = vi.hoisted(() => ({ value: 'de' }));

const documentSessionMocks = vi.hoisted(() => ({
  getRequest: vi.fn<() => Request>(),
  setResponseHeader: vi.fn(),
  withAuthenticatedUser: vi.fn(),
  loadStudioReleaseNotes: vi.fn(),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: documentSessionMocks.getRequest,
  setResponseHeader: documentSessionMocks.setResponseHeader,
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: documentSessionMocks.withAuthenticatedUser,
}));

vi.mock('../lib/studio-release-notes.server', () => ({
  loadStudioReleaseNotes: documentSessionMocks.loadStudioReleaseNotes,
}));

vi.mock('@tanstack/react-router', () => ({
  HeadContent: () => null,
  Outlet: () => <div data-testid="outlet" />,
  Scripts: () => null,
  createRootRoute: (options: unknown) => options,
  useMatches: () => useMatchesMock(),
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
    isNavigating,
    currentPathname,
  }: {
    children: React.ReactNode;
    isNavigating: boolean;
    currentPathname: string;
  }) => (
    <div
      data-current-pathname={currentPathname}
      data-is-navigating={String(isNavigating)}
      data-testid="app-shell"
    >
      {children}
    </div>
  ),
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

vi.mock('../hooks/use-organization-context', () => ({
  OrganizationContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../providers/effective-access-provider', () => ({
  EffectiveAccessProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../providers/locale-provider', () => ({
  LocaleProvider: ({ children }: { children: React.ReactNode }) => {
    const [locale, setLocale] = React.useState<'de' | 'en'>('de');

    return (
      <>
        <button
          type="button"
          onClick={() => {
            activeLocaleMock.value = 'en';
            setLocale('en');
          }}
        >
          switch locale
        </button>
        <React.Fragment key={locale}>{children}</React.Fragment>
      </>
    );
  },
}));

vi.mock('../providers/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../i18n')>()),
  t: (key: string) =>
    key === 'shell.appName'
      ? 'SVA Studio'
      : key === 'home.branding.kasselDialog.title'
        ? activeLocaleMock.value === 'de'
          ? 'Kassel DIALOG'
          : 'Kassel DIALOG EN'
        : key,
}));

describe('root route document', () => {
  const importRootDocument = async () => {
    const { RootDocument } = await import('./__root');
    return RootDocument;
  };

  const mockPendingRoute = () => {
    useRouterStateMock.mockImplementation(({ select }) =>
      select({
        status: 'pending',
        isLoading: true,
        location: { pathname: '/admin/users', href: '/admin/users' },
        resolvedLocation: { pathname: '/admin/content', href: '/admin/content' },
      })
    );
  };

  const renderPendingRootDocument = async () => {
    mockPendingRoute();
    const RootDocument = await importRootDocument();

    render(
      <RootDocument>
        <div>content</div>
      </RootDocument>
    );
  };

  it('publishes the safe server runtime configuration in metadata', async () => {
    const { resolveServerStudioBranding, resolveServerStudioParentDomain, getRootHead } =
      await import('./__root');
    try {
      vi.stubEnv('SVA_STUDIO_BRANDING', 'kassel-dialog');
      vi.stubEnv('SVA_PARENT_DOMAIN', 'Dialog.Kassel.DE');
      expect(resolveServerStudioBranding()).toBe('kassel-dialog');
      expect(resolveServerStudioParentDomain()).toBe('dialog.kassel.de');
      expect(
        getRootHead({
          loaderData: {
            pluginRouteScope: 'platform',
            studioBranding: 'kassel-dialog',
            studioParentDomain: 'dialog.kassel.de',
          },
        }).meta
      ).toContainEqual({ name: 'sva-studio-branding', content: 'kassel-dialog' });
      expect(
        getRootHead({
          loaderData: {
            pluginRouteScope: 'platform',
            studioBranding: 'kassel-dialog',
            studioParentDomain: 'dialog.kassel.de',
          },
        }).meta
      ).toContainEqual({ name: 'sva-studio-parent-domain', content: 'dialog.kassel.de' });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('exposes the ingest-only browser key exclusively on staging', async () => {
    const { resolveServerFallowBrowserBeaconKey, getRootHead } = await import('./__root');
    try {
      vi.stubEnv('FALLOW_BROWSER_INGEST_KEY', 'fallow_pub_k1_test_only');
      vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', 'production');
      expect(resolveServerFallowBrowserBeaconKey()).toBe('');
      expect(
        getRootHead({
          loaderData: {
            pluginRouteScope: 'platform',
            studioBranding: 'sva-studio',
            studioParentDomain: '',
            fallowBrowserBeaconKey: '',
          },
        }).meta.some((entry) => 'name' in entry && entry.name === 'sva-fallow-browser-beacon-key')
      ).toBe(false);

      vi.stubEnv('SVA_DEPLOYMENT_ENVIRONMENT', 'staging');
      const key = resolveServerFallowBrowserBeaconKey();
      expect(key).toBe('fallow_pub_k1_test_only');
      expect(
        getRootHead({
          loaderData: {
            pluginRouteScope: 'platform',
            studioBranding: 'sva-studio',
            studioParentDomain: '',
            fallowBrowserBeaconKey: key,
          },
        }).meta
      ).toContainEqual({
        name: 'sva-fallow-browser-beacon-key',
        content: key,
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('only prepares navigation and Changelog data for a verified document session', async () => {
    const { loadDocumentSession } = await import('./__root');
    const request = (path: string, headers?: HeadersInit) =>
      ({ url: `https://studio.test${path}`, headers: new Headers(headers) }) as Request;
    const cookie = { cookie: 'session=test' };

    documentSessionMocks.getRequest.mockReturnValue(request('/'));
    documentSessionMocks.withAuthenticatedUser.mockClear();
    documentSessionMocks.loadStudioReleaseNotes.mockClear();
    await expect(loadDocumentSession()).resolves.toEqual({});
    expect(documentSessionMocks.withAuthenticatedUser).not.toHaveBeenCalled();
    expect(documentSessionMocks.setResponseHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store'
    );

    documentSessionMocks.getRequest.mockReturnValue(request('/changelog', cookie));
    documentSessionMocks.withAuthenticatedUser.mockResolvedValueOnce(
      new Response(null, { status: 401 })
    );
    await expect(loadDocumentSession()).resolves.toEqual({});
    expect(documentSessionMocks.loadStudioReleaseNotes).not.toHaveBeenCalled();

    documentSessionMocks.withAuthenticatedUser.mockImplementation(
      (_request: Request, handler: () => Promise<Response>) => handler()
    );
    documentSessionMocks.getRequest.mockReturnValue(request('/', cookie));
    await expect(loadDocumentSession()).resolves.toEqual({ initiallyAuthenticated: true });
    expect(documentSessionMocks.loadStudioReleaseNotes).not.toHaveBeenCalled();

    documentSessionMocks.getRequest.mockReturnValue(request('/changelog/', cookie));
    documentSessionMocks.loadStudioReleaseNotes.mockResolvedValueOnce([]);
    await expect(loadDocumentSession()).resolves.toEqual({
      initiallyAuthenticated: true,
      changelogReleases: [],
    });

    documentSessionMocks.loadStudioReleaseNotes.mockRejectedValueOnce(new Error('offline'));
    await expect(loadDocumentSession()).resolves.toEqual({ initiallyAuthenticated: true });
  });

  it('restores public root configuration during client navigation', async () => {
    const pluginScopeMeta = document.createElement('meta');
    pluginScopeMeta.name = 'sva-plugin-route-scope';
    pluginScopeMeta.content = 'tenant';
    document.head.append(pluginScopeMeta);
    const brandingMeta = document.createElement('meta');
    brandingMeta.name = 'sva-studio-branding';
    brandingMeta.content = 'kassel-dialog';
    document.head.append(brandingMeta);
    const parentDomainMeta = document.createElement('meta');
    parentDomainMeta.name = 'sva-studio-parent-domain';
    parentDomainMeta.content = 'dialog.kassel.de';
    document.head.append(parentDomainMeta);

    try {
      const { loadRootData } = await import('./__root');
      await expect(loadRootData()).resolves.toEqual({
        pluginRouteScope: 'tenant',
        studioBranding: 'kassel-dialog',
        studioParentDomain: 'dialog.kassel.de',
        fallowBrowserBeaconKey: '',
      });
    } finally {
      pluginScopeMeta.remove();
      brandingMeta.remove();
      parentDomainMeta.remove();
    }
  });

  beforeEach(() => {
    activeLocaleMock.value = 'de';
    useMatchesMock.mockReturnValue([]);
    useRouterStateMock.mockImplementation(({ select }) =>
      select({
        status: 'idle',
        isLoading: false,
        location: { pathname: '/admin/users' },
      })
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
      links: [
        {
          rel: 'stylesheet',
          href: expect.any(String),
        },
      ],
    });
  });

  it('uses the server-selected app name in root metadata', async () => {
    const { getRootHead } = await import('./__root');

    expect(
      getRootHead({
        loaderData: {
          pluginRouteScope: 'platform',
          studioBranding: 'kassel-dialog',
          studioParentDomain: 'dialog.kassel.de',
        },
      }).meta
    ).toContainEqual({ title: 'Kassel DIALOG' });
  });

  it('publishes the server-resolved plugin route scope for hydration', async () => {
    const { getRootHead } = await import('./__root');

    expect(
      getRootHead({
        loaderData: {
          pluginRouteScope: 'tenant',
          studioBranding: 'sva-studio',
          studioParentDomain: 'studio.smart-village.app',
        },
      }).meta
    ).toContainEqual({
      name: 'sva-plugin-route-scope',
      content: 'tenant',
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
      </>
    );

    const skipLink = screen.getByRole('link', { name: 'shell.skipToContent' });
    fireEvent.click(skipLink);

    await waitFor(() => {
      expect(screen.getByTestId('app-shell').getAttribute('data-current-pathname')).toBe(
        '/admin/users'
      );
      expect(document.getElementById('main-content')).toBe(document.activeElement);
    });

    expect(document.body.className).toContain('bg-background');
    expect(document.body.className).toContain('text-foreground');
    expect(skipLink.className).toContain('bg-card');
    expect(skipLink.className).toContain('border-border');
    expect(document.head.querySelector('script[data-theme-bootstrap="true"]')).not.toBeNull();
    expect(document.head.querySelector('style[data-app-styles="true"]')).toBeNull();
  });

  it('updates the document title for the unified content route', async () => {
    useRouterStateMock.mockImplementation(({ select }) =>
      select({
        status: 'idle',
        isLoading: false,
        location: { pathname: '/admin/content' },
      })
    );

    const { RootDocument } = await import('./__root');

    render(
      <>
        <main id="main-content" tabIndex={-1} />
        <RootDocument>
          <div>content</div>
        </RootDocument>
      </>
    );

    await waitFor(() => {
      expect(document.title).toBe('content.page.title | SVA Studio');
    });
  });

  it('updates route titles with the server-selected app name', async () => {
    useMatchesMock.mockReturnValue([
      { routeId: '__root__', loaderData: { studioBranding: 'kassel-dialog' } },
    ]);
    useRouterStateMock.mockImplementation(({ select }) =>
      select({
        status: 'idle',
        isLoading: false,
        location: { pathname: '/admin/content' },
      })
    );

    const { RootDocument } = await import('./__root');
    render(
      <RootDocument>
        <div>content</div>
      </RootDocument>
    );

    await waitFor(() => {
      expect(document.title).toBe('content.page.title | Kassel DIALOG');
    });
  });

  it('updates the app name in the document title after a locale change', async () => {
    useMatchesMock.mockReturnValue([
      { routeId: '__root__', loaderData: { studioBranding: 'kassel-dialog' } },
    ]);
    useRouterStateMock.mockImplementation(({ select }) =>
      select({
        status: 'idle',
        isLoading: false,
        location: { pathname: '/admin/content' },
      })
    );

    const { RootDocument } = await import('./__root');
    render(
      <RootDocument>
        <div>content</div>
      </RootDocument>
    );

    const localeSwitch = screen.getByRole('button', { name: 'switch locale' });
    localeSwitch.focus();
    fireEvent.click(localeSwitch);

    await waitFor(() => {
      expect(document.title).toBe('content.page.title | Kassel DIALOG EN');
      expect(document.activeElement).toBe(localeSwitch);
    });
  });

  it.each([
    { status: 'pending', isLoading: true },
    { status: 'idle', isLoading: true },
  ])('preserves editor content during a same-location reload ($status)', async (pendingState) => {
    useRouterStateMock.mockImplementation(({ select }) =>
      select({
        ...pendingState,
        location: { pathname: '/admin/faq/new', href: '/admin/faq/new' },
        resolvedLocation: { pathname: '/admin/faq/new', href: '/admin/faq/new' },
      })
    );
    const RootDocument = await importRootDocument();
    render(
      <RootDocument>
        <input defaultValue="Unsaved question" />
      </RootDocument>
    );

    await waitFor(() => {
      expect(screen.getByTestId('app-shell').getAttribute('data-is-navigating')).toBe('false');
    });
    expect(screen.getByDisplayValue('Unsaved question')).toBeTruthy();
  });

  it('reports navigation in progress while keeping the current route visible', async () => {
    await renderPendingRootDocument();

    await waitFor(() => {
      expect(screen.getByTestId('app-shell').getAttribute('data-is-navigating')).toBe('true');
    });
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('renders pending shell content as non-loading during server render to keep hydration stable', async () => {
    mockPendingRoute();

    const RootDocument = await importRootDocument();

    const markup = renderToStaticMarkup(
      <RootDocument>
        <div>content</div>
      </RootDocument>
    );

    expect(markup).toContain('data-is-navigating="false"');
    expect(markup).toContain('data-theme-bootstrap="true"');
  });

  it('keeps the current layout until the destination is ready', async () => {
    await renderPendingRootDocument();

    await waitFor(() => {
      expect(screen.getByTestId('app-shell').getAttribute('data-current-pathname')).toBe(
        '/admin/content'
      );
    });
  });
});
