import {
  normalizeIamTab,
  normalizeRoleDetailTab,
  type AppRouteBindings as BaseAppRouteBindings,
} from '@sva/routing';
import { normalizeOrganizationDetailTab } from '@sva/routing/route-search';
import {
  resolveUserDisplayName,
  type IamContentOwnershipTarget,
  type IamOrganizationContextOption,
} from '@sva/core';
import { CategoriesPage } from '@sva/plugin-categories';
import {
  CockpitCardsCreatePage,
  CockpitCardsEditPage,
  CockpitCardsListPage,
} from '@sva/plugin-cockpit-cards';
import { EventsCreatePage, EventsEditPage } from '@sva/plugin-events';
import { FaqCreatePage, FaqEditPage, FaqListPage } from '@sva/plugin-faq';
import { GenericItemsCreatePage, GenericItemsEditPage } from '@sva/plugin-generic-items';
import { NewsDetailPage, NewsEditPage } from '@sva/plugin-news';
import { PoiCreatePage, PoiEditPage } from '@sva/plugin-poi';
import { ProjectsCreatePage, ProjectsEditPage, ProjectsListPage } from '@sva/plugin-projects';
import { SurveyCreatePage, SurveyEditPage } from '@sva/plugin-surveys';
import {
  createMainserverMutationHeaders,
  createMainserverReadHeaders,
  MainserverApiError,
  requestMainserverJson,
} from '@sva/plugin-sdk';
import {
  ContentOwnershipPanel,
  ContentOwnershipSlotsProvider,
  StudioLoadingState,
  type ContentOwnershipPanelLabels,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../components/ui/alert';
import { useMainserverMutationCapabilities } from '../hooks/use-mainserver-mutation-capabilities';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { t } from '../i18n';
import { getContent } from '../lib/iam-api';
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
import {
  ContentEditorPage,
  normalizeContentEditorTab,
} from '../routes/content/-content-editor-page';
import { ContentListPage } from '../routes/content/-content-list-page';
import { ContentTypePickerPage } from '../routes/content/-content-type-picker-page';
import { HomePage } from '../routes/-home-page';
import { PlaceholderPage } from '../routes/-placeholder-page';

const readStringParam = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const EMPTY_ORGANIZATIONS: readonly IamOrganizationContextOption[] = [];

export type MainserverPrincipalResolution =
  | Readonly<{ kind: 'ready'; control: MainserverPrincipalControlModel }>
  | Readonly<{ kind: 'unavailable'; reason: 'context_loading' | 'context_unavailable' }>;

export const resolveMainserverPrincipalControl = (input: {
  readonly contextAvailable: boolean;
  readonly contextLoading?: boolean;
  readonly activeOrganizationId?: string;
  readonly organizations: readonly IamOrganizationContextOption[];
  readonly userDisplayName?: string;
}): MainserverPrincipalResolution => {
  if (input.contextLoading) {
    return { kind: 'unavailable', reason: 'context_loading' };
  }
  if (!input.contextAvailable) {
    return { kind: 'unavailable', reason: 'context_unavailable' };
  }

  const activeOrganization = input.activeOrganizationId
    ? input.organizations.find(
        (organization) =>
          organization.organizationId === input.activeOrganizationId && organization.isActive
      )
    : undefined;
  const userDisplayName = input.userDisplayName?.trim() || t('content.principal.user');
  const organizationName = activeOrganization?.displayName.trim() ?? '';
  const policy = activeOrganization?.contentAuthorPolicy;
  const hasValidPolicy = policy === 'org_only' || policy === 'org_or_personal';

  if (
    input.activeOrganizationId &&
    (!activeOrganization || organizationName.length === 0 || !hasValidPolicy)
  ) {
    return { kind: 'unavailable', reason: 'context_unavailable' };
  }

  if (policy === 'org_only' && organizationName.length > 0) {
    return {
      kind: 'ready',
      control: { kind: 'fixed', value: 'organization', label: organizationName },
    };
  }

  if (policy === 'org_or_personal' && organizationName.length > 0) {
    return {
      kind: 'ready',
      control: {
        kind: 'selectable',
        value: 'organization',
        options: [
          { value: 'organization', label: organizationName },
          { value: 'user', label: userDisplayName },
        ],
      },
    };
  }

  return {
    kind: 'ready',
    control: { kind: 'fixed', value: 'user', label: userDisplayName },
  };
};

const useMainserverPrincipalControl = () => {
  const { user } = useAuth();
  const organizationContext = useOrganizationContext();
  const organizations = organizationContext.context?.organizations ?? EMPTY_ORGANIZATIONS;

  return resolveMainserverPrincipalControl({
    contextAvailable: organizationContext.context !== null && organizationContext.error === null,
    contextLoading: organizationContext.isLoading || organizationContext.isUpdating,
    activeOrganizationId: organizationContext.context?.activeOrganizationId,
    organizations,
    userDisplayName: user ? resolveUserDisplayName(user) : undefined,
  });
};

const MainserverPrincipalAlert = ({
  reason,
}: Readonly<{ reason: 'context_loading' | 'context_unavailable' }>) => (
  <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
    <AlertDescription>
      {t(
        reason === 'context_loading'
          ? 'content.principal.contextLoading'
          : 'content.principal.contextUnavailable'
      )}
    </AlertDescription>
  </Alert>
);

const MainserverPrincipalBoundary = ({
  children,
}: Readonly<{
  children: (control: MainserverPrincipalControlModel) => React.ReactNode;
}>) => {
  const resolution = useMainserverPrincipalControl();
  if (resolution.kind === 'unavailable') {
    return <MainserverPrincipalAlert reason={resolution.reason} />;
  }
  return <>{children(resolution.control)}</>;
};

type MainserverResourcePrincipalResolution =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error' }>
  | Readonly<{
      kind: 'ready';
      control: MainserverPrincipalControlModel;
      owner: Readonly<{
        displayName: string;
      }>;
    }>;

const resolveMainserverDetailUrl = (contentType: string, contentId: string): string => {
  const collection =
    contentType === 'news.article'
      ? 'news'
      : contentType === 'events.event-record'
        ? 'events'
        : contentType === 'poi.point-of-interest'
          ? 'poi'
          : contentType === 'surveys.survey'
            ? 'surveys'
            : 'generic-items';
  return `/api/v1/mainserver/${collection}/${encodeURIComponent(contentId)}`;
};

const resolveOwnershipTransferError = (error: unknown): string => {
  if (!(error instanceof MainserverApiError)) return t('content.ownership.error');
  const key =
    error.code === 'content_transfer_permission_missing'
      ? 'permissionMissing'
      : error.code === 'content_transfer_target_invalid'
        ? 'targetInvalid'
        : error.code === 'content_transfer_target_credentials_missing'
          ? 'credentialsMissing'
          : error.code === 'content_transfer_type_unsupported'
            ? 'unsupported'
            : error.code === 'content_transfer_reconciliation_required'
              ? 'reconciliationRequired'
              : error.code === 'content_transfer_provider_rejected'
                ? 'providerRejected'
                : error.code.includes('binding') || error.code === 'content_transfer_source_changed'
                  ? 'bindingInvalid'
                  : 'error';
  return t(`content.ownership.${key}`);
};

const ownershipPanelLabels = (): ContentOwnershipPanelLabels => ({
  title: t('content.ownership.title'),
  currentOwner: t('content.ownership.currentOwner'),
  account: t('content.ownership.account'),
  organization: t('content.ownership.organization'),
  saveKeepsOwner: t('content.ownership.saveKeepsOwner'),
  transferUnavailable: t('content.ownership.transferUnavailable'),
  transferForbidden: t('content.ownership.transferForbidden'),
  transferAction: t('content.ownership.transferAction'),
  dialogTitle: t('content.ownership.dialogTitle'),
  dialogDescription: t('content.ownership.dialogDescription'),
  targetType: t('content.ownership.targetType'),
  search: t('content.ownership.search'),
  searchAction: t('content.ownership.searchAction'),
  loading: t('content.ownership.loading'),
  loadError: t('content.ownership.loadError'),
  noTargets: t('content.ownership.noTargets'),
  previousPage: t('content.ownership.previousPage'),
  nextPage: t('content.ownership.nextPage'),
  confirmation: t('content.ownership.confirmation'),
  accessWarning: t('content.ownership.accessWarning'),
  authorEffect: t('content.ownership.mainserverAuthorEffect'),
  cancel: t('content.ownership.cancel'),
  confirm: t('content.ownership.confirm'),
  transferring: t('content.ownership.transferring'),
  success: t('content.ownership.success'),
  transferError: t('content.ownership.error'),
});

const useMainserverResourcePrincipalControl = (
  contentType: string
): MainserverResourcePrincipalResolution => {
  const params = useParams({ strict: false });
  const contentId = readStringParam(params.contentId, readStringParam(params.id));
  const [resolution, setResolution] = React.useState<MainserverResourcePrincipalResolution>({
    kind: 'loading',
  });

  React.useEffect(() => {
    if (!contentId) {
      setResolution({ kind: 'error' });
      return;
    }

    let active = true;
    setResolution({ kind: 'loading' });

    void getContent(contentId, { contentType })
      .then(async ({ data }) => {
        if (!active) {
          return;
        }

        const principal = data.credentialSource;
        if (principal !== 'organization' && principal !== 'user') {
          setResolution({ kind: 'error' });
          return;
        }

        const detail = await requestMainserverJson<{
          readonly data: Readonly<{
            dataProvider?: Readonly<{ id?: string; name?: string }> | null;
          }>;
        }>({
          url: resolveMainserverDetailUrl(contentType, contentId),
          init: { headers: createMainserverReadHeaders(principal) },
        });
        if (!active) return;
        const currentDataProviderName =
          detail.data.dataProvider?.name?.trim() || detail.data.dataProvider?.id?.trim();
        if (!currentDataProviderName) {
          setResolution({ kind: 'error' });
          return;
        }

        setResolution({
          kind: 'ready',
          control: {
            kind: 'fixed',
            value: principal,
            label:
              data.sourceDataProviderName?.trim() ||
              t(
                principal === 'organization'
                  ? 'content.principal.organization'
                  : 'content.principal.user'
              ),
          },
          owner: {
            displayName: currentDataProviderName,
          },
        });
      })
      .catch(() => {
        if (active) {
          setResolution({ kind: 'error' });
        }
      });

    return () => {
      active = false;
    };
  }, [contentId, contentType]);

  return resolution;
};

const MainserverResourcePrincipalBoundary = ({
  children,
  contentType,
}: Readonly<{
  children: (control: MainserverPrincipalControlModel) => React.ReactNode;
  contentType: string;
}>) => {
  const resolution = useMainserverResourcePrincipalControl(contentType);
  const mutationCapabilities = useMainserverMutationCapabilities();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const contentId = readStringParam(params.contentId, readStringParam(params.id));
  const [resolvedOwner, setResolvedOwner] = React.useState<IamContentOwnershipTarget | null>(null);
  const [transferAuthorized, setTransferAuthorized] = React.useState(false);
  React.useEffect(() => setResolvedOwner(null), [contentId, contentType]);
  const transferSupported = contentType !== 'surveys.survey';
  const transferCapabilityConfirmed = mutationCapabilities.enabledActions.includes(
    'content.transferOwnership'
  );
  const actingPrincipalType =
    resolution.kind === 'ready' ? resolution.control.value : ('user' as const);
  const baseUrl = `/api/v1/mainserver/content-ownership/${encodeURIComponent(
    contentType
  )}/${encodeURIComponent(contentId)}`;
  const loadOwnershipTargets = React.useCallback(
    async ({
      type,
      page,
      pageSize,
      search,
    }: {
      readonly type: 'account' | 'organization';
      readonly page: number;
      readonly pageSize: number;
      readonly search?: string;
    }) => {
      const query = new URLSearchParams({ type, page: String(page), pageSize: String(pageSize) });
      if (search) query.set('q', search);
      const response = await requestMainserverJson<{
        readonly data: readonly IamContentOwnershipTarget[];
        readonly pagination: Readonly<{ total: number }>;
        readonly currentOwner: IamContentOwnershipTarget;
      }>({
        url: `${baseUrl}/targets?${query.toString()}`,
        init: { headers: createMainserverReadHeaders(actingPrincipalType) },
      });
      setResolvedOwner(response.currentOwner);
      return { items: response.data, total: response.pagination.total };
    },
    [actingPrincipalType, baseUrl]
  );
  React.useEffect(() => {
    if (
      resolution.kind !== 'ready' ||
      !contentId ||
      !transferSupported ||
      !transferCapabilityConfirmed
    ) {
      setTransferAuthorized(false);
      return;
    }
    let active = true;
    void loadOwnershipTargets({ type: 'account', page: 1, pageSize: 1 }).then(
      () => active && setTransferAuthorized(true),
      () => active && setTransferAuthorized(false)
    );
    return () => {
      active = false;
    };
  }, [
    contentId,
    loadOwnershipTargets,
    resolution.kind,
    transferCapabilityConfirmed,
    transferSupported,
  ]);
  if (resolution.kind === 'loading') {
    return <StudioLoadingState>{t('content.principal.resourceLoading')}</StudioLoadingState>;
  }
  if (resolution.kind === 'error') {
    return (
      <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
        <AlertDescription>{t('content.principal.resourceUnavailable')}</AlertDescription>
      </Alert>
    );
  }

  const panel = (
    <ContentOwnershipPanel
      currentOwner={
        resolvedOwner
          ? {
              principal: resolvedOwner.principal,
              displayName: resolvedOwner.displayName,
            }
          : resolution.owner
      }
      supported={transferSupported && transferCapabilityConfirmed}
      canTransfer={transferAuthorized}
      labels={ownershipPanelLabels()}
      loadTargets={loadOwnershipTargets}
      resolveTransferError={resolveOwnershipTransferError}
      onTransfer={async (target) => {
        await requestMainserverJson({
          url: `${baseUrl}/transfer`,
          init: {
            method: 'POST',
            headers: createMainserverMutationHeaders(actingPrincipalType),
            body: JSON.stringify({ targetPrincipal: target.principal }),
          },
        });
        setResolvedOwner(target);
        try {
          await requestMainserverJson({
            url: resolveMainserverDetailUrl(contentType, contentId),
            init: { headers: createMainserverReadHeaders(actingPrincipalType) },
          });
        } catch {
          await navigate({ to: '/content' });
        }
      }}
    />
  );
  const saveHint = (
    <p className="text-sm text-muted-foreground">{t('content.ownership.saveKeepsOwner')}</p>
  );
  return (
    <ContentOwnershipSlotsProvider value={{ panel, saveHint }}>
      {children(resolution.control)}
    </ContentOwnershipSlotsProvider>
  );
};

const AppPlaceholderRoutePage = () => (
  <PlaceholderPage
    section={t('shell.sidebar.sections.applications')}
    title={t('shell.sidebar.app')}
  />
);

const ContentListRoutePage = () => {
  const mutationCapabilities = useMainserverMutationCapabilities();
  const resolution = useMainserverPrincipalControl();

  if (resolution.kind === 'unavailable') {
    return (
      <div className="space-y-5">
        <MainserverPrincipalAlert reason={resolution.reason} />
        <ContentListPage enabledMainserverMutationActions={[]} />
      </div>
    );
  }

  return (
    <ContentListPage
      enabledMainserverMutationActions={mutationCapabilities.enabledActions}
      principalControl={resolution.control}
    />
  );
};

const LazyMonitoringOverviewPage = React.lazy(async () => {
  const mod = await import('../routes/monitoring/-overview-page');
  return { default: mod.MonitoringOverviewPage };
});

const MonitoringRoutePage = () => renderLazyPage(LazyMonitoringOverviewPage);

const NewsCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <NewsDetailPage mode="create" principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

const NewsEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="news.article">
      {(principalControl) => <NewsEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

const EventsCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <EventsCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

const EventsEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="events.event-record">
      {(principalControl) => <EventsEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

const GenericItemsCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <GenericItemsCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

const GenericItemsEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="generic-items.generic-item">
      {(principalControl) => <GenericItemsEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

const FaqCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <FaqCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

const FaqEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="faq.faq">
      {(principalControl) => <FaqEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

const CockpitCardsCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <CockpitCardsCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

const CockpitCardsEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="cockpit-cards.cockpit-card">
      {(principalControl) => <CockpitCardsEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

const ProjectsCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <ProjectsCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

const ProjectsEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="projects.project">
      {(principalControl) => <ProjectsEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

const PoiCreateRoutePage = () => {
  const { user } = useAuth();
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => (
        <PoiCreatePage instanceId={user?.instanceId} principalControl={principalControl} />
      )}
    </MainserverPrincipalBoundary>
  );
};

const PoiEditRoutePage = () => {
  const { user } = useAuth();
  return (
    <MainserverResourcePrincipalBoundary contentType="poi.point-of-interest">
      {(principalControl) => (
        <PoiEditPage instanceId={user?.instanceId} principalControl={principalControl} />
      )}
    </MainserverResourcePrincipalBoundary>
  );
};

const SurveyCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <SurveyCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

const SurveyEditRoutePage = () => {
  const mutationCapabilities = useMainserverMutationCapabilities();
  return (
    <MainserverResourcePrincipalBoundary contentType="surveys.survey">
      {(principalControl) => (
        <SurveyEditPage
          canUpdate={mutationCapabilities.enabledActions.includes('surveys.update')}
          principalControl={principalControl}
        />
      )}
    </MainserverResourcePrincipalBoundary>
  );
};

const HelpPlaceholderRoutePage = () => (
  <PlaceholderPage section={t('shell.sidebar.help')} title={t('shell.sidebar.help')} />
);

const SupportPlaceholderRoutePage = () => (
  <PlaceholderPage section={t('shell.sidebar.support')} title={t('shell.sidebar.support')} />
);

const LicensePlaceholderRoutePage = () => (
  <PlaceholderPage section={t('shell.sidebar.license')} title={t('shell.sidebar.license')} />
);

type RenderableRouteComponent<TProps extends object> =
  React.ComponentType<TProps> | React.LazyExoticComponent<React.ComponentType<TProps>>;

type StudioAppRouteBindings = BaseAppRouteBindings & {
  readonly mediaUsage: React.ComponentType;
  readonly newsList: React.ComponentType;
  readonly newsDetail: React.ComponentType;
  readonly newsEditor: React.ComponentType;
  readonly eventsList: React.ComponentType;
  readonly eventsDetail: React.ComponentType;
  readonly eventsEditor: React.ComponentType;
  readonly genericItemsList: React.ComponentType;
  readonly genericItemsDetail: React.ComponentType;
  readonly faqList: React.ComponentType;
  readonly faqDetail: React.ComponentType;
  readonly faqEditor: React.ComponentType;
  readonly cockpitCardsList: React.ComponentType;
  readonly cockpitCardsDetail: React.ComponentType;
  readonly cockpitCardsEditor: React.ComponentType;
  readonly projectsList: React.ComponentType;
  readonly projectsDetail: React.ComponentType;
  readonly projectsEditor: React.ComponentType;
  readonly genericItemsEditor: React.ComponentType;
  readonly poiList: React.ComponentType;
  readonly poiDetail: React.ComponentType;
  readonly poiEditor: React.ComponentType;
  readonly surveysList: React.ComponentType;
  readonly surveysDetail: React.ComponentType;
  readonly surveysEditor: React.ComponentType;
};

const renderLazyPage = <TProps extends object>(
  Component: RenderableRouteComponent<TProps>,
  props?: TProps
) => (
  <React.Suspense
    fallback={<p className="text-sm text-muted-foreground">{t('interfaces.messages.loading')}</p>}
  >
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
  content: ContentListRoutePage,
  contentCreate: ContentTypePickerPage,
  contentDetail: ContentDetailRoutePage,
  mediaUsage: MediaUsagePage,
  newsList: ContentListRoutePage,
  newsDetail: NewsEditRoutePage,
  newsEditor: NewsCreateRoutePage,
  eventsList: ContentListRoutePage,
  eventsDetail: EventsEditRoutePage,
  eventsEditor: EventsCreateRoutePage,
  genericItemsList: ContentListRoutePage,
  genericItemsDetail: GenericItemsEditRoutePage,
  genericItemsEditor: GenericItemsCreateRoutePage,
  faqList: FaqListPage,
  faqDetail: FaqEditRoutePage,
  faqEditor: FaqCreateRoutePage,
  cockpitCardsList: CockpitCardsListPage,
  cockpitCardsDetail: CockpitCardsEditRoutePage,
  cockpitCardsEditor: CockpitCardsCreateRoutePage,
  projectsList: ProjectsListPage,
  projectsDetail: ProjectsEditRoutePage,
  projectsEditor: ProjectsCreateRoutePage,
  poiList: ContentListRoutePage,
  poiDetail: PoiEditRoutePage,
  poiEditor: PoiCreateRoutePage,
  surveysList: ContentListRoutePage,
  surveysDetail: SurveyEditRoutePage,
  surveysEditor: SurveyCreateRoutePage,
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
