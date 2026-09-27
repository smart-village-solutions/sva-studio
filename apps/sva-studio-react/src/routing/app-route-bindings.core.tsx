import { normalizeIamTab, normalizeRoleDetailTab, type AppRouteBindings } from '@sva/routing';
import { normalizeOrganizationDetailTab } from '@sva/routing/route-search';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import React from 'react';

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
import { UserListPage } from '../routes/admin/users/-user-list-page';
import { MediaPage } from '../routes/admin/media/-media-page';
import { MediaUsagePage } from '../routes/admin/media/-media-usage-page';
import { HomePage } from '../routes/-home-page';
import { PlaceholderPage } from '../routes/-placeholder-page';

const readStringParam = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const renderLazyPage = <TProps extends object>(
  Component: React.ComponentType<TProps> | React.LazyExoticComponent<React.ComponentType<TProps>>,
  props?: TProps
) => (
  <React.Suspense
    fallback={<p className="text-sm text-muted-foreground">{t('interfaces.messages.loading')}</p>}
  >
    <Component {...(props ?? ({} as TProps))} />
  </React.Suspense>
);

const AppPlaceholderRoutePage = () => (
  <PlaceholderPage
    section={t('shell.sidebar.sections.applications')}
    title={t('shell.sidebar.app')}
  />
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

const LazyMonitoringOverviewPage = React.lazy(async () => {
  const mod = await import('../routes/monitoring/-overview-page');
  return { default: mod.MonitoringOverviewPage };
});
const MonitoringRoutePage = () => renderLazyPage(LazyMonitoringOverviewPage);
const LazyInterfacesPage = React.lazy(async () => {
  const mod = await import('../routes/interfaces/-interfaces-page');
  return { default: mod.InterfacesPage };
});
const InterfacesRoutePage = () => renderLazyPage(LazyInterfacesPage);
const LazyGroupsPage = React.lazy(async () => {
  const mod = await import('../routes/admin/groups/-groups-page');
  return { default: mod.GroupsPage };
});
const GroupsRoutePage = () => renderLazyPage(LazyGroupsPage);
const LazyMonitoringJobsPage = React.lazy(async () => {
  const mod = await import('../routes/monitoring/-jobs-page');
  return { default: mod.MonitoringJobsPage };
});
const MonitoringJobsRoutePage = () => renderLazyPage(LazyMonitoringJobsPage);
const LazyMonitoringJobDetailPage = React.lazy(async () => {
  const mod = await import('../routes/monitoring/-job-detail-page');
  return { default: mod.MonitoringJobDetailPage };
});
const MonitoringJobDetailRoutePage = () =>
  renderLazyPage(LazyMonitoringJobDetailPage, {
    jobId: readStringParam(useParams({ strict: false }).jobId),
  });
const LazyGroupDetailPage = React.lazy(async () => {
  const mod = await import('../routes/admin/groups/-group-detail-page');
  return { default: mod.GroupDetailPage };
});
const GroupDetailRoutePage = () =>
  renderLazyPage(LazyGroupDetailPage, {
    groupId: readStringParam(useParams({ strict: false }).groupId),
  });
const LazyOrganizationsPage = React.lazy(async () => {
  const mod = await import('../routes/admin/organizations/-organizations-page');
  return { default: mod.OrganizationsPage };
});
const OrganizationsRoutePage = () => renderLazyPage(LazyOrganizationsPage);
const LazyOrganizationDetailPage = React.lazy(async () => {
  const mod = await import('../routes/admin/organizations/-organization-detail-page');
  return { default: mod.OrganizationDetailPage };
});
const OrganizationDetailRoutePage = () => {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  return renderLazyPage(LazyOrganizationDetailPage, {
    organizationId: readStringParam(params.organizationId),
    activeTab: normalizeOrganizationDetailTab(search.tab),
    onTabChange: (tab) =>
      void navigate({
        search: { tab } as never,
        replace: true,
      }),
  });
};
const LazyRolesPage = React.lazy(async () => {
  const mod = await import('../routes/admin/roles/-roles-page');
  return { default: mod.RolesPage };
});
const RolesRoutePage = () => renderLazyPage(LazyRolesPage);
const LazyUserEditPage = React.lazy(async () => {
  const mod = await import('../routes/admin/users/-user-edit-page');
  return { default: mod.UserEditPage };
});
const UserEditRoutePage = () => {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  return renderLazyPage(LazyUserEditPage, {
    userId: readStringParam(params.userId),
    invitationStatus: search.invite === 'failed' ? 'failed' : undefined,
    invitationErrorMessage:
      typeof search.inviteMessage === 'string' && search.inviteMessage.trim().length > 0
        ? search.inviteMessage
        : undefined,
  });
};
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

export const coreAppRouteBindings = {
  home: HomePage,
  account: AccountProfilePage,
  accountPrivacy: AccountPrivacyPage,
  accountPrivacyDetail: AccountPrivacyDetailRoutePage,
  accountRules: AccountRulesPage,
  mediaUsage: MediaUsagePage,
  media: MediaPage,
  adminMedia: MediaPage,
  app: AppPlaceholderRoutePage,
  interfaces: InterfacesRoutePage,
  help: HelpPlaceholderRoutePage,
  support: SupportPlaceholderRoutePage,
  license: LicensePlaceholderRoutePage,
  adminUsers: UserListPage,
  adminUserCreate: UserCreatePage,
  adminUserDetail: UserEditRoutePage,
  adminOrganizations: OrganizationsRoutePage,
  adminOrganizationCreate: OrganizationCreatePage,
  adminOrganizationDetail: OrganizationDetailRoutePage,
  adminInstances: InstancesPage,
  adminInstanceCreate: InstanceCreatePage,
  adminInstanceDetail: InstanceDetailRoutePage,
  adminTemplates: TemplatesPage,
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
