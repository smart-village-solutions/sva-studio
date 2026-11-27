import { LoginMfaPage } from '../routes/admin/users/-login-mfa-page';
import type { AppRouteBindings } from '@sva/routing';
import {
  normalizeIamTab,
  normalizeRoleDetailTab,
  normalizeOrganizationDetailTab,
} from '@sva/routing/route-search';
import {
  lazyRouteComponent,
  useLoaderData,
  useNavigate,
  useParams,
  useSearch,
  type AsyncRouteComponent,
} from '@tanstack/react-router';
import NotFound from '../components/NotFound';

import { t } from '../i18n';
import { AccountProfilePage } from '../routes/account/-account-profile-page';
import { AccountPrivacyPage } from '../routes/account/-account-privacy-page';
import { AccountPrivacyDetailPage } from '../routes/account/-account-privacy-detail-page';
import { AccountRulesPage } from '../routes/account/-account-rules-page';
import { Phase1TestPage } from '../routes/admin/api/-phase1-test-page';
import { IamViewerPage } from '../routes/admin/-iam-page';
import { IamDsrDetailPage } from '../routes/admin/-iam-dsr-detail-page';
import { IamGovernanceDetailPage } from '../routes/admin/-iam-governance-detail-page';
import { GroupCreatePage } from '../routes/admin/groups/-group-create-page';
import { InstanceCreatePage } from '../routes/admin/instances/-instance-create-page';
import { InstanceDetailPage } from '../routes/admin/instances/-instance-detail-page';
import { InstancesPage } from '../routes/admin/instances/-instances-page';
import { TemplatesPage } from '../routes/admin/templates/-templates-page';
import { LegalTextCreatePage } from '../routes/admin/legal-texts/-legal-text-create-page';
import { LegalTextDetailPage } from '../routes/admin/legal-texts/-legal-text-detail-page';
import { LegalTextsPage } from '../routes/admin/legal-texts/-legal-texts-page';
import { ModulesPage } from '../routes/admin/modules/-modules-page';
import { OrganizationCreatePage } from '../routes/admin/organizations/-organization-create-page';
import { RoleCreatePage } from '../routes/admin/roles/-role-create-page';
import { RoleDetailPage } from '../routes/admin/roles/-role-detail-page';
import { UserCreatePage } from '../routes/admin/users/-user-create-page';
import { InvitationTemplatePage } from '../routes/admin/users/-invitation-template-page';
import { UserListPage } from '../routes/admin/users/-user-list-page';
import { MediaPage } from '../routes/admin/media/-media-page';
import { MediaUsagePage } from '../routes/admin/media/-media-usage-page';
import type { RootLoaderData } from '../routes/__root';
import { HomePage } from '../routes/-home-page';
import { PlaceholderPage } from '../routes/-placeholder-page';

const readStringParam = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const bindLazyRouteParams = <TProps extends object>(
  Page: AsyncRouteComponent<TProps>,
  useProps: () => TProps
) => Object.assign(() => <Page {...useProps()} />, { preload: () => Page.preload?.() });

const ChangelogRoutePage = lazyRouteComponent(
  () => import('../routes/-changelog-page'),
  'ChangelogRoutePage'
);

const HelpPlaceholderRoutePage = () => (
  <PlaceholderPage section={t('shell.sidebar.help')} title={t('shell.sidebar.help')} />
);
const SupportPlaceholderRoutePage = () => (
  <PlaceholderPage section={t('shell.sidebar.support')} title={t('shell.sidebar.support')} />
);
const LicensePlaceholderRoutePage = () => (
  <PlaceholderPage section={t('shell.sidebar.license')} title={t('shell.sidebar.license')} />
);

const MonitoringRoutePage = lazyRouteComponent(
  () => import('../routes/monitoring/-overview-page'),
  'MonitoringOverviewPage'
);
const InterfacesRoutePage = lazyRouteComponent(
  () => import('../routes/interfaces/-interfaces-page'),
  'InterfacesPage'
);
const GroupsRoutePage = lazyRouteComponent(
  () => import('../routes/admin/groups/-groups-page'),
  'GroupsPage'
);
const MonitoringJobsRoutePage = lazyRouteComponent(
  () => import('../routes/monitoring/-jobs-page'),
  'MonitoringJobsPage'
);
const MonitoringJobDetailRoutePage = bindLazyRouteParams(
  lazyRouteComponent(() => import('../routes/monitoring/-job-detail-page'), 'MonitoringJobDetailPage'),
  () => ({ jobId: readStringParam(useParams({ strict: false }).jobId) })
);
const GroupDetailRoutePage = bindLazyRouteParams(
  lazyRouteComponent(() => import('../routes/admin/groups/-group-detail-page'), 'GroupDetailPage'),
  () => ({ groupId: readStringParam(useParams({ strict: false }).groupId) })
);
const OrganizationsRoutePage = lazyRouteComponent(
  () => import('../routes/admin/organizations/-organizations-page'),
  'OrganizationsPage'
);
const OrganizationDetailRoutePage = bindLazyRouteParams(
  lazyRouteComponent(
    () => import('../routes/admin/organizations/-organization-detail-page'),
    'OrganizationDetailPage'
  ),
  () => {
    const params = useParams({ strict: false });
    const search = useSearch({ strict: false });
    const navigate = useNavigate();
    return {
      organizationId: readStringParam(params.organizationId),
      activeTab: normalizeOrganizationDetailTab(search.tab),
      onTabChange: (tab) => void navigate({ search: { tab } as never, replace: true }),
    };
  }
);
const RolesRoutePage = lazyRouteComponent(
  () => import('../routes/admin/roles/-roles-page'),
  'RolesPage'
);
const UserEditRoutePage = bindLazyRouteParams(
  lazyRouteComponent(() => import('../routes/admin/users/-user-edit-page'), 'UserEditPage'),
  () => {
    const params = useParams({ strict: false });
    const search = useSearch({ strict: false });
    return {
      userId: readStringParam(params.userId),
      invitationStatus: search.invite === 'failed' ? ('failed' as const) : undefined,
      invitationErrorMessage:
        typeof search.inviteMessage === 'string' && search.inviteMessage.trim().length > 0
          ? search.inviteMessage
          : undefined,
    };
  }
);
const InstanceDetailRoutePage = () => (
  <InstanceDetailPage instanceId={readStringParam(useParams({ strict: false }).instanceId)} />
);
const RoleDetailRoutePage = () => (
  <RoleDetailPage
    roleId={readStringParam(useParams({ strict: false }).roleId)}
    activeTab={normalizeRoleDetailTab(useSearch({ strict: false }).tab)}
  />
);
const LegalTextDetailRoutePage = () => (
  <LegalTextDetailPage
    legalTextVersionId={readStringParam(useParams({ strict: false }).legalTextVersionId)}
  />
);
const IamRoutePage = () => (
  <IamViewerPage activeTab={normalizeIamTab(useSearch({ strict: false }).tab)} />
);
const IamGovernanceDetailRoutePage = () => (
  <IamGovernanceDetailPage caseId={readStringParam(useParams({ strict: false }).caseId)} />
);
const IamDsrDetailRoutePage = () => (
  <IamDsrDetailPage caseId={readStringParam(useParams({ strict: false }).caseId)} />
);
const AccountPrivacyDetailRoutePage = () => (
  <AccountPrivacyDetailPage caseId={readStringParam(useParams({ strict: false }).caseId)} />
);

const HomeRoutePage = () => {
  const initiallyAuthenticated = useLoaderData({
    from: '__root__',
    select: (data) => (data as RootLoaderData | undefined)?.initiallyAuthenticated,
  });
  return <HomePage initiallyAuthenticated={initiallyAuthenticated} />;
};

export const coreAppRouteBindings = {
  home: HomeRoutePage,
  changelog: ChangelogRoutePage,
  account: AccountProfilePage,
  accountPrivacy: AccountPrivacyPage,
  accountPrivacyDetail: AccountPrivacyDetailRoutePage,
  accountRules: AccountRulesPage,
  mediaUsage: MediaUsagePage,
  media: MediaPage,
  adminMedia: MediaPage,
  interfaces: InterfacesRoutePage,
  help: HelpPlaceholderRoutePage,
  support: SupportPlaceholderRoutePage,
  license: LicensePlaceholderRoutePage,
  adminUsers: UserListPage,
  adminUserCreate: UserCreatePage,
  adminUserDetail: UserEditRoutePage,
  adminUserLoginMfa: LoginMfaPage,
  adminUserInvitationTemplate: InvitationTemplatePage,
  adminOrganizations: OrganizationsRoutePage,
  adminOrganizationCreate: OrganizationCreatePage,
  adminOrganizationDetail: OrganizationDetailRoutePage,
  adminInstances: InstancesPage,
  adminInstanceCreate: InstanceCreatePage,
  adminInstanceDetail: InstanceDetailRoutePage,
  adminTemplates: TemplatesPage,
  appTexts: NotFound,
  adminAppTranslations: NotFound,
  adminRoles: RolesRoutePage,
  adminRoleCreate: RoleCreatePage,
  adminRoleDetail: RoleDetailRoutePage,
  adminGroups: GroupsRoutePage,
  adminGroupCreate: GroupCreatePage,
  adminGroupDetail: GroupDetailRoutePage,
  adminLegalTexts: LegalTextsPage,
  adminLegalTextCreate: LegalTextCreatePage,
  adminLegalTextDetail: LegalTextDetailRoutePage,
  adminIam: IamRoutePage,
  adminIamGovernanceDetail: IamGovernanceDetailRoutePage,
  adminIamDsrDetail: IamDsrDetailRoutePage,
  modules: ModulesPage,
  monitoring: MonitoringRoutePage,
  monitoringJobs: MonitoringJobsRoutePage,
  monitoringJobDetail: MonitoringJobDetailRoutePage,
  adminApiPhase1Test: Phase1TestPage,
} satisfies Partial<AppRouteBindings>;
