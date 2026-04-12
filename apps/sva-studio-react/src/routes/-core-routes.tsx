import type { RootRoute } from '@tanstack/react-router';
import { createRoute } from '@tanstack/react-router';
import React from 'react';

import { t } from '../i18n';
import { AccountProfilePage } from './account/-account-profile-page';
import { AccountPrivacyPage } from './account/-account-privacy-page';
import { Phase1TestPage } from './admin/api/-phase1-test-page';
import { IamViewerPage } from './admin/-iam-page';
import { normalizeIamTab } from './admin/-iam.models';
import { GroupCreatePage } from './admin/groups/-group-create-page';
import { InstanceCreatePage } from './admin/instances/-instance-create-page';
import { InstanceDetailPage } from './admin/instances/-instance-detail-page';
import { InstancesPage } from './admin/instances/-instances-page';
import { LegalTextCreatePage } from './admin/legal-texts/-legal-text-create-page';
import { LegalTextDetailPage } from './admin/legal-texts/-legal-text-detail-page';
import { LegalTextsPage } from './admin/legal-texts/-legal-texts-page';
import { OrganizationCreatePage } from './admin/organizations/-organization-create-page';
import { RoleCreatePage } from './admin/roles/-role-create-page';
import { normalizeRoleDetailTab, RoleDetailPage } from './admin/roles/-role-detail-page';
import { UserCreatePage } from './admin/users/-user-create-page';
import { UserListPage } from './admin/users/-user-list-page';
import { ContentEditorPage } from './content/-content-editor-page';
import { ContentListPage } from './content/-content-list-page';
import { HomePage } from './-home-page';
import { PlaceholderPage } from './-placeholder-page';

type AccountUiGuardKey =
  | 'account'
  | 'accountPrivacy'
  | 'content'
  | 'contentCreate'
  | 'contentDetail'
  | 'adminUsers'
  | 'adminUserCreate'
  | 'adminUserDetail'
  | 'adminOrganizations'
  | 'adminOrganizationCreate'
  | 'adminOrganizationDetail'
  | 'adminInstances'
  | 'adminRoles'
  | 'adminRoleDetail'
  | 'adminGroups'
  | 'adminGroupCreate'
  | 'adminGroupDetail'
  | 'adminLegalTexts'
  | 'adminLegalTextCreate'
  | 'adminLegalTextDetail'
  | 'adminIam';

let accountUiGuardsPromise: Promise<typeof import('@sva/routing')> | null = null;

const getAccountUiGuards = async () => {
  accountUiGuardsPromise ??= import('@sva/routing');
  return accountUiGuardsPromise;
};

const runAccountUiGuard = async (guardKey: AccountUiGuardKey, options: unknown) => {
  const routing = await getAccountUiGuards();
  const guards = routing.accountUiRouteGuards as Record<AccountUiGuardKey, (options: unknown) => Promise<void>>;
  // Guard-Signatur variiert je nach guardKey — TypeScript kann die Beziehung
  // zwischen Key und Options-Typ nicht statisch auflösen. Runtime-sicher,
  // da guardKey und options immer paarweise aus derselben Factory kommen.
  return guards[guardKey](options);
};

const MediaPlaceholderRoutePage = () => (
  <PlaceholderPage
    section={t('shell.sidebar.sections.dataManagement')}
    title={t('shell.sidebar.media')}
  />
);

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

const ModulesPlaceholderRoutePage = () => (
  <PlaceholderPage
    section={t('shell.sidebar.sections.system')}
    title={t('shell.sidebar.modules')}
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

const LazyInterfacesPage = React.lazy(async () => {
  const mod = await import('./interfaces/-interfaces-page');
  return { default: mod.InterfacesPage };
});

const InterfacesRoutePage = () => (
  <React.Suspense fallback={<p className="text-sm text-muted-foreground">{t('interfaces.messages.loading')}</p>}>
    <LazyInterfacesPage />
  </React.Suspense>
);

const LazyGroupsPage = React.lazy(async () => {
  const mod = await import('./admin/groups/-groups-page');
  return { default: mod.GroupsPage };
});

const GroupsRoutePage = () => (
  <React.Suspense fallback={<p className="text-sm text-muted-foreground">{t('interfaces.messages.loading')}</p>}>
    <LazyGroupsPage />
  </React.Suspense>
);

const LazyGroupDetailPage = React.lazy(async () => {
  const mod = await import('./admin/groups/-group-detail-page');
  return { default: mod.GroupDetailPage };
});

const GroupDetailRoutePage = ({ groupId }: Readonly<{ groupId: string }>) => (
  <React.Suspense fallback={<p className="text-sm text-muted-foreground">{t('interfaces.messages.loading')}</p>}>
    <LazyGroupDetailPage groupId={groupId} />
  </React.Suspense>
);

const LazyOrganizationsPage = React.lazy(async () => {
  const mod = await import('./admin/organizations/-organizations-page');
  return { default: mod.OrganizationsPage };
});

const OrganizationsRoutePage = () => (
  <React.Suspense fallback={<p className="text-sm text-muted-foreground">{t('interfaces.messages.loading')}</p>}>
    <LazyOrganizationsPage />
  </React.Suspense>
);

const LazyOrganizationDetailPage = React.lazy(async () => {
  const mod = await import('./admin/organizations/-organization-detail-page');
  return { default: mod.OrganizationDetailPage };
});

const OrganizationDetailRoutePage = ({ organizationId }: Readonly<{ organizationId: string }>) => (
  <React.Suspense fallback={<p className="text-sm text-muted-foreground">{t('interfaces.messages.loading')}</p>}>
    <LazyOrganizationDetailPage organizationId={organizationId} />
  </React.Suspense>
);

const LazyRolesPage = React.lazy(async () => {
  const mod = await import('./admin/roles/-roles-page');
  return { default: mod.RolesPage };
});

const RolesRoutePage = () => (
  <React.Suspense fallback={<p className="text-sm text-muted-foreground">{t('interfaces.messages.loading')}</p>}>
    <LazyRolesPage />
  </React.Suspense>
);

const UserListRoutePage = () => <UserListPage />;

const LazyUserEditPage = React.lazy(async () => {
  const mod = await import('./admin/users/-user-edit-page');
  return { default: mod.UserEditPage };
});

const UserEditRoutePage = ({ userId }: Readonly<{ userId: string }>) => (
  <React.Suspense fallback={<p className="text-sm text-muted-foreground">{t('interfaces.messages.loading')}</p>}>
    <LazyUserEditPage userId={userId} />
  </React.Suspense>
);

export const homeRouteFactory = (rootRoute: RootRoute) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomePage,
  });

export const runtimeCoreRouteFactories = [
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/account',
      beforeLoad: (options) => runAccountUiGuard('account', options),
      component: AccountProfilePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/account/privacy',
      beforeLoad: (options) => runAccountUiGuard('accountPrivacy', options),
      component: AccountPrivacyPage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/content',
      beforeLoad: (options) => runAccountUiGuard('content', options),
      component: ContentListPage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/content/new',
      beforeLoad: (options) => runAccountUiGuard('contentCreate', options),
      component: () => <ContentEditorPage mode="create" />,
    }),
  (rootRoute: RootRoute) => {
    const contentDetailRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/content/$contentId',
      beforeLoad: (options) => runAccountUiGuard('contentDetail', options),
      component: () => <ContentEditorPage mode="edit" contentId={contentDetailRoute.useParams().contentId} />,
    });
    return contentDetailRoute;
  },
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/media',
      beforeLoad: (options) => runAccountUiGuard('account', options),
      component: MediaPlaceholderRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/categories',
      beforeLoad: (options) => runAccountUiGuard('account', options),
      component: CategoriesPlaceholderRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/app',
      beforeLoad: (options) => runAccountUiGuard('account', options),
      component: AppPlaceholderRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/interfaces',
      component: InterfacesRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/help',
      component: HelpPlaceholderRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/support',
      component: SupportPlaceholderRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/license',
      component: LicensePlaceholderRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/users',
      beforeLoad: (options) => runAccountUiGuard('adminUsers', options),
      component: UserListRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/users/new',
      beforeLoad: (options) => runAccountUiGuard('adminUserCreate', options),
      component: UserCreatePage,
    }),
  (rootRoute: RootRoute) => {
    const userEditRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/users/$userId',
      beforeLoad: (options) => runAccountUiGuard('adminUserDetail', options),
      component: () => <UserEditRoutePage userId={userEditRoute.useParams().userId} />,
    });
    return userEditRoute;
  },
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/organizations',
      beforeLoad: (options) => runAccountUiGuard('adminOrganizations', options),
      component: OrganizationsRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/organizations/new',
      beforeLoad: (options) => runAccountUiGuard('adminOrganizationCreate', options),
      component: OrganizationCreatePage,
    }),
  (rootRoute: RootRoute) => {
    const organizationDetailRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/organizations/$organizationId',
      beforeLoad: (options) => runAccountUiGuard('adminOrganizationDetail', options),
      component: () => (
        <OrganizationDetailRoutePage organizationId={organizationDetailRoute.useParams().organizationId} />
      ),
    });
    return organizationDetailRoute;
  },
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/instances',
      beforeLoad: (options) => runAccountUiGuard('adminInstances', options),
      component: InstancesPage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/instances/new',
      beforeLoad: (options) => runAccountUiGuard('adminInstances', options),
      component: InstanceCreatePage,
    }),
  (rootRoute: RootRoute) => {
    const instanceDetailRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/instances/$instanceId',
      beforeLoad: (options) => runAccountUiGuard('adminInstances', options),
      component: () => <InstanceDetailPage instanceId={instanceDetailRoute.useParams().instanceId} />,
    });
    return instanceDetailRoute;
  },
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/roles',
      beforeLoad: (options) => runAccountUiGuard('adminRoles', options),
      component: RolesRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/roles/new',
      beforeLoad: (options) => runAccountUiGuard('adminRoles', options),
      component: RoleCreatePage,
    }),
  (rootRoute: RootRoute) => {
    const roleDetailRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/roles/$roleId',
      beforeLoad: (options) => runAccountUiGuard('adminRoleDetail', options),
      validateSearch: (search: Record<string, unknown>) => ({
        tab: normalizeRoleDetailTab(search.tab),
      }),
      component: () => (
        <RoleDetailPage
          roleId={roleDetailRoute.useParams().roleId}
          activeTab={roleDetailRoute.useSearch().tab}
        />
      ),
    });
    return roleDetailRoute;
  },
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/groups',
      beforeLoad: (options) => runAccountUiGuard('adminGroups', options),
      component: GroupsRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/groups/new',
      beforeLoad: (options) => runAccountUiGuard('adminGroupCreate', options),
      component: GroupCreatePage,
    }),
  (rootRoute: RootRoute) => {
    const groupDetailRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/groups/$groupId',
      beforeLoad: (options) => runAccountUiGuard('adminGroupDetail', options),
      component: () => <GroupDetailRoutePage groupId={groupDetailRoute.useParams().groupId} />,
    });
    return groupDetailRoute;
  },
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/legal-texts',
      beforeLoad: (options) => runAccountUiGuard('adminLegalTexts', options),
      component: LegalTextsPage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/legal-texts/new',
      beforeLoad: (options) => runAccountUiGuard('adminLegalTextCreate', options),
      component: LegalTextCreatePage,
    }),
  (rootRoute: RootRoute) => {
    const legalTextDetailRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/legal-texts/$legalTextVersionId',
      beforeLoad: (options) => runAccountUiGuard('adminLegalTextDetail', options),
      component: () => (
        <LegalTextDetailPage legalTextVersionId={legalTextDetailRoute.useParams().legalTextVersionId} />
      ),
    });
    return legalTextDetailRoute;
  },
  (rootRoute: RootRoute) => {
    const iamRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/iam',
      beforeLoad: (options) => runAccountUiGuard('adminIam', options),
      validateSearch: (search: Record<string, unknown>) => ({
        tab: normalizeIamTab(search.tab),
      }),
      component: () => <IamViewerPage activeTab={iamRoute.useSearch().tab} />,
    });
    return iamRoute;
  },
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/modules',
      beforeLoad: (options) => runAccountUiGuard('adminRoles', options),
      component: ModulesPlaceholderRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/monitoring',
      beforeLoad: (options) => runAccountUiGuard('adminRoles', options),
      component: MonitoringPlaceholderRoutePage,
    }),
  (rootRoute: RootRoute) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/admin/api/phase1-test',
      component: Phase1TestPage,
    }),
] as const;

export const coreRouteFactoriesBase = [homeRouteFactory, ...runtimeCoreRouteFactories] as const;
export const coreRouteFactories = coreRouteFactoriesBase;
