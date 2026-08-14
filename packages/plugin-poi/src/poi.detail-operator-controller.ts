import * as React from 'react';
import type { MapGeocodingFeature } from '@sva/plugin-sdk';
import { useFormContext, useWatch } from 'react-hook-form';

import type { PoiDetailFormValues } from './poi.detail-form.js';
import {
  createPoiOperatorGeocodingAddress,
  getPoiOperatorFieldValues,
  hasPoiOperatorGeocodingInput,
  mergePoiOperatorWebUrl,
  type PoiOperatorTextFieldPath,
  type PoiOperatorWebUrlUpdate,
} from './poi.detail-operator-shared.js';
import { parseCoordinate } from './poi.location-map.shared.js';
import {
  geocodeMapAddress,
  getMapGeocodingConfig,
  reverseMapCoordinates,
} from './poi.map-geocoding-client.js';
import { resolvePoiMapGeocodingMessageKey } from './poi.map-geocoding-messages.js';

type Translate = (key: string) => string;

const usePoiOperatorMapConfig = () => {
  const [geocodingEnabled, setGeocodingEnabled] = React.useState(true);
  const [reverseGeocodingEnabled, setReverseGeocodingEnabled] = React.useState(true);
  const [mapEnabled, setMapEnabled] = React.useState(true);
  const [mapStyleUrl, setMapStyleUrl] = React.useState('');

  React.useEffect(() => {
    let active = true;
    void getMapGeocodingConfig()
      .then((config) => {
        if (!active) return;
        setGeocodingEnabled(config.geocodeEnabled);
        setReverseGeocodingEnabled(config.reverseGeocodeEnabled);
        setMapStyleUrl(config.styleUrl);
        setMapEnabled(config.killSwitchEnabled === false && config.styleUrl.length > 0);
      })
      .catch(() => {
        if (!active) return;
        setGeocodingEnabled(false);
        setReverseGeocodingEnabled(false);
        setMapEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { geocodingEnabled, mapEnabled, mapStyleUrl, reverseGeocodingEnabled };
};

const usePoiOperatorFormState = () => {
  const {
    control,
    clearErrors,
    formState: { errors },
    setValue,
  } = useFormContext<PoiDetailFormValues>();
  const operator = useWatch({ control, name: 'content.operator' });
  const values = getPoiOperatorFieldValues(operator);
  const [mapError, setMapError] = React.useState<string | null>(null);

  const setTextValue = React.useCallback(
    (path: PoiOperatorTextFieldPath, value: string) => setValue(path, value, { shouldDirty: true }),
    [setValue]
  );
  const updateWebUrl = React.useCallback(
    (update: PoiOperatorWebUrlUpdate) => {
      clearErrors('content.operator.contact.webUrls.0.url');
      setValue(
        'content.operator.contact.webUrls',
        [mergePoiOperatorWebUrl(operator?.contact?.webUrls?.[0], update)],
        {
          shouldDirty: true,
        }
      );
    },
    [clearErrors, operator?.contact?.webUrls, setValue]
  );
  const setCoordinateValue = React.useCallback(
    (axis: 'latitude' | 'longitude', value: string) => {
      setValue(`content.operator.address.geoLocation.${axis}`, value, { shouldDirty: true });
      setMapError(null);
    },
    [setValue]
  );
  const applySearchResult = React.useCallback(
    (result: MapGeocodingFeature) => {
      setValue(
        'content.operator.address.geoLocation.latitude',
        String(result.coordinates.latitude),
        { shouldDirty: true }
      );
      setValue(
        'content.operator.address.geoLocation.longitude',
        String(result.coordinates.longitude),
        { shouldDirty: true }
      );
      setMapError(null);
    },
    [setValue]
  );
  const applyReverseGeocodeResult = React.useCallback(
    (result: MapGeocodingFeature) => {
      const street = [result.street, result.houseNumber].filter(Boolean).join(' ');
      setValue('content.operator.address.street', street, { shouldDirty: true });
      setValue('content.operator.address.zip', result.postalCode ?? '', { shouldDirty: true });
      setValue('content.operator.address.city', result.city ?? '', { shouldDirty: true });
      setMapError(null);
    },
    [setValue]
  );

  return {
    applyReverseGeocodeResult,
    applySearchResult,
    coordinateError:
      errors.content?.operator?.address?.geoLocation?.latitude ??
      errors.content?.operator?.address?.geoLocation?.longitude,
    mapError,
    setCoordinateValue,
    setMapError,
    setTextValue,
    updateWebUrl,
    urlError: errors.content?.operator?.contact?.webUrls?.[0]?.url,
    values,
  };
};

type PoiOperatorFormState = ReturnType<typeof usePoiOperatorFormState>;

const usePoiOperatorGeocoding = ({
  applyReverseGeocodeResult,
  applySearchResult,
  geocodingEnabled,
  pt,
  reverseGeocodingEnabled,
  setMapError,
  values,
}: Pick<
  PoiOperatorFormState,
  'applyReverseGeocodeResult' | 'applySearchResult' | 'setMapError' | 'values'
> &
  Readonly<{ geocodingEnabled: boolean; reverseGeocodingEnabled: boolean; pt: Translate }>) => {
  const [error, setError] = React.useState<string | null>(null);
  const [geocoding, setGeocoding] = React.useState(false);
  const [reverseGeocoding, setReverseGeocoding] = React.useState(false);
  const latitude = parseCoordinate(values.latitude);
  const longitude = parseCoordinate(values.longitude);
  const addressValues = {
    locationName: values.locationName,
    street: values.street,
    zip: values.zip,
    city: values.city,
  };
  const hasGeocodingInput = hasPoiOperatorGeocodingInput(addressValues);
  const hasReverseGeocodingInput = latitude !== null && longitude !== null;

  const geocode = React.useCallback(async () => {
    if (!geocodingEnabled || !hasGeocodingInput) {
      setError(pt('messages.locationGeocodeDisabled'));
      return;
    }
    setGeocoding(true);
    setError(null);
    try {
      applySearchResult(
        await geocodeMapAddress({ address: createPoiOperatorGeocodingAddress(addressValues) })
      );
      setMapError(null);
    } catch (cause) {
      setError(pt(resolvePoiMapGeocodingMessageKey(cause)));
    } finally {
      setGeocoding(false);
    }
  }, [addressValues, applySearchResult, geocodingEnabled, hasGeocodingInput, pt, setMapError]);

  const reverseGeocode = React.useCallback(async () => {
    if (!reverseGeocodingEnabled || latitude === null || longitude === null) {
      setError(pt('messages.locationGeocodeDisabled'));
      return;
    }
    setReverseGeocoding(true);
    setError(null);
    try {
      applyReverseGeocodeResult(await reverseMapCoordinates({ latitude, longitude }));
      setMapError(null);
    } catch (cause) {
      setError(pt(resolvePoiMapGeocodingMessageKey(cause)));
    } finally {
      setReverseGeocoding(false);
    }
  }, [applyReverseGeocodeResult, latitude, longitude, pt, reverseGeocodingEnabled, setMapError]);

  return {
    error,
    geocode,
    geocoding,
    hasGeocodingInput,
    hasReverseGeocodingInput,
    reverseGeocode,
    reverseGeocoding,
  };
};

export const usePoiDetailOperatorController = (pt: Translate) => {
  const mapConfig = usePoiOperatorMapConfig();
  const form = usePoiOperatorFormState();
  const geocoding = usePoiOperatorGeocoding({
    ...form,
    geocodingEnabled: mapConfig.geocodingEnabled,
    pt,
    reverseGeocodingEnabled: mapConfig.reverseGeocodingEnabled,
  });
  return { ...form, ...geocoding, ...mapConfig };
};

export type PoiDetailOperatorController = ReturnType<typeof usePoiDetailOperatorController>;
