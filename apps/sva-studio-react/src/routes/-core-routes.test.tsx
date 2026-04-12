import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const guardSpies = vi.hoisted(() => ({
  account: vi.fn(async () => undefined),
  accountPrivacy: vi.fn(async () => undefined),
  content: vi.fn(async () => undefined),
  contentCreate: vi.fn(async () => undefined),
  contentDetail: vi.fn(async () => undefined),
  adminUsers: vi.fn(async () => undefined),
  adminUserCreate: vi.fn(async () => undefined),
  adminUserDetail: vi.fn(async () => undefined),
  adminOrganizations: vi.fn(async () => undefined),
  adminOrganizationCreate: vi.fn(async () => undefined),
  adminOrganizationDetail: vi.fn(async () => undefined),
  adminInstances: vi.fn(async () => undefined),
  adminRoles: vi.fn(async () => undefined),
  adminGroups: vi.fn(async () => undefined),
  adminGroupCreate: vi.fn(async () => undefined),
  adminGroupDetail: vi.fn(async () => undefined),
  adminLegalTexts: vi.fn(async () => undefined),
  adminLegalTextCreate: vi.fn(async () => undefined),
  adminLegalTextDetail: vi.fn(async () => undefined),
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
      useParams: () => ({
        userId: 'user-1',
        contentId: 'content-1',
        instanceId: 'instance-1',
        organizationId: 'organization-1',
        groupId: 'group-1',
        legalTextVersionId: 'legal-text-1',
      }),
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
  useNavigate: () => vi.fn(),
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

vi.mock('./admin/legal-texts/-legal-text-create-page', () => ({
  LegalTextCreatePage: () => <div>LegalTextCreatePage</div>,
}));

vi.mock('./admin/legal-texts/-legal-text-detail-page', () => ({
  LegalTextDetailPage: ({ legalTextVersionId }: { legalTextVersionId: string }) => (
    <div>{`LegalTextDetailPage:${legalTextVersionId}`}</div>
  ),
}));

vi.mock('./admin/groups/-groups-page', () => ({
  GroupsPage: () => <div>GroupsPage</div>,
}));

vi.mock('./admin/groups/-group-create-page', () => ({
  GroupCreatePage: () => <div>GroupCreatePage</div>,
}));

vi.mock('./admin/groups/-group-detail-page', () => ({
  GroupDetailPage: ({ groupId }: { groupId: string }) => <div>{`GroupDetailPage:${groupId}`}</div>,
}));

vi.mock('./admin/organizations/-organizations-page', () => ({
  OrganizationsPage: () => <div>OrganizationsPage</div>,
}));

vi.mock('./admin/organizations/-organization-create-page', () => ({
  OrganizationCreatePage: () => <div>OrganizationCreatePage</div>,
}));

vi.mock('./admin/organizations/-organization-detail-page', () => ({
  OrganizationDetailPage: ({ organizationId }: { organizationId: string }) => (
    <div>{`OrganizationDetailPage:${organizationId}`}</div>
  ),
}));

vi.mock('./admin/instances/-instances-page', () => ({
  InstancesPage: () => <div>InstancesPage</div>,
}));

vi.mock('./admin/instances/-instance-create-page', () => ({
  InstanceCreatePage: () => <div>InstanceCreatePage</div>,
}));

vi.mock('./admin/instances/-instance-detail-page', () => ({
  InstanceDetailPage: ({ instanceId }: { instanceId: string }) => <div>{`InstanceDetailPage:${instanceId}`}</div>,
}));

vi.mock('./admin/roles/-roles-page', () => ({
  RolesPage: () => <div>RolesPage</div>,
}));

vi.mock('./admin/roles/-role-create-page', () => ({
  RoleCreatePage: () => <div>RoleCreatePage</div>,
}));

vi.mock('./admin/users/-user-edit-page', () => ({
  UserEditPage: ({ userId }: { userId: string }) => <div>{`UserEditPage:${userId}`}</div>,
}));

vi.mock('./admin/users/-user-create-page', () => ({
  UserCreatePage: () => <div>UserCreatePage</div>,
}));

vi.mock('./admin/users/-user-list-page', () => ({
  UserListPage: () => <div>UserListPage</div>,
}));

vi.mock('./content/-content-list-page', () => ({
  ContentListPage: () => <div>ContentListPage</div>,
}));

vi.mock('./content/-content-editor-page', () => ({
  ContentEditorPage: ({ mode, contentId }: { mode: string; contentId?: string }) => (
    <div>{`ContentEditorPage:${mode}:${contentId ?? 'new'}`}</div>
  ),
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
    const contentRoute = readRouteOptions(routes.get('/content'));
    const contentCreateRoute = readRouteOptions(routes.get('/content/new'));
    const contentDetailRoute = readRouteOptions(routes.get('/content/$contentId'));
    const groupsRoute = readRouteOptions(routes.get('/admin/groups'));
    const groupCreateRoute = readRouteOptions(routes.get('/admin/groups/new'));
    const groupDetailRoute = readRouteOptions(routes.get('/admin/groups/$groupId'));
    const usersCreateRoute = readRouteOptions(routes.get('/admin/users/new'));
    const organizationCreateRoute = readRouteOptions(routes.get('/admin/organizations/new'));
    const organizationDetailRoute = readRouteOptions(routes.get('/admin/organizations/$organizationId'));
    const instancesRoute = readRouteOptions(routes.get('/admin/instances'));
    const instanceCreateRoute = readRouteOptions(routes.get('/admin/instances/new'));
    const instanceDetailRoute = readRouteOptions(routes.get('/admin/instances/$instanceId'));
    const roleCreateRoute = readRouteOptions(routes.get('/admin/roles/new'));
    const legalTextsRoute = readRouteOptions(routes.get('/admin/legal-texts'));
    const legalTextCreateRoute = readRouteOptions(routes.get('/admin/legal-texts/new'));
    const legalTextDetailRoute = readRouteOptions(routes.get('/admin/legal-texts/$legalTextVersionId'));
    const iamRoute = readRouteOptions(routes.get('/admin/iam'));
    const modulesRoute = readRouteOptions(routes.get('/modules'));
    const monitoringRoute = readRouteOptions(routes.get('/monitoring'));

    await privacyRoute.beforeLoad?.({ href: '/account/privacy' });
    await contentRoute.beforeLoad?.({ href: '/content' });
    await contentCreateRoute.beforeLoad?.({ href: '/content/new' });
    await contentDetailRoute.beforeLoad?.({ href: '/content/content-1' });
    await groupsRoute.beforeLoad?.({ href: '/admin/groups' });
    await groupCreateRoute.beforeLoad?.({ href: '/admin/groups/new' });
    await groupDetailRoute.beforeLoad?.({ href: '/admin/groups/group-1' });
    await usersCreateRoute.beforeLoad?.({ href: '/admin/users/new' });
    await organizationCreateRoute.beforeLoad?.({ href: '/admin/organizations/new' });
    await organizationDetailRoute.beforeLoad?.({ href: '/admin/organizations/organization-1' });
    await instancesRoute.beforeLoad?.({ href: '/admin/instances' });
    await instanceCreateRoute.beforeLoad?.({ href: '/admin/instances/new' });
    await instanceDetailRoute.beforeLoad?.({ href: '/admin/instances/instance-1' });
    await roleCreateRoute.beforeLoad?.({ href: '/admin/roles/new' });
    await legalTextsRoute.beforeLoad?.({ href: '/admin/legal-texts' });
    await legalTextCreateRoute.beforeLoad?.({ href: '/admin/legal-texts/new' });
    await legalTextDetailRoute.beforeLoad?.({ href: '/admin/legal-texts/legal-text-1' });
    await iamRoute.beforeLoad?.({ href: '/admin/iam' });
    await modulesRoute.beforeLoad?.({ href: '/modules' });
    await monitoringRoute.beforeLoad?.({ href: '/monitoring' });

    expect(guardSpies.accountPrivacy).toHaveBeenCalledWith({ href: '/account/privacy' });
    expect(guardSpies.content).toHaveBeenCalledWith({ href: '/content' });
    expect(guardSpies.contentCreate).toHaveBeenCalledWith({ href: '/content/new' });
    expect(guardSpies.contentDetail).toHaveBeenCalledWith({ href: '/content/content-1' });
    expect(guardSpies.adminGroups).toHaveBeenCalledWith({ href: '/admin/groups' });
    expect(guardSpies.adminGroupCreate).toHaveBeenCalledWith({ href: '/admin/groups/new' });
    expect(guardSpies.adminGroupDetail).toHaveBeenCalledWith({ href: '/admin/groups/group-1' });
    expect(guardSpies.adminUserCreate).toHaveBeenCalledWith({ href: '/admin/users/new' });
    expect(guardSpies.adminOrganizationCreate).toHaveBeenCalledWith({ href: '/admin/organizations/new' });
    expect(guardSpies.adminOrganizationDetail).toHaveBeenCalledWith({ href: '/admin/organizations/organization-1' });
    expect(guardSpies.adminInstances).toHaveBeenCalledWith({ href: '/admin/instances' });
    expect(guardSpies.adminInstances).toHaveBeenCalledWith({ href: '/admin/instances/new' });
    expect(guardSpies.adminInstances).toHaveBeenCalledWith({ href: '/admin/instances/instance-1' });
    expect(guardSpies.adminRoles).toHaveBeenCalledWith({ href: '/admin/roles/new' });
    expect(guardSpies.adminLegalTexts).toHaveBeenCalledWith({ href: '/admin/legal-texts' });
    expect(guardSpies.adminLegalTextCreate).toHaveBeenCalledWith({ href: '/admin/legal-texts/new' });
    expect(guardSpies.adminLegalTextDetail).toHaveBeenCalledWith({ href: '/admin/legal-texts/legal-text-1' });
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

  it('renders the new placeholder routes and explicit page components', async () => {
    const routes = buildRouteMap();
    const renderPath = (path: string) => {
      const route = readRouteOptions(routes.get(path));
      cleanup();
      render(route.component?.());
    };

    renderPath('/content');
    expect(screen.getByText('ContentListPage')).toBeTruthy();

    renderPath('/content/new');
    expect(screen.getByText('ContentEditorPage:create:new')).toBeTruthy();

    renderPath('/content/$contentId');
    expect(screen.getByText('ContentEditorPage:edit:content-1')).toBeTruthy();

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

    renderPath('/admin/groups');
    expect(await screen.findByText('GroupsPage')).toBeTruthy();

    renderPath('/admin/groups/new');
    expect(screen.getByText('GroupCreatePage')).toBeTruthy();

    renderPath('/admin/groups/$groupId');
    expect(await screen.findByText('GroupDetailPage:group-1')).toBeTruthy();

    renderPath('/admin/users/new');
    expect(screen.getByText('UserCreatePage')).toBeTruthy();

    renderPath('/admin/organizations/new');
    expect(screen.getByText('OrganizationCreatePage')).toBeTruthy();

    renderPath('/admin/organizations/$organizationId');
    expect(await screen.findByText('OrganizationDetailPage:organization-1')).toBeTruthy();

    renderPath('/admin/instances');
    expect(screen.getByText('InstancesPage')).toBeTruthy();

    renderPath('/admin/roles/new');
    expect(screen.getByText('RoleCreatePage')).toBeTruthy();

    renderPath('/admin/instances/new');
    expect(screen.getByText('InstanceCreatePage')).toBeTruthy();

    renderPath('/admin/instances/$instanceId');
    expect(screen.getByText('InstanceDetailPage:instance-1')).toBeTruthy();

    renderPath('/admin/legal-texts');
    expect(screen.getByText('LegalTextsPage')).toBeTruthy();

    renderPath('/admin/legal-texts/new');
    expect(screen.getByText('LegalTextCreatePage')).toBeTruthy();

    renderPath('/admin/legal-texts/$legalTextVersionId');
    expect(screen.getByText('LegalTextDetailPage:legal-text-1')).toBeTruthy();
  });

  it('keeps the user detail route param wiring and exports the composed factory list', async () => {
    const routes = buildRouteMap();
    const userDetailRoute = readRouteOptions(routes.get('/admin/users/$userId'));

    render(userDetailRoute.component?.());

    expect(await screen.findByText('UserEditPage:user-1')).toBeTruthy();
    expect(coreRouteFactoriesBase).toHaveLength(runtimeCoreRouteFactories.length + 1);
    expect(createRouteMock).toHaveBeenCalled();
  });
});
