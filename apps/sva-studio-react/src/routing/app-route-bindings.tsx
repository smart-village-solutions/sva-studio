import { normalizeIamTab, normalizeRoleDetailTab, type AppRouteBindings as BaseAppRouteBindings } from '@sva/routing';
import { useParams, useSearch } from '@tanstack/react-router';
import React from 'react';

import { t } from '../i18n';
import { AccountProfilePage } from '../routes/account/-account-profile-page';
import { AccountPrivacyPage } from '../routes/account/-account-privacy-page';
import { Phase1TestPage } from '../routes/admin/api/-phase1-test-page';
import { IamViewerPage } from '../routes/admin/-iam-page';
import { GroupCreatePage } from '../routes/admin/groups/-group-create-page';
import { InstanceCreatePage } from '../routes/admin/instances/-instance-create-page';
import { InstanceDetailPage } from '../routes/admin/instances/-instance-detail-page';
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
import { ContentEditorPage } from '../routes/content/-content-editor-page';
import { ContentListPage } from '../routes/content/-content-list-page';
import { HomePage } from '../routes/-home-page';
import { PlaceholderPage } from '../routes/-placeholder-page';

const readStringParam = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const CategoriesPlaceholderRoutePage = () => (
  <PlaceholderPage
    section={t('shell.sidebar.sections.dataManagement')}
    title={t('shell.sidebar.categories')}
  />
);

const AppPlaceholderRoutePage = () => (
  <PlaceholderPage
    section={t('shell.sidebar.sections.applications')}
    title={t('shell.sidebar.app')}
  />
);

const MediaPlaceholderRoutePage = () => (
  <PlaceholderPage
    section={t('shell.sidebar.sections.dataManagement')}
    title={t('shell.sidebar.media')}
  />
);

const MonitoringPlaceholderRoutePage = () => (
  <PlaceholderPage
    section={t('shell.sidebar.sections.system')}
    title={t('shell.sidebar.monitoring')}
  />
);

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

const LazyNewsListPage = React.lazy(async () => {
  const mod = await import('@sva/plugin-news');
  return { default: mod.NewsListPage };
});

const NewsListRoutePage = () => renderLazyPage(LazyNewsListPage);

const LazyNewsCreatePage = React.lazy(async () => {
  const mod = await import('@sva/plugin-news');
  return { default: mod.NewsCreatePage };
});

const NewsCreateRoutePage = () => renderLazyPage(LazyNewsCreatePage);

const LazyNewsEditPage = React.lazy(async () => {
  const mod = await import('@sva/plugin-news');
  return { default: mod.NewsEditPage };
});

const NewsEditRoutePage = () => renderLazyPage(LazyNewsEditPage);

const LazyEventsListPage = React.lazy(async () => {
  const mod = await import('@sva/plugin-events');
  return { default: mod.EventsListPage };
});

const EventsListRoutePage = () => renderLazyPage(LazyEventsListPage);

const LazyEventsCreatePage = React.lazy(async () => {
  const mod = await import('@sva/plugin-events');
  return { default: mod.EventsCreatePage };
});

const EventsCreateRoutePage = () => renderLazyPage(LazyEventsCreatePage);

const LazyEventsEditPage = React.lazy(async () => {
  const mod = await import('@sva/plugin-events');
  return { default: mod.EventsEditPage };
});

const EventsEditRoutePage = () => renderLazyPage(LazyEventsEditPage);

const LazyPoiListPage = React.lazy(async () => {
  const mod = await import('@sva/plugin-poi');
  return { default: mod.PoiListPage };
});

const PoiListRoutePage = () => renderLazyPage(LazyPoiListPage);

const LazyPoiCreatePage = React.lazy(async () => {
  const mod = await import('@sva/plugin-poi');
  return { default: mod.PoiCreatePage };
});

const PoiCreateRoutePage = () => renderLazyPage(LazyPoiCreatePage);

const LazyPoiEditPage = React.lazy(async () => {
  const mod = await import('@sva/plugin-poi');
  return { default: mod.PoiEditPage };
});

const PoiEditRoutePage = () => renderLazyPage(LazyPoiEditPage);

const LazyGroupsPage = React.lazy(async () => {
  const mod = await import('../routes/admin/groups/-groups-page');
  return { default: mod.GroupsPage };
});

const GroupsRoutePage = () => renderLazyPage(LazyGroupsPage);

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
  return renderLazyPage(LazyUserEditPage, { userId: readStringParam(params.userId) });
};

const ContentDetailRoutePage = () => {
  const params = useParams({ strict: false });
  return <ContentEditorPage mode="edit" contentId={readStringParam(params.id)} />;
};

const InstanceDetailRoutePage = () => {
  const params = useParams({ strict: false });
  return <InstanceDetailPage instanceId={readStringParam(params.instanceId)} />;
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

export const appRouteBindings: BaseAppRouteBindings = {
  home: HomePage,
  account: AccountProfilePage,
  accountPrivacy: AccountPrivacyPage,
  content: ContentListPage,
  contentCreate: () => <ContentEditorPage mode="create" />,
  contentDetail: ContentDetailRoutePage,
  mediaUsage: MediaUsagePage,
  newsList: NewsListRoutePage,
  newsDetail: NewsEditRoutePage,
  newsEditor: NewsCreateRoutePage,
  eventsList: EventsListRoutePage,
  eventsDetail: EventsEditRoutePage,
  eventsEditor: EventsCreateRoutePage,
  poiList: PoiListRoutePage,
  poiDetail: PoiEditRoutePage,
  poiEditor: PoiCreateRoutePage,
  media: MediaPlaceholderRoutePage,
  adminMedia: MediaPage,
  categories: CategoriesPlaceholderRoutePage,
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
  modules: ModulesPage,
  monitoring: MonitoringPlaceholderRoutePage,
  adminApiPhase1Test: Phase1TestPage,
};
