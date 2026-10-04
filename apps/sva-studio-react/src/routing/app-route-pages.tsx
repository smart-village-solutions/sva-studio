import { CategoriesPage, type CategoryDataTypeOption } from '@sva/plugin-categories';
import { CockpitCardsCreatePage, CockpitCardsEditPage } from '@sva/plugin-cockpit-cards';
import { EventsCreatePage, EventsEditPage } from '@sva/plugin-events';
import { FaqCreatePage, FaqEditPage } from '@sva/plugin-faq';
import { GenericItemsCreatePage, GenericItemsEditPage } from '@sva/plugin-generic-items';
import { NewsDetailPage, NewsEditPage } from '@sva/plugin-news';
import { PoiCreatePage, PoiEditPage } from '@sva/plugin-poi';
import { ProjectsCreatePage, ProjectsEditPage } from '@sva/plugin-projects';
import { SurveyCreatePage, SurveyEditPage } from '@sva/plugin-surveys';
import { StudioLoadingState } from '@sva/studio-ui-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMainserverMutationCapabilities } from '../hooks/use-mainserver-mutation-capabilities';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { t } from '../i18n';
import { studioBuildTimeRegistry } from '../lib/plugins';
import { useAuth } from '../providers/auth-provider';
import { ContentListPage } from '../routes/content/-content-list-page';
import {
  MainserverPrincipalAlert,
  MainserverPrincipalBoundary,
  useMainserverPrincipalControl,
} from './mainserver-principal-control';
import { MainserverResourcePrincipalBoundary } from './mainserver-resource-principal-boundary';

export const CategoriesRoutePage = () => {
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

export const ContentListRoutePage = () => {
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

export const NewsCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <NewsDetailPage mode="create" principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

export const NewsEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="news.article">
      {(principalControl) => <NewsEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

export const EventsCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <EventsCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

export const EventsEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="events.event-record">
      {(principalControl) => <EventsEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

export const GenericItemsCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <GenericItemsCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

export const GenericItemsEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="generic-items.generic-item">
      {(principalControl) => <GenericItemsEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

export const FaqCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <FaqCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

export const FaqEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="faq.faq">
      {(principalControl) => <FaqEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

export const CockpitCardsCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <CockpitCardsCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

export const CockpitCardsEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="cockpit-cards.cockpit-card">
      {(principalControl) => <CockpitCardsEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

export const ProjectsCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <ProjectsCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

export const ProjectsEditRoutePage = () => {
  return (
    <MainserverResourcePrincipalBoundary contentType="projects.project">
      {(principalControl) => <ProjectsEditPage principalControl={principalControl} />}
    </MainserverResourcePrincipalBoundary>
  );
};

export const PoiCreateRoutePage = () => {
  const { user } = useAuth();
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => (
        <PoiCreatePage instanceId={user?.instanceId} principalControl={principalControl} />
      )}
    </MainserverPrincipalBoundary>
  );
};

export const PoiEditRoutePage = () => {
  const { user } = useAuth();
  return (
    <MainserverResourcePrincipalBoundary contentType="poi.point-of-interest">
      {(principalControl) => (
        <PoiEditPage instanceId={user?.instanceId} principalControl={principalControl} />
      )}
    </MainserverResourcePrincipalBoundary>
  );
};

export const SurveyCreateRoutePage = () => {
  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => <SurveyCreatePage principalControl={principalControl} />}
    </MainserverPrincipalBoundary>
  );
};

export const SurveyEditRoutePage = () => {
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
