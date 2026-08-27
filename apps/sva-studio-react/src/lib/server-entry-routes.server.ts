import type { RouteDispatcher, RouteDispatchDescriptor } from './server-entry-types';

const lazyDispatcher = (
  load: () => Promise<RouteDispatcher>
): RouteDispatchDescriptor['getDispatcher'] => {
  let promise: Promise<RouteDispatcher> | null = null;
  return async () => {
    promise ??= load();
    return promise;
  };
};

export const serverEntryRouteDispatchers: readonly RouteDispatchDescriptor[] = [
  {
    label: 'mainserver content ownership',
    getDispatcher: lazyDispatcher(() =>
      import('./mainserver-content-ownership-api.server').then(
        (module) => module.dispatchMainserverContentOwnershipRequest
      )
    ),
  },
  {
    label: 'mainserver news',
    getDispatcher: lazyDispatcher(() =>
      import('./mainserver-news-api.server').then((module) => module.dispatchMainserverNewsRequest)
    ),
  },
  {
    label: 'mainserver events',
    getDispatcher: lazyDispatcher(() =>
      import('./mainserver-events-api.server').then(
        (module) => module.dispatchMainserverEventsRequest
      )
    ),
  },
  {
    label: 'mainserver poi',
    getDispatcher: lazyDispatcher(() =>
      import('./mainserver-poi-api.server').then((module) => module.dispatchMainserverPoiRequest)
    ),
  },
  {
    label: 'mainserver surveys',
    getDispatcher: lazyDispatcher(() =>
      import('./mainserver-surveys-api.server').then(
        (module) => module.dispatchMainserverSurveysRequest
      )
    ),
  },
  {
    label: 'mainserver generic items',
    getDispatcher: lazyDispatcher(() =>
      import('./mainserver-generic-items-api.server').then(
        (module) => module.dispatchMainserverGenericItemsRequest
      )
    ),
  },
  {
    label: 'mainserver metadata',
    getDispatcher: lazyDispatcher(() =>
      import('./mainserver-metadata-api.server').then(
        (module) => module.dispatchMainserverMetadataRequest
      )
    ),
  },
  {
    label: 'aggregated content list',
    getDispatcher: lazyDispatcher(() =>
      import('./iam-content-list-api.server').then(
        (module) => module.dispatchAggregatedContentListRequest
      )
    ),
  },
  {
    label: 'map geocoding',
    getDispatcher: lazyDispatcher(() =>
      import('./map-geocoding-api.server').then((module) => module.dispatchMapGeocodingRequest)
    ),
  },
  {
    label: 'studio changelog',
    getDispatcher: lazyDispatcher(() =>
      import('./studio-changelog-api.server').then(
        (module) => module.dispatchStudioChangelogRequest
      )
    ),
  },
  {
    label: 'user documentation',
    getDispatcher: lazyDispatcher(() =>
      import('./user-documentation-api.server').then(
        (module) => module.dispatchUserDocumentationRequest
      )
    ),
  },
];
