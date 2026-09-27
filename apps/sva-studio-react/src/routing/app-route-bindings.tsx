import { type AppRouteBindings as BaseAppRouteBindings } from '@sva/routing';
import {
  resolveUserDisplayName,
  type IamContentOwnerPrincipal,
  type IamContentOwnershipTarget,
  type IamOrganizationContextOption,
} from '@sva/core';
import { CategoriesPage, type CategoryDataTypeOption } from '@sva/plugin-categories';
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
import { studioBuildTimeRegistry } from '../lib/plugins';
import { getContent } from '../lib/iam-api';
import { useAuth } from '../providers/auth-provider';
import {
  ContentEditorPage,
  normalizeContentEditorTab,
} from '../routes/content/-content-editor-page';
import { ContentListPage } from '../routes/content/-content-list-page';
import { ContentTypePickerPage } from '../routes/content/-content-type-picker-page';
import { coreAppRouteBindings } from './app-route-bindings.core';

const readStringParam = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const EMPTY_ORGANIZATIONS: readonly IamOrganizationContextOption[] = [];

const CategoriesRoutePage = () => {
  const mutationCapabilities = useMainserverMutationCapabilities();
  const organizationContext = useOrganizationContext();
  const dataTypeOptions: readonly CategoryDataTypeOption[] = [
    ...studioBuildTimeRegistry.mainserverGenericTypeRegistry.entries(),
  ].map(([value, contentType]) => {
    const definition = studioBuildTimeRegistry.contentTypes.find(
      (candidate) => candidate.contentType === contentType
    );
    return {
      value,
      label: definition?.titleKey
        ? t(definition.titleKey)
        : (definition?.displayName ?? contentType),
    };
  });
  if (organizationContext.isLoading || organizationContext.isUpdating)
    return <StudioLoadingState>{t('content.principal.contextLoading')}</StudioLoadingState>;
  if (organizationContext.context === null || organizationContext.error !== null)
    return (
      <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
        <AlertDescription>{t('content.principal.contextUnavailable')}</AlertDescription>
      </Alert>
    );
  return (
    <CategoriesPage
      key={organizationContext.context?.activeOrganizationId ?? 'personal'}
      dataTypeOptions={dataTypeOptions}
      enabledMutationActions={mutationCapabilities.enabledActions}
      mutationActionsError={mutationCapabilities.error !== null}
      mutationActionsLoading={mutationCapabilities.isLoading}
      onReloadMutationActions={mutationCapabilities.reload}
    />
  );
};

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

type MainserverResolvedOwner = Readonly<{
  principal?: IamContentOwnerPrincipal;
  principalResolution: 'resolved' | 'unresolved' | 'failed';
  displayName: string;
}>;

const resolveMainserverDetailUrl = (contentType: string, contentId: string): string => {
  const collections: Readonly<Record<string, string>> = {
    'news.article': 'news',
    'events.event-record': 'events',
    'poi.point-of-interest': 'poi',
    'generic-items.generic-item': 'generic-items',
    'faq.faq': 'faqs',
    'cockpit-cards.cockpit-card': 'cockpit-cards',
    'projects.project': 'projects',
    'surveys.survey': 'surveys',
  };
  const collection = collections[contentType] ?? 'generic-items';
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
          : error.code === 'content_transfer_target_verification_failed'
            ? 'targetVerificationFailed'
            : error.code === 'content_transfer_type_unsupported'
              ? 'unsupported'
              : error.code === 'content_transfer_reconciliation_required'
                ? 'reconciliationRequired'
                : error.code === 'content_transfer_provider_rejected'
                  ? 'providerRejected'
                  : error.code.includes('binding') ||
                      error.code === 'content_transfer_source_changed'
                    ? 'bindingInvalid'
                    : 'error';
  return t(`content.ownership.${key}`);
};

const ownershipPanelLabels = (): ContentOwnershipPanelLabels => ({
  title: t('content.ownership.title'),
  currentOwner: t('content.ownership.currentOwner'),
  ownerUnresolved: t('content.ownership.ownerUnresolved'),
  ownerResolutionFailed: t('content.ownership.ownerResolutionFailed'),
  account: t('content.ownership.account'),
  organization: t('content.ownership.organization'),
  verificationRequired: t('content.ownership.verificationRequired'),
  saveKeepsOwner: t('content.ownership.saveKeepsOwner'),
  transferUnavailable: t('content.ownership.transferUnavailable'),
  transferForbidden: t('content.ownership.transferForbidden'),
  transferAction: t('content.ownership.transferAction'),
  dialogTitle: t('content.ownership.dialogTitle'),
  dialogDescription: t('content.ownership.dialogDescription'),
  targetOwner: t('content.ownership.targetOwner'),
  targetPlaceholder: t('content.ownership.targetPlaceholder'),
  search: t('content.ownership.search'),
  loading: t('content.ownership.loading'),
  loadError: t('content.ownership.loadError'),
  noTargets: t('content.ownership.noTargets'),
  refineSearch: t('content.ownership.refineSearch'),
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
  const contentId = readStringParam(params.contentId, readStringParam(params.id)) || undefined;
  const editorPrincipalResolution = useMainserverPrincipalControl();
  const editorPrincipal =
    editorPrincipalResolution.kind === 'ready'
      ? editorPrincipalResolution.control.value
      : undefined;
  const editorPrincipalLabel =
    editorPrincipalResolution.kind === 'ready'
      ? editorPrincipalResolution.control.kind === 'fixed'
        ? editorPrincipalResolution.control.label
        : editorPrincipalResolution.control.options.find(
            (option) => option.value === editorPrincipalResolution.control.value
          )?.label
      : undefined;
  const editorPrincipalFallback = React.useRef({
    principal: editorPrincipal,
    label: editorPrincipalLabel,
  });
  if (editorPrincipal) {
    editorPrincipalFallback.current = {
      principal: editorPrincipal,
      label: editorPrincipalLabel,
    };
  }
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

        const principal =
          data.credentialSource === 'organization' || data.credentialSource === 'user'
            ? data.credentialSource
            : editorPrincipalFallback.current.principal;
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
              editorPrincipalFallback.current.label ||
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
  }, [contentId, contentType, editorPrincipal]);

  return resolution;
};

const MainserverResourcePrincipalBoundary = ({
  children,
  contentType,
}: Readonly<{
  children: (control: MainserverPrincipalControlModel) => React.ReactNode;
  contentType: string;
}>) => {
  const { user } = useAuth();
  const resolution = useMainserverResourcePrincipalControl(contentType);
  const mutationCapabilities = useMainserverMutationCapabilities();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const contentId = readStringParam(params.contentId, readStringParam(params.id));
  const [resolvedOwner, setResolvedOwner] = React.useState<MainserverResolvedOwner | null>(null);
  const [transferAuthorized, setTransferAuthorized] = React.useState(false);
  React.useEffect(() => setResolvedOwner(null), [contentId, contentType]);
  const transferSupported = contentId !== undefined && contentType !== 'surveys.survey';
  const transferCapabilityConfirmed = mutationCapabilities.enabledActions.includes(
    'content.transferOwnership'
  );
  const actingPrincipalType =
    resolution.kind === 'ready' ? resolution.control.value : ('user' as const);
  const baseUrl = contentId
    ? `/api/v1/mainserver/content-ownership/${encodeURIComponent(
        contentType
      )}/${encodeURIComponent(contentId)}`
    : undefined;
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
      if (!baseUrl) throw new Error('content_transfer_content_id_missing');
      const query = new URLSearchParams({ type, page: String(page), pageSize: String(pageSize) });
      if (search) query.set('q', search);
      const response = await requestMainserverJson<{
        readonly data: readonly IamContentOwnershipTarget[];
        readonly pagination: Readonly<{ total: number }>;
        readonly currentOwner: MainserverResolvedOwner;
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
    if (resolution.kind !== 'ready' || !contentId) {
      setTransferAuthorized(false);
      return;
    }
    setTransferAuthorized(false);
    let active = true;
    void requestMainserverJson<{
      readonly data: Readonly<{ canTransfer: boolean }>;
      readonly currentOwner: MainserverResolvedOwner;
    }>({
      url: `${baseUrl}/authorization`,
      init: { headers: createMainserverReadHeaders(actingPrincipalType) },
    }).then(
      (response) => {
        if (!active) return;
        setResolvedOwner(response.currentOwner);
        setTransferAuthorized(response.data.canTransfer);
      },
      () => active && setTransferAuthorized(false)
    );
    return () => {
      active = false;
    };
  }, [contentId, actingPrincipalType, baseUrl, resolution.kind, user?.id]);
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
              principalResolution: resolvedOwner.principalResolution,
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
        if (!baseUrl || !contentId) throw new Error('content_transfer_content_id_missing');
        await requestMainserverJson({
          url: `${baseUrl}/transfer`,
          init: {
            method: 'POST',
            headers: createMainserverMutationHeaders(actingPrincipalType),
            body: JSON.stringify({ targetPrincipal: target.principal }),
          },
        });
        try {
          const detail = await requestMainserverJson<{
            readonly data: Readonly<{
              dataProvider?: Readonly<{ id?: string; name?: string }> | null;
            }>;
          }>({
            url: resolveMainserverDetailUrl(contentType, contentId),
            init: { headers: createMainserverReadHeaders(actingPrincipalType) },
          });
          const confirmedName =
            detail.data.dataProvider?.name?.trim() || detail.data.dataProvider?.id?.trim();
          if (!confirmedName) throw new Error('content_transfer_owner_missing');
          setResolvedOwner({
            principal: target.principal,
            principalResolution: 'resolved',
            displayName: confirmedName,
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

export const appRouteBindings: StudioAppRouteBindings = {
  ...coreAppRouteBindings,
  content: ContentListRoutePage,
  contentCreate: ContentTypePickerPage,
  contentDetail: ContentDetailRoutePage,
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
  categories: CategoriesRoutePage,
};
