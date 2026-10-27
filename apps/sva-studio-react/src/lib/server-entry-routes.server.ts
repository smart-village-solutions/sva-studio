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
    label: 'instance provisioner control plane',
    getDispatcher: lazyDispatcher(() =>
      import('./instance-provisioner-proxy.server').then(
        (module) => module.dispatchInstanceProvisionerRequest
      )
    ),
  },
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
    label: 'external interface administration',
    getDispatcher: lazyDispatcher(() =>
      import('./interfaces-api-http.server').then((module) => module.dispatchInterfacesApiRequest)
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

const dispatchServerEntryRoute = async (
  request: Request,
  logServerEntryDebug: (message: string, meta: Record<string, unknown>) => Promise<void>,
  route: RouteDispatchDescriptor
): Promise<Response | null> => {
  const dispatch = await route.getDispatcher();
  const response = await dispatch(request);
  if (!response) return null;
  await logServerEntryDebug(`Server entry ${route.label} route dispatched`, {
    status: response.status,
  });
  return response;
};

export const dispatchKnownServerEntryRoutes = async (
  request: Request,
  logServerEntryDebug: (message: string, meta: Record<string, unknown>) => Promise<void>
): Promise<Response | null> => {
  for (const route of serverEntryRouteDispatchers) {
    const response = await dispatchServerEntryRoute(request, logServerEntryDebug, route);
    if (response) return response;
  }
  return null;
};
