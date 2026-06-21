export type MapGeocodingProvider = 'geoapify' | 'custom';

export type MapGeocodingCoordinates = Readonly<{
  latitude: number;
  longitude: number;
}>;

export type MapGeocodingAddressInput = Readonly<{
  query?: string;
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
}>;

export type MapGeocodingFeature = Readonly<{
  label: string;
  coordinates: MapGeocodingCoordinates;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  source: MapGeocodingProvider;
}>;

export type MapGeocodingRuntimeConfig = Readonly<{
  provider: MapGeocodingProvider;
  styleUrl: string;
  autocompleteEnabled: boolean;
  geocodeEnabled: boolean;
  reverseGeocodeEnabled: boolean;
  killSwitchEnabled: boolean;
}>;
