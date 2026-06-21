import {
  getHostMapGeocodingConfig,
  reverseGeocodeHostCoordinates,
  suggestHostMapAddresses,
  type MapGeocodingFeature,
  type MapGeocodingRuntimeConfig,
} from '@sva/plugin-sdk';

export const getMapGeocodingConfig = async (): Promise<MapGeocodingRuntimeConfig> =>
  getHostMapGeocodingConfig();

export const suggestMapAddresses = async (input: {
  readonly query: string;
}): Promise<readonly MapGeocodingFeature[]> =>
  suggestHostMapAddresses({ query: input.query });

export const reverseMapCoordinates = async (input: {
  readonly latitude: number;
  readonly longitude: number;
}): Promise<MapGeocodingFeature> =>
  reverseGeocodeHostCoordinates({
    coordinates: {
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });
