import type { AppRouteBindings } from '@sva/routing';

import NotFound from '../components/NotFound';
import { coreAppRouteBindings } from './app-route-bindings.core';

// Host-owned legacy content URLs remain guarded by @sva/routing, but must not
// load a standard Studio plugin page or its data in the SSF distribution.
export const appRouteBindings = {
  ...coreAppRouteBindings,
  content: NotFound,
  contentCreate: NotFound,
  contentDetail: NotFound,
  categories: NotFound,
  newsList: NotFound,
  newsDetail: NotFound,
  newsEditor: NotFound,
  eventsList: NotFound,
  eventsDetail: NotFound,
  eventsEditor: NotFound,
  genericItemsList: NotFound,
  genericItemsDetail: NotFound,
  genericItemsEditor: NotFound,
  faqList: NotFound,
  faqDetail: NotFound,
  faqEditor: NotFound,
  cockpitCardsList: NotFound,
  cockpitCardsDetail: NotFound,
  cockpitCardsEditor: NotFound,
  projectsList: NotFound,
  projectsDetail: NotFound,
  projectsEditor: NotFound,
  poiList: NotFound,
  poiDetail: NotFound,
  poiEditor: NotFound,
} satisfies AppRouteBindings;
