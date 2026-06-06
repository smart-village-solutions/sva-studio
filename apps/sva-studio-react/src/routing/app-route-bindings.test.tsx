import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeState = vi.hoisted(() => ({
  params: {} as Record<string, unknown>,
  search: {} as Record<string, unknown>,
  normalizeIamTab: vi.fn((tab: unknown) => `iam:${String(tab ?? '')}`),
  normalizeRoleDetailTab: vi.fn((tab: unknown) => `role:${String(tab ?? '')}`),
  authUser: null as null | { id: string; displayName?: string; name?: string },
  organizationContext: {
    activeOrganizationId: undefined as string | undefined,
    organizations: [] as Array<{ organizationId: string; displayName: string; isActive: boolean }>,
  },
  getOrganization: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => routeState.params,
  useSearch: () => routeState.search,
  useLocation: () => ({ pathname: '/admin/media' }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children?: unknown }) => <>{children}</>,
}));

vi.mock('@sva/routing', () => ({
  normalizeIamTab: routeState.normalizeIamTab,
  normalizeRoleDetailTab: routeState.normalizeRoleDetailTab,
}));

vi.mock('../i18n', () => ({
  t: (key: string) =>
    (
      {
        'interfaces.messages.loading': 'Interfaces loading fallback',
        'shell.sidebar.sections.dataManagement': 'Data management',
        'shell.sidebar.media': 'Media',
        'shell.sidebar.categories': 'Categories',
        'shell.sidebar.sections.applications': 'Applications',
        'shell.sidebar.app': 'App',
        'shell.sidebar.sections.system': 'System',
        'shell.sidebar.modules': 'Modules',
        'shell.sidebar.monitoring': 'Monitoring',
        'monitoring.page.title': 'Monitoring',
        'monitoring.jobs.page.title': 'Monitoring Jobs',
        'monitoring.jobs.detail.title': 'Job Details',
        'shell.sidebar.help': 'Help',
        'shell.sidebar.support': 'Support',
        'shell.sidebar.license': 'License',
      } as Record<string, string>
    )[key] ?? key,
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => ({
    isAuthenticated: Boolean(routeState.authUser),
    user: routeState.authUser,
  }),
}));

vi.mock('../hooks/use-organization-context', () => ({
  useOrganizationContext: () => ({
    context: routeState.organizationContext,
  }),
}));

vi.mock('../lib/iam-api', async () => {
  const actual = await vi.importActual<typeof import('../lib/iam-api')>('../lib/iam-api');
  return {
    ...actual,
    getOrganization: (...args: unknown[]) => routeState.getOrganization(...args),
  };
});

vi.mock('../routes/account/-account-profile-page', () => ({
  AccountProfilePage: () => <div data-testid="account-profile-page" />,
}));

vi.mock('../routes/account/-account-privacy-page', () => ({
  AccountPrivacyPage: () => <div data-testid="account-privacy-page" />,
}));

vi.mock('../routes/account/-account-privacy-detail-page', () => ({
  AccountPrivacyDetailPage: ({ caseId }: { caseId: string }) => (
    <div data-testid="account-privacy-detail-page">{caseId}</div>
  ),
}));

vi.mock('../routes/account/-account-rules-page', () => ({
  AccountRulesPage: () => <div data-testid="account-rules-page" />,
}));

vi.mock('../routes/admin/api/-phase1-test-page', () => ({
  Phase1TestPage: () => <div data-testid="phase1-test-page" />,
}));

vi.mock('../routes/admin/-iam-page', () => ({
  IamViewerPage: ({ activeTab }: { activeTab: string }) => (
    <div data-testid="iam-viewer-page">{activeTab}</div>
  ),
}));

vi.mock('../routes/admin/-iam-governance-detail-page', () => ({
  IamGovernanceDetailPage: ({ caseId }: { caseId: string }) => (
    <div data-testid="iam-governance-detail-page">{caseId}</div>
  ),
}));

vi.mock('../routes/admin/-iam-dsr-detail-page', () => ({
  IamDsrDetailPage: ({ caseId }: { caseId: string }) => (
    <div data-testid="iam-dsr-detail-page">{caseId}</div>
  ),
}));

vi.mock('../routes/admin/groups/-group-create-page', () => ({
  GroupCreatePage: () => <div data-testid="group-create-page" />,
}));

vi.mock('../routes/admin/groups/-groups-page', () => ({
  GroupsPage: () => <div data-testid="groups-page" />,
}));

vi.mock('../routes/admin/groups/-group-detail-page', () => ({
  GroupDetailPage: ({ groupId }: { groupId: string }) => <div data-testid="group-detail-page">{groupId}</div>,
}));

vi.mock('../routes/admin/instances/-instance-create-page', () => ({
  InstanceCreatePage: () => <div data-testid="instance-create-page" />,
}));

vi.mock('../routes/admin/instances/-instance-setup-page', () => ({
  InstanceSetupPage: ({ instanceId }: { instanceId: string }) => (
    <div data-testid="instance-setup-page">{instanceId}</div>
  ),
}));

vi.mock('../routes/admin/instances/-instance-detail-page', () => ({
  InstanceDetailPage: ({ instanceId }: { instanceId: string }) => (
    <div data-testid="instance-detail-page">{instanceId}</div>
  ),
}));

vi.mock('../routes/admin/instances/-instances-page', () => ({
  InstancesPage: () => <div data-testid="instances-page" />,
}));

vi.mock('../routes/admin/legal-texts/-legal-text-create-page', () => ({
  LegalTextCreatePage: () => <div data-testid="legal-text-create-page" />,
}));

vi.mock('../routes/admin/legal-texts/-legal-text-detail-page', () => ({
  LegalTextDetailPage: ({ legalTextVersionId }: { legalTextVersionId: string }) => (
    <div data-testid="legal-text-detail-page">{legalTextVersionId}</div>
  ),
}));

vi.mock('../routes/admin/legal-texts/-legal-texts-page', () => ({
  LegalTextsPage: () => <div data-testid="legal-texts-page" />,
}));

vi.mock('../routes/admin/modules/-modules-page', () => ({
  ModulesPage: () => <div data-testid="modules-page">modules</div>,
}));

vi.mock('../routes/admin/media/-media-page', () => ({
  MediaPage: () => <div data-testid="media-page" />,
}));

vi.mock('../routes/admin/media/-media-usage-page', () => ({
  MediaUsagePage: () => <div data-testid="media-usage-page" />,
}));

vi.mock('../routes/admin/organizations/-organization-create-page', () => ({
  OrganizationCreatePage: () => <div data-testid="organization-create-page" />,
}));

vi.mock('../routes/admin/organizations/-organizations-page', () => ({
  OrganizationsPage: () => <div data-testid="organizations-page" />,
}));

vi.mock('../routes/admin/organizations/-organization-detail-page', () => ({
  OrganizationDetailPage: ({ organizationId }: { organizationId: string }) => (
    <div data-testid="organization-detail-page">{organizationId}</div>
  ),
}));

vi.mock('../routes/admin/roles/-role-create-page', () => ({
  RoleCreatePage: () => <div data-testid="role-create-page" />,
}));

vi.mock('../routes/admin/roles/-roles-page', () => ({
  RolesPage: () => <div data-testid="roles-page" />,
}));

vi.mock('../routes/admin/roles/-role-detail-page', () => ({
  RoleDetailPage: ({ roleId, activeTab }: { roleId: string; activeTab: string }) => (
    <div data-testid="role-detail-page">{`${roleId}:${activeTab}`}</div>
  ),
}));

vi.mock('../routes/admin/users/-user-create-page', () => ({
  UserCreatePage: () => <div data-testid="user-create-page" />,
}));

vi.mock('../routes/admin/users/-user-list-page', () => ({
  UserListPage: () => <div data-testid="user-list-page" />,
}));

vi.mock('../routes/admin/users/-user-edit-page', () => ({
  UserEditPage: ({ userId }: { userId: string }) => <div data-testid="user-edit-page">{userId}</div>,
}));

vi.mock('../routes/content/-content-editor-page', () => ({
  ContentEditorPage: ({ mode, contentId, activeTab }: { mode: string; contentId?: string; activeTab?: string }) => (
    <div data-testid="content-editor-page">{`${mode}:${contentId ?? ''}:${activeTab ?? ''}`}</div>
  ),
  normalizeContentEditorTab: (tab: unknown) => (typeof tab === 'string' && (tab === 'general' || tab === 'history') ? tab : 'general'),
}));

vi.mock('../routes/content/-content-list-page', () => ({
  ContentListPage: () => <div data-testid="content-list-page" />,
}));

vi.mock('../routes/content/-content-type-picker-page', () => ({
  ContentTypePickerPage: () => <div data-testid="content-type-picker-page" />,
}));

vi.mock('../routes/-home-page', () => ({
  HomePage: () => <div data-testid="home-page" />,
}));

vi.mock('../routes/-placeholder-page', () => ({
  PlaceholderPage: ({ section, title }: { section: string; title: string }) => (
    <div data-testid="placeholder-page">{`${section}|${title}`}</div>
  ),
}));

vi.mock('../routes/interfaces/-interfaces-page', () => ({
  InterfacesPage: () => <div data-testid="interfaces-page" />,
}));

vi.mock('../routes/monitoring/-jobs-page', () => ({
  MonitoringJobsPage: () => <div data-testid="monitoring-jobs-page" />,
}));

vi.mock('../routes/monitoring/-overview-page', () => ({
  MonitoringOverviewPage: () => <div data-testid="monitoring-overview-page" />,
}));

vi.mock('../routes/monitoring/-job-detail-page', () => ({
  MonitoringJobDetailPage: ({ jobId }: { jobId: string }) => <div data-testid="monitoring-job-detail-page">{jobId}</div>,
}));

vi.mock('@sva/plugin-news', () => ({
  NewsCreatePage: ({ initialAuthor }: { initialAuthor?: string }) => (
    <div data-testid="news-create-page">{initialAuthor ?? ''}</div>
  ),
  NewsEditPage: () => <div data-testid="news-edit-page" />,
}));

vi.mock('@sva/plugin-events/events.pages', () => ({
  EventsCreatePage: () => <div data-testid="events-create-page" />,
  EventsEditPage: () => <div data-testid="events-edit-page" />,
}));

vi.mock('@sva/plugin-poi/poi.pages', () => ({
  PoiCreatePage: () => <div data-testid="poi-create-page" />,
  PoiEditPage: () => <div data-testid="poi-edit-page" />,
}));

describe('appRouteBindings', () => {
  beforeEach(() => {
    routeState.params = {};
    routeState.search = {};
    routeState.normalizeIamTab.mockClear();
    routeState.normalizeRoleDetailTab.mockClear();
    routeState.authUser = null;
    routeState.organizationContext = {
      activeOrganizationId: undefined,
      organizations: [],
    };
    routeState.getOrganization.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all placeholder bindings with translated section and title metadata', async () => {
    const { appRouteBindings } = await import('./app-route-bindings');

    const cases: Array<[keyof typeof appRouteBindings, string]> = [
      ['categories', 'Data management|Categories'],
      ['app', 'Applications|App'],
      ['help', 'Help|Help'],
      ['support', 'Support|Support'],
      ['license', 'License|License'],
    ];

    for (const [bindingKey, expectedText] of cases) {
      const Binding = appRouteBindings[bindingKey];
      render(<Binding />);
      expect(screen.getByTestId('placeholder-page').textContent).toBe(expectedText);
      cleanup();
    }
  });

  it('renders the concrete modules binding instead of the system placeholder', async () => {
    const { appRouteBindings } = await import('./app-route-bindings');

    render(<appRouteBindings.modules />);

    expect(screen.getByTestId('modules-page').textContent).toBe('modules');
  });

  it('passes organization-based author defaults into the news create page when memberships require org authorship', async () => {
    routeState.authUser = {
      id: 'user-1',
      displayName: 'Philipp Wilimzig',
    };
    routeState.organizationContext = {
      activeOrganizationId: 'org-1',
      organizations: [
        { organizationId: 'org-1', displayName: 'Stadt Musterhausen', isActive: true },
        { organizationId: 'org-2', displayName: 'Redaktion Musterhausen', isActive: true },
      ],
    };
    routeState.getOrganization.mockImplementation(async (organizationId: string) => ({
      data: {
        id: organizationId,
        displayName: organizationId === 'org-1' ? 'Stadt Musterhausen' : 'Redaktion Musterhausen',
        organizationKey: organizationId,
        organizationType: 'municipality',
        contentAuthorPolicy: organizationId === 'org-1' ? 'org_only' : 'org_or_personal',
        isActive: true,
        parentOrganizationId: undefined,
        depth: 0,
        hierarchyPath: [],
        metadata: {},
        memberships: [],
        children: [],
      },
    }));

    const { appRouteBindings } = await import('./app-route-bindings');

    render(<appRouteBindings.newsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('news-create-page').textContent).toBe('Stadt Musterhausen');
    });
  });

  it('falls back to the current user as author when no org-only membership is configured', async () => {
    routeState.authUser = {
      id: 'user-1',
      displayName: 'Philipp Wilimzig',
    };
    routeState.organizationContext = {
      activeOrganizationId: 'org-2',
      organizations: [{ organizationId: 'org-2', displayName: 'Redaktion Musterhausen', isActive: true }],
    };
    routeState.getOrganization.mockResolvedValue({
      data: {
        id: 'org-2',
        displayName: 'Redaktion Musterhausen',
        organizationKey: 'org-2',
        organizationType: 'municipality',
        contentAuthorPolicy: 'org_or_personal',
        isActive: true,
        parentOrganizationId: undefined,
        depth: 0,
        hierarchyPath: [],
        metadata: {},
        memberships: [],
        children: [],
      },
    });

    const { appRouteBindings } = await import('./app-route-bindings');

    render(<appRouteBindings.newsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('news-create-page').textContent).toBe('Philipp Wilimzig');
    });
  });

  it('stays stable with an authenticated user while the org context is still empty', async () => {
    routeState.authUser = {
      id: 'user-1',
      displayName: 'Philipp Wilimzig',
    };

    const { appRouteBindings } = await import('./app-route-bindings');

    render(<appRouteBindings.newsEditor />);

    await waitFor(() => {
      expect(screen.getByTestId('news-create-page').textContent).toBe('Philipp Wilimzig');
    });

    expect(routeState.getOrganization).not.toHaveBeenCalled();
  });

  it('renders lazy bindings and route-param based bindings with normalized params and search values', async () => {
    const { appRouteBindings } = await import('./app-route-bindings');

    routeState.params = {
      id: 'content-7',
      groupId: 'group-5',
      instanceId: 'instance-3',
      caseId: 'case-3',
      legalTextVersionId: 'legal-2',
      organizationId: 'org-4',
      roleId: 'role-6',
      userId: 'user-8',
      jobId: 'job-9',
    };
    routeState.search = {
      tab: 'members',
    };

    render(<appRouteBindings.interfaces />);
    expect(screen.getByText('Interfaces loading fallback')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('interfaces-page')).toBeTruthy());
    cleanup();

    render(<appRouteBindings.adminGroups />);
    await waitFor(() => expect(screen.getByTestId('groups-page')).toBeTruthy());
    cleanup();

    render(<appRouteBindings.adminGroupDetail />);
    await waitFor(() => expect(screen.getByTestId('group-detail-page').textContent).toBe('group-5'));
    cleanup();

    render(<appRouteBindings.adminOrganizations />);
    await waitFor(() => expect(screen.getByTestId('organizations-page')).toBeTruthy());
    cleanup();

    render(<appRouteBindings.adminOrganizationDetail />);
    await waitFor(() => expect(screen.getByTestId('organization-detail-page').textContent).toBe('org-4'));
    cleanup();

    render(<appRouteBindings.adminRoles />);
    await waitFor(() => expect(screen.getByTestId('roles-page')).toBeTruthy());
    cleanup();

    render(<appRouteBindings.adminUserDetail />);
    await waitFor(() => expect(screen.getByTestId('user-edit-page').textContent).toBe('user-8'));
    cleanup();

    render(<appRouteBindings.contentCreate />);
    expect(screen.getByTestId('content-type-picker-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.contentDetail />);
    expect(screen.getByTestId('content-editor-page').textContent).toBe('edit:content-7:general');
    cleanup();

    render(<appRouteBindings.adminInstanceDetail />);
    expect(screen.getByTestId('instance-detail-page').textContent).toBe('instance-3');
    cleanup();

    render(<appRouteBindings.adminRoleDetail />);
    expect(routeState.normalizeRoleDetailTab).toHaveBeenCalledWith('members');
    expect(screen.getByTestId('role-detail-page').textContent).toBe('role-6:role:members');
    cleanup();

    render(<appRouteBindings.adminLegalTextDetail />);
    expect(screen.getByTestId('legal-text-detail-page').textContent).toBe('legal-2');
    cleanup();

    render(<appRouteBindings.adminIam />);
    expect(routeState.normalizeIamTab).toHaveBeenCalledWith('members');
    expect(screen.getByTestId('iam-viewer-page').textContent).toBe('iam:members');
    cleanup();

    render(<appRouteBindings.adminIamGovernanceDetail />);
    expect(screen.getByTestId('iam-governance-detail-page').textContent).toBe('case-3');
    cleanup();

    render(<appRouteBindings.adminIamDsrDetail />);
    expect(screen.getByTestId('iam-dsr-detail-page').textContent).toBe('case-3');
    cleanup();

    render(<appRouteBindings.accountPrivacyDetail />);
    expect(screen.getByTestId('account-privacy-detail-page').textContent).toBe('case-3');
    cleanup();

    render(<appRouteBindings.newsList />);
    expect(screen.getByTestId('content-list-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.newsEditor />);
    expect(screen.getByTestId('news-create-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.newsDetail />);
    expect(screen.getByTestId('news-edit-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.monitoring />);
    await waitFor(() => expect(screen.getByTestId('monitoring-overview-page')).toBeTruthy());
    cleanup();

    render(<appRouteBindings.monitoringJobs />);
    await waitFor(() => expect(screen.getByTestId('monitoring-jobs-page')).toBeTruthy());
    cleanup();

    render(<appRouteBindings.monitoringJobDetail />);
    await waitFor(() => expect(screen.getByTestId('monitoring-job-detail-page').textContent).toBe('job-9'));
  });

  it('falls back to empty string route params when router params are not strings', async () => {
    const { appRouteBindings } = await import('./app-route-bindings');

    routeState.params = {
      id: 123,
      caseId: null,
      groupId: null,
      instanceId: false,
      legalTextVersionId: { value: 'legal-2' },
      organizationId: ['org-4'],
      roleId: undefined,
      userId: 0,
    };
    routeState.search = {
      tab: undefined,
    };

    render(<appRouteBindings.contentDetail />);
    expect(screen.getByTestId('content-editor-page').textContent).toBe('edit::general');
    cleanup();

    render(<appRouteBindings.adminInstanceDetail />);
    expect(screen.getByTestId('instance-detail-page').textContent).toBe('');
    cleanup();

    render(<appRouteBindings.adminRoleDetail />);
    expect(routeState.normalizeRoleDetailTab).toHaveBeenCalledWith(undefined);
    expect(screen.getByTestId('role-detail-page').textContent).toBe(':role:');
    cleanup();

    render(<appRouteBindings.adminLegalTextDetail />);
    expect(screen.getByTestId('legal-text-detail-page').textContent).toBe('');
    cleanup();

    render(<appRouteBindings.adminGroupDetail />);
    await waitFor(() => expect(screen.getByTestId('group-detail-page').textContent).toBe(''));
    cleanup();

    render(<appRouteBindings.adminOrganizationDetail />);
    await waitFor(() => expect(screen.getByTestId('organization-detail-page').textContent).toBe(''));
    cleanup();

    render(<appRouteBindings.adminUserDetail />);
    await waitFor(() => expect(screen.getByTestId('user-edit-page').textContent).toBe(''));
    cleanup();

    render(<appRouteBindings.adminIamGovernanceDetail />);
    expect(screen.getByTestId('iam-governance-detail-page').textContent).toBe('');
    cleanup();

    render(<appRouteBindings.adminIamDsrDetail />);
    expect(screen.getByTestId('iam-dsr-detail-page').textContent).toBe('');
    cleanup();

    render(<appRouteBindings.accountPrivacyDetail />);
    expect(screen.getByTestId('account-privacy-detail-page').textContent).toBe('');
  });

  it('exposes the direct page bindings for the canonical route keys', async () => {
    const { appRouteBindings } = await import('./app-route-bindings');

    render(<appRouteBindings.home />);
    expect(screen.getByTestId('home-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.account />);
    expect(screen.getByTestId('account-profile-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.accountPrivacy />);
    expect(screen.getByTestId('account-privacy-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.accountPrivacyDetail />);
    expect(screen.getByTestId('account-privacy-detail-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.accountRules />);
    expect(screen.getByTestId('account-rules-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.content />);
    expect(screen.getByTestId('content-list-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.media />);
    expect(screen.getByTestId('media-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.mediaUsage />);
    expect(screen.getByTestId('media-usage-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.adminUsers />);
    expect(screen.getByTestId('user-list-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.adminUserCreate />);
    expect(screen.getByTestId('user-create-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.adminOrganizationCreate />);
    expect(screen.getByTestId('organization-create-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.adminInstances />);
    expect(screen.getByTestId('instances-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.adminInstanceCreate />);
    expect(screen.getByTestId('instance-create-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.adminInstanceSetup />);
    expect(screen.getByTestId('instance-setup-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.adminRoleCreate />);
    expect(screen.getByTestId('role-create-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.adminGroupCreate />);
    expect(screen.getByTestId('group-create-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.adminLegalTexts />);
    expect(screen.getByTestId('legal-texts-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.adminLegalTextCreate />);
    expect(screen.getByTestId('legal-text-create-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.adminApiPhase1Test />);
    expect(screen.getByTestId('phase1-test-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.eventsList />);
    expect(screen.getByTestId('content-list-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.eventsEditor />);
    expect(screen.getByTestId('events-create-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.eventsDetail />);
    expect(screen.getByTestId('events-edit-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.poiList />);
    expect(screen.getByTestId('content-list-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.poiEditor />);
    expect(screen.getByTestId('poi-create-page')).toBeTruthy();
    cleanup();

    render(<appRouteBindings.poiDetail />);
    expect(screen.getByTestId('poi-edit-page')).toBeTruthy();
  });
});
