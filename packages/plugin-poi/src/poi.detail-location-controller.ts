import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { MapGeocodingFeature } from '@sva/plugin-sdk';

import type { PoiDetailFormValues } from './poi.detail-form.js';
import { getCurrentAddress, getCurrentLocation, joinStreetParts } from './poi.detail-location-shared.js';
import { getMapGeocodingConfig } from './poi.map-geocoding-client.js';

export const usePoiDetailLocationController = () => {
  const { control, setValue } = useFormContext<PoiDetailFormValues>();
  const address = useWatch({ control, name: 'content.addresses.0' });
  const location = useWatch({ control, name: 'content.location' });
  const [isGeocodingEnabled, setIsGeocodingEnabled] = React.useState(true);
  const [isReverseGeocodingEnabled, setIsReverseGeocodingEnabled] = React.useState(true);
  const [isMapEnabled, setIsMapEnabled] = React.useState(true);
  const [mapStyleUrl, setMapStyleUrl] = React.useState('');
  const [mapError, setMapError] = React.useState<string | null>(null);

  const currentAddress = getCurrentAddress(address);
  const currentLocation = getCurrentLocation(location);

  React.useEffect(() => {
    let active = true;
    void getMapGeocodingConfig()
      .then((config) => {
        if (!active) {
          return;
        }
        setIsGeocodingEnabled(config.geocodeEnabled);
        setIsReverseGeocodingEnabled(config.reverseGeocodeEnabled);
        setMapStyleUrl(config.styleUrl);
        setIsMapEnabled(config.killSwitchEnabled === false && config.styleUrl.length > 0);
      })
      .catch(() => {
        if (active) {
          setIsGeocodingEnabled(false);
          setIsReverseGeocodingEnabled(false);
          setIsMapEnabled(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const setCoordinateValue = React.useCallback(
    (axis: 'latitude' | 'longitude', value: string) => {
      setValue(`content.addresses.0.geoLocation.${axis}`, value, { shouldDirty: true });
      setValue(`content.location.geoLocation.${axis}`, value, { shouldDirty: true });
      setMapError(null);
    },
    [setValue],
  );

  const applySearchResult = React.useCallback(
    (result: MapGeocodingFeature) => {
      const latitude = String(result.coordinates.latitude);
      const longitude = String(result.coordinates.longitude);
      setValue('content.addresses.0.geoLocation.latitude', latitude, { shouldDirty: true });
      setValue('content.addresses.0.geoLocation.longitude', longitude, { shouldDirty: true });
      setValue('content.location.geoLocation.latitude', latitude, { shouldDirty: true });
      setValue('content.location.geoLocation.longitude', longitude, { shouldDirty: true });
      setMapError(null);
    },
    [setValue],
  );

  const applyReverseGeocodeResult = React.useCallback(
    (result: MapGeocodingFeature) => {
      setValue('content.addresses.0.street', joinStreetParts(result.street, result.houseNumber), { shouldDirty: true });
      setValue('content.addresses.0.zip', result.postalCode ?? '', { shouldDirty: true });
      setValue('content.addresses.0.city', result.city ?? '', { shouldDirty: true });
      setMapError(null);
    },
    [setValue],
  );

  return {
    applySearchResult,
    applyReverseGeocodeResult,
    currentAddress,
    currentLocation,
    isGeocodingEnabled,
    isReverseGeocodingEnabled,
    isMapEnabled,
    mapError,
    mapStyleUrl,
    setCoordinateValue,
    setMapError,
    setValue,
  };
};
