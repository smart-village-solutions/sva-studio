import {
  geocodeMapAddressHandler,
  getMapGeocodingConfigHandler,
  reverseGeocodeMapCoordinatesHandler,
  suggestMapAddressesHandler,
} from './map-geocoding-api.js';

const ROUTES = {
  '/api/v1/iam/map-geocoding/config': { GET: getMapGeocodingConfigHandler },
  '/api/v1/iam/map-geocoding/suggest': { POST: suggestMapAddressesHandler },
  '/api/v1/iam/map-geocoding/geocode': { POST: geocodeMapAddressHandler },
  '/api/v1/iam/map-geocoding/reverse': { POST: reverseGeocodeMapCoordinatesHandler },
} as const;

type RoutePath = keyof typeof ROUTES;

const isRoutePath = (value: string): value is RoutePath => value in ROUTES;

export const dispatchMapGeocodingRequest = async (request: Request): Promise<Response | null> => {
  const pathname = new URL(request.url).pathname;
  if (!isRoutePath(pathname)) {
    return null;
  }

  const handler = (ROUTES[pathname] as Partial<Record<string, (request: Request) => Promise<Response>>>)[request.method];
  if (!handler) {
    return new Response(null, { status: 405 });
  }

  return handler(request);
};
