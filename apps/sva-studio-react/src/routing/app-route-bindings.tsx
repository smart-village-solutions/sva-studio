import { normalizeIamTab, normalizeRoleDetailTab, type AppRouteBindings as BaseAppRouteBindings } from '@sva/routing';
import type { IamOrganizationContextOption, IamOrganizationDetail } from '@sva/core';
import { CategoriesPage } from '@sva/plugin-categories';
import { EventsCreatePage, EventsEditPage } from '@sva/plugin-events';
import { NewsDetailPage, NewsEditPage, type NewsAuthorControl } from '@sva/plugin-news';
import { PoiCreatePage, PoiEditPage } from '@sva/plugin-poi';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import React from 'react';

import { useOrganizationContext } from '../hooks/use-organization-context';
import { t } from '../i18n';
import { getOrganization } from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';
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
import { InstanceSetupPage } from '../routes/admin/instances/-instance-setup-page';
import { InstancesPage } from '../routes/admin/instances/-instances-page';
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
import { ContentEditorPage, normalizeContentEditorTab } from '../routes/content/-content-editor-page';
import { ContentListPage } from '../routes/content/-content-list-page';
import { ContentTypePickerPage } from '../routes/content/-content-type-picker-page';
import { HomePage } from '../routes/-home-page';
import { PlaceholderPage } from '../routes/-placeholder-page';

const readStringParam = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const resolveUserDisplayName = (user: { readonly id: string }) => {
  const candidate = user as { readonly name?: string; readonly displayName?: string };
  return candidate.displayName?.trim() || candidate.name?.trim() || user.id;
};

const EMPTY_ORGANIZATIONS: readonly IamOrganizationContextOption[] = [];

const resolveNewsAuthorControl = (input: {
  readonly organizations: readonly IamOrganizationContextOption[];
  readonly organizationDetails: ReadonlyMap<string, IamOrganizationDetail>;
  readonly userDisplayName?: string;
}): NewsAuthorControl => {
  const activeOrganization = input.organizations.find((organization) => organization.isActive);
  const userDisplayName = input.userDisplayName?.trim() || 'Benutzer';
  const organizationName = activeOrganization?.displayName.trim() ?? '';
  const policy = activeOrganization
    ? input.organizationDetails.get(activeOrganization.organizationId)?.contentAuthorPolicy
    : undefined;

  if (policy === 'org_only' && organizationName.length > 0) {
    return { kind: 'fixed', value: organizationName };
  }

  if (policy === 'org_or_personal' && organizationName.length > 0) {
    return {
      kind: 'selectable',
      value: organizationName,
      options: [
        { value: organizationName, label: organizationName },
        { value: userDisplayName, label: userDisplayName },
      ],
    };
  }

  return { kind: 'fixed', value: userDisplayName };
};

const useNewsCreateAuthorControl = () => {
  const { isAuthenticated, user } = useAuth();
  const organizationContext = useOrganizationContext();
  const [organizationDetails, setOrganizationDetails] = React.useState<ReadonlyMap<string, IamOrganizationDetail>>(
    () => new Map()
  );

  const organizations = organizationContext.context?.organizations ?? EMPTY_ORGANIZATIONS;
  const activeOrganizations = React.useMemo(
    () => organizations.filter((organization) => organization.isActive),
    [organizations]
  );
  const organizationIdsKey = activeOrganizations
    .map((organization) => organization.organizationId)
    .sort((left, right) => left.localeCompare(right))
    .join('|');

  React.useEffect(() => {
    if (!isAuthenticated || activeOrganizations.length === 0) {
      setOrganizationDetails((current) => (current.size === 0 ? current : new Map()));
      return;
    }

    let active = true;

    void Promise.all(
      activeOrganizations.map(async (organization) => {
        try {
          const response = await getOrganization(organization.organizationId);
          return [organization.organizationId, response.data] as const;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (!active) {
        return;
      }

      const nextDetails = new Map<string, IamOrganizationDetail>();
      for (const entry of entries) {
        if (entry) {
          nextDetails.set(entry[0], entry[1]);
        }
      }
      setOrganizationDetails(nextDetails);
    });

    return () => {
      active = false;
    };
  }, [activeOrganizations, isAuthenticated, organizationIdsKey]);

  return resolveNewsAuthorControl({
    organizations,
    organizationDetails,
    userDisplayName: user ? resolveUserDisplayName(user) : undefined,
  });
};

const AppPlaceholderRoutePage = () => (
  <PlaceholderPage section={t('shell.sidebar.sections.applications')} title={t('shell.sidebar.app')} />
);

const LazyMonitoringOverviewPage = React.lazy(async () => {
  const mod = await import('../routes/monitoring/-overview-page');
  return { default: mod.MonitoringOverviewPage };
});

const MonitoringRoutePage = () => renderLazyPage(LazyMonitoringOverviewPage);

const NewsCreateRoutePage = () => {
  const authorControl = useNewsCreateAuthorControl();
  return <NewsDetailPage mode="create" authorControl={authorControl} />;
};

const PoiCreateRoutePage = () => {
  const { user } = useAuth();
  return <PoiCreatePage instanceId={user?.instanceId} />;
};

const PoiEditRoutePage = () => {
  const { user } = useAuth();
  return <PoiEditPage instanceId={user?.instanceId} />;
};

const HelpPlaceholderRoutePage = () => (
  <PlaceholderPage
    section={t('shell.sidebar.help')}
    title={t('shell.sidebar.help')}
  />
);

const SupportPlaceholderRoutePage = () => (
  <PlaceholderPage
    section={t('shell.sidebar.support')}
    title={t('shell.sidebar.support')}
  />
);

const LicensePlaceholderRoutePage = () => (
  <PlaceholderPage
    section={t('shell.sidebar.license')}
    title={t('shell.sidebar.license')}
  />
);

type RenderableRouteComponent<TProps extends object> =
  | React.ComponentType<TProps>
  | React.LazyExoticComponent<React.ComponentType<TProps>>;

type StudioAppRouteBindings = BaseAppRouteBindings & {
  readonly mediaUsage: React.ComponentType;
  readonly newsList: React.ComponentType;
  readonly newsDetail: React.ComponentType;
  readonly newsEditor: React.ComponentType;
  readonly eventsList: React.ComponentType;
  readonly eventsDetail: React.ComponentType;
  readonly eventsEditor: React.ComponentType;
  readonly poiList: React.ComponentType;
  readonly poiDetail: React.ComponentType;
  readonly poiEditor: React.ComponentType;
};

const renderLazyPage = <TProps extends object>(
  Component: RenderableRouteComponent<TProps>,
  props?: TProps
) => (
  <React.Suspense fallback={<p className="text-sm text-muted-foreground">{t('interfaces.messages.loading')}</p>}>
    <Component {...(props ?? ({} as TProps))} />
  </React.Suspense>
);

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

const MonitoringJobDetailRoutePage = () => {
  const params = useParams({ strict: false });
  return renderLazyPage(LazyMonitoringJobDetailPage, {
    jobId: readStringParam(params.jobId),
  });
};

const LazyGroupDetailPage = React.lazy(async () => {
  const mod = await import('../routes/admin/groups/-group-detail-page');
  return { default: mod.GroupDetailPage };
});

const GroupDetailRoutePage = () => {
  const params = useParams({ strict: false });
  return renderLazyPage(LazyGroupDetailPage, { groupId: readStringParam(params.groupId) });
};

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
  return renderLazyPage(LazyOrganizationDetailPage, {
    organizationId: readStringParam(params.organizationId),
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
  const invitationErrorMessage =
    typeof search.inviteMessage === 'string' && search.inviteMessage.trim().length > 0
      ? search.inviteMessage
      : undefined;
  return renderLazyPage(LazyUserEditPage, {
    userId: readStringParam(params.userId),
    invitationStatus: search.invite === 'failed' ? 'failed' : undefined,
    invitationErrorMessage,
  });
};

const ContentDetailRoutePage = () => {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const navigate = useNavigate();

  return (
    <ContentEditorPage
      mode="edit"
      contentId={readStringParam(params.id)}
      activeTab={normalizeContentEditorTab(search.tab)}
      onTabChange={(tab) =>
        void navigate({
          search: { tab } as never,
          replace: true,
        })
      }
    />
  );
};

const InstanceDetailRoutePage = () => {
  const params = useParams({ strict: false });
  return <InstanceDetailPage instanceId={readStringParam(params.instanceId)} />;
};

const InstanceSetupRoutePage = () => {
  const params = useParams({ strict: false });
  return <InstanceSetupPage instanceId={readStringParam(params.instanceId)} />;
};

const RoleDetailRoutePage = () => {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });

  return (
    <RoleDetailPage
      roleId={readStringParam(params.roleId)}
      activeTab={normalizeRoleDetailTab(search.tab)}
    />
  );
};

const LegalTextDetailRoutePage = () => {
  const params = useParams({ strict: false });
  return <LegalTextDetailPage legalTextVersionId={readStringParam(params.legalTextVersionId)} />;
};

const IamRoutePage = () => {
  const search = useSearch({ strict: false });
  return <IamViewerPage activeTab={normalizeIamTab(search.tab)} />;
};

const IamGovernanceDetailRoutePage = () => {
  const params = useParams({ strict: false });
  return <IamGovernanceDetailPage caseId={readStringParam(params.caseId)} />;
};

const IamDsrDetailRoutePage = () => {
  const params = useParams({ strict: false });
  return <IamDsrDetailPage caseId={readStringParam(params.caseId)} />;
};

const AccountPrivacyDetailRoutePage = () => {
  const params = useParams({ strict: false });
  return <AccountPrivacyDetailPage caseId={readStringParam(params.caseId)} />;
};

export const appRouteBindings: StudioAppRouteBindings = {
  home: HomePage,
  account: AccountProfilePage,
  accountPrivacy: AccountPrivacyPage,
  accountPrivacyDetail: AccountPrivacyDetailRoutePage,
  accountRules: AccountRulesPage,
  content: ContentListPage,
  contentCreate: ContentTypePickerPage,
  contentDetail: ContentDetailRoutePage,
  mediaUsage: MediaUsagePage,
  newsList: ContentListPage,
  newsDetail: NewsEditPage,
  newsEditor: NewsCreateRoutePage,
  eventsList: ContentListPage,
  eventsDetail: EventsEditPage,
  eventsEditor: EventsCreatePage,
  poiList: ContentListPage,
  poiDetail: PoiEditRoutePage,
  poiEditor: PoiCreateRoutePage,
  media: MediaPage,
  adminMedia: MediaPage,
  categories: CategoriesPage,
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
  adminInstanceSetup: InstanceSetupRoutePage,
  adminInstanceDetail: InstanceDetailRoutePage,
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
};
