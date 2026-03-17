import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const guardSpies = vi.hoisted(() => ({
  account: vi.fn(async () => undefined),
  accountPrivacy: vi.fn(async () => undefined),
  adminUsers: vi.fn(async () => undefined),
  adminUserDetail: vi.fn(async () => undefined),
  adminOrganizations: vi.fn(async () => undefined),
  adminRoles: vi.fn(async () => undefined),
  adminIam: vi.fn(async () => undefined),
}));

const normalizeIamTabMock = vi.hoisted(() => vi.fn((tab: unknown) => (tab === 'dsr' ? 'dsr' : 'governance')));

const createRouteMock = vi.hoisted(() =>
  vi.fn((options: Record<string, unknown>) => {
    const route = {
      options,
      addChildren(children: unknown[]) {
        return { ...route, children };
      },
      useLoaderData: () => ['Rise Above'],
      useParams: () => ({ userId: 'user-1' }),
      useSearch: () => ({ tab: 'governance' }),
    };
    return route;
  })
);

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet" />,
  createRoute: createRouteMock,
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator() {
      return this;
    },
    handler<T>(handler: T) {
      return handler;
    },
  }),
  useServerFn: (handler: unknown) => handler,
}));

vi.mock('@sva/routing', () => ({
  accountUiRouteGuards: guardSpies,
}));

vi.mock('../i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('./-home-page', () => ({
  HomePage: () => <div>HomePage</div>,
}));

vi.mock('./-placeholder-page', () => ({
  PlaceholderPage: ({ section, title }: { section: string; title: string }) => (
    <div>{`placeholder:${section}:${title}`}</div>
  ),
}));

vi.mock('./interfaces/-interfaces-page', () => ({
  InterfacesPage: () => <div>InterfacesPage</div>,
}));

vi.mock('./account/-account-profile-page', () => ({
  AccountProfilePage: () => <div>AccountProfilePage</div>,
}));

vi.mock('./account/-account-privacy-page', () => ({
  AccountPrivacyPage: () => <div>AccountPrivacyPage</div>,
}));

vi.mock('./admin/api/-phase1-test-page', () => ({
  Phase1TestPage: () => <div>Phase1TestPage</div>,
}));

vi.mock('./admin/-iam-page', () => ({
  IamViewerPage: ({ activeTab }: { activeTab: string }) => <div>{`IamViewerPage:${activeTab}`}</div>,
}));

vi.mock('./admin/-iam.models', () => ({
  normalizeIamTab: (...args: unknown[]) => normalizeIamTabMock(...args),
}));

vi.mock('./admin/legal-texts/-legal-texts-page', () => ({
  LegalTextsPage: () => <div>LegalTextsPage</div>,
}));

vi.mock('./admin/organizations/-organizations-page', () => ({
  OrganizationsPage: () => <div>OrganizationsPage</div>,
}));

vi.mock('./admin/roles/-roles-page', () => ({
  RolesPage: () => <div>RolesPage</div>,
}));

vi.mock('./admin/users/-user-edit-page', () => ({
  UserEditPage: ({ userId }: { userId: string }) => <div>{`UserEditPage:${userId}`}</div>,
}));

vi.mock('./admin/users/-user-list-page', () => ({
  UserListPage: () => <div>UserListPage</div>,
}));

import { coreRouteFactoriesBase, runtimeCoreRouteFactories } from './-core-routes';

describe('core routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    normalizeIamTabMock.mockImplementation((tab: unknown) => (tab === 'dsr' ? 'dsr' : 'governance'));
  });

  afterEach(() => {
    cleanup();
  });

  const buildRouteMap = () => {
    const rootRoute = { id: 'root' } as never;
    const routes = runtimeCoreRouteFactories.map((factory) => factory(rootRoute));
    return new Map(routes.map((route) => [String((route as { options: { path?: string } }).options.path), route]));
  };

  it('configures guarded account and admin routes, including IAM tab normalization', async () => {
    const routes = buildRouteMap();
    const privacyRoute = routes.get('/account/privacy') as { options: Record<string, unknown> };
    const legalTextsRoute = routes.get('/admin/legal-texts') as { options: Record<string, unknown> };
    const iamRoute = routes.get('/admin/iam') as { options: Record<string, unknown> };
    const modulesRoute = routes.get('/modules') as { options: Record<string, unknown> };
    const monitoringRoute = routes.get('/monitoring') as { options: Record<string, unknown> };

    await (privacyRoute.options.beforeLoad as (options: unknown) => Promise<void>)({ href: '/account/privacy' });
    await (legalTextsRoute.options.beforeLoad as (options: unknown) => Promise<void>)({ href: '/admin/legal-texts' });
    await (iamRoute.options.beforeLoad as (options: unknown) => Promise<void>)({ href: '/admin/iam' });
    await (modulesRoute.options.beforeLoad as (options: unknown) => Promise<void>)({ href: '/modules' });
    await (monitoringRoute.options.beforeLoad as (options: unknown) => Promise<void>)({ href: '/monitoring' });

    expect(guardSpies.accountPrivacy).toHaveBeenCalledWith({ href: '/account/privacy' });
    expect(guardSpies.adminRoles).toHaveBeenCalledWith({ href: '/admin/legal-texts' });
    expect(guardSpies.adminIam).toHaveBeenCalledWith({ href: '/admin/iam' });
    expect(guardSpies.adminRoles).toHaveBeenCalledWith({ href: '/modules' });
    expect(guardSpies.adminRoles).toHaveBeenCalledWith({ href: '/monitoring' });

    expect((iamRoute.options.validateSearch as (search: Record<string, unknown>) => unknown)({ tab: 'bogus' })).toEqual({
      tab: 'governance',
    });
    expect(normalizeIamTabMock).toHaveBeenCalledWith('bogus');

    render((iamRoute.options.component as () => React.ReactNode)());
    expect(screen.getByText('IamViewerPage:governance')).toBeTruthy();
  });

  it('renders the new placeholder routes and explicit page components', () => {
    const routes = buildRouteMap();
    const renderPath = (path: string) => {
      const route = routes.get(path) as { options: Record<string, unknown> };
      cleanup();
      render((route.options.component as () => React.ReactNode)());
    };

    renderPath('/content');
    expect(screen.getByText('placeholder:shell.sidebar.sections.dataManagement:shell.sidebar.content')).toBeTruthy();

    renderPath('/media');
    expect(screen.getByText('placeholder:shell.sidebar.sections.dataManagement:shell.sidebar.media')).toBeTruthy();

    renderPath('/categories');
    expect(screen.getByText('placeholder:shell.sidebar.sections.dataManagement:shell.sidebar.categories')).toBeTruthy();

    renderPath('/app');
    expect(screen.getByText('placeholder:shell.sidebar.sections.applications:shell.sidebar.app')).toBeTruthy();

    renderPath('/help');
    expect(screen.getByText('placeholder:shell.sidebar.help:shell.sidebar.help')).toBeTruthy();

    renderPath('/support');
    expect(screen.getByText('placeholder:shell.sidebar.support:shell.sidebar.support')).toBeTruthy();

    renderPath('/license');
    expect(screen.getByText('placeholder:shell.sidebar.license:shell.sidebar.license')).toBeTruthy();

    renderPath('/account/privacy');
    expect(screen.getByText('AccountPrivacyPage')).toBeTruthy();

    renderPath('/admin/legal-texts');
    expect(screen.getByText('LegalTextsPage')).toBeTruthy();
  });

  it('keeps the user detail route param wiring and exports the composed factory list', () => {
    const routes = buildRouteMap();
    const userDetailRoute = routes.get('/admin/users/$userId') as { options: Record<string, unknown> };

    render((userDetailRoute.options.component as () => React.ReactNode)());

    expect(screen.getByText('UserEditPage:user-1')).toBeTruthy();
    expect(coreRouteFactoriesBase).toHaveLength(runtimeCoreRouteFactories.length + 1);
    expect(createRouteMock).toHaveBeenCalled();
  });
});
