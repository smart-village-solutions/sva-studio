import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRootHead,
  loadDocumentSession,
  loadRootData,
  resolveServerFallowBrowserBeaconKey,
  resolveServerStudioBranding,
  resolveServerStudioParentDomain,
  RootDocument,
} from './__root';

const useRouterStateMock = vi.fn();
const useMatchesMock = vi.fn();
const activeLocaleMock = vi.hoisted(() => ({ value: 'de' }));

const documentSessionMocks = vi.hoisted(() => ({
  getRequest: vi.fn<() => Request>(),
  setResponseHeader: vi.fn(),
  dispatchAuthRouteRequest: vi.fn(),
  loadStudioReleaseNotes: vi.fn(),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: documentSessionMocks.getRequest,
  setResponseHeader: documentSessionMocks.setResponseHeader,
}));

vi.mock('@sva/routing/server', () => ({
  dispatchAuthRouteRequest: documentSessionMocks.dispatchAuthRouteRequest,
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

  const renderPendingRootDocument = () => {
    mockPendingRoute();
    render(
      <RootDocument>
        <div>content</div>
      </RootDocument>
    );
  };

  it('publishes the safe server runtime configuration in metadata', () => {
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

  it('exposes the ingest-only browser key exclusively on staging', () => {
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
    const request = (path: string, headers?: HeadersInit) =>
      ({ url: `https://studio.test${path}`, headers: new Headers(headers) }) as Request;
    const cookie = { cookie: 'session=test' };

    documentSessionMocks.getRequest.mockReturnValue(request('/'));
    documentSessionMocks.dispatchAuthRouteRequest.mockClear();
    documentSessionMocks.loadStudioReleaseNotes.mockClear();
    await expect(loadDocumentSession()).resolves.toEqual({});
    expect(documentSessionMocks.dispatchAuthRouteRequest).not.toHaveBeenCalled();
    expect(documentSessionMocks.setResponseHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store'
    );

    documentSessionMocks.getRequest.mockReturnValue(request('/changelog', cookie));
    documentSessionMocks.dispatchAuthRouteRequest.mockResolvedValueOnce(
      new Response(null, { status: 401 })
    );
    await expect(loadDocumentSession()).resolves.toEqual({});
    expect(documentSessionMocks.loadStudioReleaseNotes).not.toHaveBeenCalled();

    const user = { id: 'user-1', instanceId: 'tenant-1', roles: ['editor'], assignedModules: ['media'] };
    const permission = { action: 'media.read', resourceType: 'media' };
    const subject = { actorUserId: user.id, effectiveUserId: user.id, isImpersonating: false };
    const permissions = { instanceId: user.instanceId, organizationId: 'org-1', permissions: [permission], subject };
    documentSessionMocks.dispatchAuthRouteRequest.mockImplementation(async (request: Request) => {
      const url = new URL(request.url);
      if (url.pathname === '/auth/me') return Response.json({ user: { ...user, email: 'private@example.test' } });
      if (url.pathname === '/api/v1/iam/me/context') return Response.json({ data: { activeOrganizationId: 'org-1' } });
      expect(url.searchParams.get('organizationId')).toBe('org-1');
      expect(request.headers.has('authorization')).toBe(false);
      return Response.json(permissions);
    });
    const navigation = { user: { ...user, instanceDisplayName: undefined }, organizationId: 'org-1', permissions: [permission] };
    documentSessionMocks.getRequest.mockReturnValue(request('/', { ...cookie, authorization: 'Bearer ignored' }));
    await expect(loadDocumentSession()).resolves.toEqual({ initiallyAuthenticated: true, navigation });
    expect(documentSessionMocks.loadStudioReleaseNotes).not.toHaveBeenCalled();

    documentSessionMocks.dispatchAuthRouteRequest
      .mockResolvedValueOnce(Response.json({ user }))
      .mockResolvedValueOnce(Response.json({ data: { activeOrganizationId: 'org-1' } }))
      .mockResolvedValueOnce(Response.json({ ...permissions, organizationId: 'org-2' }));
    await expect(loadDocumentSession()).resolves.toEqual({ initiallyAuthenticated: true });

    documentSessionMocks.dispatchAuthRouteRequest
      .mockResolvedValueOnce(Response.json({ user }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(loadDocumentSession()).resolves.toEqual({ initiallyAuthenticated: true });

    const platformUser = { id: 'platform-user', roles: ['instance_registry_admin'] };
    documentSessionMocks.dispatchAuthRouteRequest.mockResolvedValueOnce(
      Response.json({ user: platformUser })
    );
    await expect(loadDocumentSession()).resolves.toEqual({
      initiallyAuthenticated: true,
      navigation: { user: platformUser, organizationId: null, permissions: [] },
    });

    documentSessionMocks.getRequest.mockReturnValue(request('/changelog/', cookie));
    documentSessionMocks.loadStudioReleaseNotes.mockResolvedValueOnce([]);
    await expect(loadDocumentSession()).resolves.toEqual({
      initiallyAuthenticated: true,
      navigation,
      changelogReleases: [],
    });

    documentSessionMocks.loadStudioReleaseNotes.mockRejectedValueOnce(new Error('offline'));
    await expect(loadDocumentSession()).resolves.toEqual({ initiallyAuthenticated: true, navigation });
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

  it('returns stable root head metadata', () => {
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

  it('uses the server-selected app name in root metadata', () => {
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

  it('publishes the server-resolved plugin route scope for hydration', () => {
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

  it('focuses the main content without changing the scroll position on page load', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      render(
        <RootDocument>
          <main id="main-content" tabIndex={-1} />
        </RootDocument>
      );
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(document.activeElement).toBe(document.getElementById('main-content'));
    } finally {
      focus.mockRestore();
    }
  });

  it('updates the document title for the unified content route', async () => {
    useRouterStateMock.mockImplementation(({ select }) =>
      select({
        status: 'idle',
        isLoading: false,
        location: { pathname: '/admin/content' },
      })
    );

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
    renderPendingRootDocument();

    await waitFor(() => {
      expect(screen.getByTestId('app-shell').getAttribute('data-is-navigating')).toBe('true');
    });
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('renders pending shell content as non-loading during server render to keep hydration stable', () => {
    mockPendingRoute();

    const markup = renderToStaticMarkup(
      <RootDocument>
        <div>content</div>
      </RootDocument>
    );

    expect(markup).toContain('data-is-navigating="false"');
    expect(markup).toContain('data-theme-bootstrap="true"');
  });

  it('keeps the current layout until the destination is ready', async () => {
    renderPendingRootDocument();

    await waitFor(() => {
      expect(screen.getByTestId('app-shell').getAttribute('data-current-pathname')).toBe(
        '/admin/content'
      );
    });
  });
});
