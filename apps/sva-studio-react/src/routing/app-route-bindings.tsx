import { type AppRouteBindings as BaseAppRouteBindings } from '@sva/routing';
import { CockpitCardsListPage } from '@sva/plugin-cockpit-cards';
import { FaqListPage } from '@sva/plugin-faq';
import { ProjectsListPage } from '@sva/plugin-projects';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import React from 'react';
import {
  ContentEditorPage,
  normalizeContentEditorTab,
} from '../routes/content/-content-editor-page';
import { ContentTypePickerPage } from '../routes/content/-content-type-picker-page';
import { coreAppRouteBindings } from './app-route-bindings.core';
import { readStringParam } from './mainserver-resource-principal';
import {
  CategoriesRoutePage,
  ContentListRoutePage,
  NewsCreateRoutePage,
  NewsEditRoutePage,
  EventsCreateRoutePage,
  EventsEditRoutePage,
  GenericItemsCreateRoutePage,
  GenericItemsEditRoutePage,
  FaqCreateRoutePage,
  FaqEditRoutePage,
  CockpitCardsCreateRoutePage,
  CockpitCardsEditRoutePage,
  ProjectsCreateRoutePage,
  ProjectsEditRoutePage,
  PoiCreateRoutePage,
  PoiEditRoutePage,
  SurveyCreateRoutePage,
  SurveyEditRoutePage,
} from './app-route-pages';

export {
  resolveMainserverPrincipalControl,
  type MainserverPrincipalResolution,
} from './mainserver-principal-control';

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
