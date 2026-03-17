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
  adminGroups: vi.fn(async () => undefined),
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
  normalizeIamTab: (tab: unknown) => normalizeIamTabMock(tab),
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

vi.mock('./admin/groups/-groups-page', () => ({
  GroupsPage: () => <div>GroupsPage</div>,
}));

vi.mock('./admin/users/-user-edit-page', () => ({
  UserEditPage: ({ userId }: { userId: string }) => <div>{`UserEditPage:${userId}`}</div>,
}));

vi.mock('./admin/users/-user-list-page', () => ({
  UserListPage: () => <div>UserListPage</div>,
}));

import { coreRouteFactoriesBase, runtimeCoreRouteFactories } from './-core-routes';

type RouteOptionsUnderTest = {
  path?: string;
  beforeLoad?: (options: unknown) => Promise<void> | void;
  validateSearch?: (search: Record<string, unknown>) => unknown;
  component?: () => React.ReactNode;
};

const readRouteOptions = (route: unknown): RouteOptionsUnderTest => {
  return (route as { options: unknown }).options as RouteOptionsUnderTest;
};

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
    return new Map(routes.map((route) => [String(readRouteOptions(route).path), route as unknown]));
  };

  it('configures guarded account and admin routes, including IAM tab normalization', async () => {
    const routes = buildRouteMap();
    const privacyRoute = readRouteOptions(routes.get('/account/privacy'));
    const legalTextsRoute = readRouteOptions(routes.get('/admin/legal-texts'));
    const groupsRoute = readRouteOptions(routes.get('/admin/groups'));
    const iamRoute = readRouteOptions(routes.get('/admin/iam'));
    const modulesRoute = readRouteOptions(routes.get('/modules'));
    const monitoringRoute = readRouteOptions(routes.get('/monitoring'));

    await privacyRoute.beforeLoad?.({ href: '/account/privacy' });
    await legalTextsRoute.beforeLoad?.({ href: '/admin/legal-texts' });
    await groupsRoute.beforeLoad?.({ href: '/admin/groups' });
    await iamRoute.beforeLoad?.({ href: '/admin/iam' });
    await modulesRoute.beforeLoad?.({ href: '/modules' });
    await monitoringRoute.beforeLoad?.({ href: '/monitoring' });

    expect(guardSpies.accountPrivacy).toHaveBeenCalledWith({ href: '/account/privacy' });
    expect(guardSpies.adminRoles).toHaveBeenCalledWith({ href: '/admin/legal-texts' });
    expect(guardSpies.adminGroups).toHaveBeenCalledWith({ href: '/admin/groups' });
    expect(guardSpies.adminIam).toHaveBeenCalledWith({ href: '/admin/iam' });
    expect(guardSpies.adminRoles).toHaveBeenCalledWith({ href: '/modules' });
    expect(guardSpies.adminRoles).toHaveBeenCalledWith({ href: '/monitoring' });

    expect(iamRoute.validateSearch?.({ tab: 'bogus' })).toEqual({
      tab: 'governance',
    });
    expect(normalizeIamTabMock).toHaveBeenCalledWith('bogus');

    render(iamRoute.component?.());
    expect(screen.getByText('IamViewerPage:governance')).toBeTruthy();
  });

  it('renders the new placeholder routes and explicit page components', () => {
    const routes = buildRouteMap();
    const renderPath = (path: string) => {
      const route = readRouteOptions(routes.get(path));
      cleanup();
      render(route.component?.());
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

    renderPath('/admin/groups');
    expect(screen.getByText('GroupsPage')).toBeTruthy();
  });

  it('keeps the user detail route param wiring and exports the composed factory list', () => {
    const routes = buildRouteMap();
    const userDetailRoute = readRouteOptions(routes.get('/admin/users/$userId'));

    render(userDetailRoute.component?.());

    expect(screen.getByText('UserEditPage:user-1')).toBeTruthy();
    expect(coreRouteFactoriesBase).toHaveLength(runtimeCoreRouteFactories.length + 1);
    expect(createRouteMock).toHaveBeenCalled();
  });
});
