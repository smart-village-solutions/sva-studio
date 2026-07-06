import {
  geocodeHostMapAddress,
  getHostMapGeocodingConfig,
  reverseGeocodeHostCoordinates,
  type MapGeocodingAddressInput,
  type MapGeocodingFeature,
  type MapGeocodingRuntimeConfig,
} from '@sva/plugin-sdk';

let configPromise: Promise<MapGeocodingRuntimeConfig> | null = null;

export const getMapGeocodingConfig = async (): Promise<MapGeocodingRuntimeConfig> => {
  configPromise ??= getHostMapGeocodingConfig().catch((error) => {
    configPromise = null;
    throw error;
  });
  return configPromise;
};

export const geocodeMapAddress = async (input: {
  readonly address: MapGeocodingAddressInput;
}): Promise<MapGeocodingFeature> =>
  geocodeHostMapAddress({
    address: input.address,
  });

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

export const resetMapGeocodingConfigCache = (): void => {
  configPromise = null;
};
