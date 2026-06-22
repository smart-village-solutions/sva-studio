import * as React from 'react';
import type { MapGeocodingFeature } from '@sva/plugin-sdk';
import { Alert, AlertDescription, Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { PoiLocationMap } from './poi.location-map.js';
import { geocodeMapAddress, getMapGeocodingConfig, reverseMapCoordinates } from './poi.map-geocoding-client.js';
import { parseCoordinate } from './poi.location-map.shared.js';
import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';

export function PoiDetailOperatorTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const {
    control,
    clearErrors,
    formState: { errors },
    setValue,
  } = useFormContext<PoiDetailFormValues>();
  const operator = useWatch({ control, name: 'content.operator' }) ?? {};
  const operatorWebUrl = operator.contact?.webUrls?.[0];
  const operatorUrlError = errors.content?.operator?.contact?.webUrls?.[0]?.url;
  const operatorLatitudeError = errors.content?.operator?.address?.geoLocation?.latitude;
  const operatorLongitudeError = errors.content?.operator?.address?.geoLocation?.longitude;
  const operatorGeoLocationError = operatorLatitudeError ?? operatorLongitudeError;
  const [isGeocodingEnabled, setIsGeocodingEnabled] = React.useState(true);
  const [isReverseGeocodingEnabled, setIsReverseGeocodingEnabled] = React.useState(true);
  const [isMapEnabled, setIsMapEnabled] = React.useState(true);
  const [mapStyleUrl, setMapStyleUrl] = React.useState('');
  const [mapError, setMapError] = React.useState<string | null>(null);
  const [geocodingError, setGeocodingError] = React.useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = React.useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = React.useState(false);
  const operatorLocationName = operator.address?.addition ?? '';
  const operatorStreet = operator.address?.street ?? '';
  const operatorZip = operator.address?.zip ?? '';
  const operatorCity = operator.address?.city ?? '';
  const operatorLatitude = operator.address?.geoLocation?.latitude ?? '';
  const operatorLongitude = operator.address?.geoLocation?.longitude ?? '';
  const hasGeocodingInput =
    operatorLocationName.trim().length > 0 ||
    operatorStreet.trim().length > 0 ||
    operatorZip.trim().length > 0 ||
    operatorCity.trim().length > 0;
  const parsedLatitude = parseCoordinate(operatorLatitude);
  const parsedLongitude = parseCoordinate(operatorLongitude);
  const hasReverseGeocodingInput = parsedLatitude !== null && parsedLongitude !== null;

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

  const updateOperatorWebUrl = (nextValue: Readonly<{ url?: string; description?: string }>) => {
    clearErrors('content.operator.contact.webUrls.0.url');
    setValue(
      'content.operator.contact.webUrls',
      [
        {
          url: nextValue.url ?? operatorWebUrl?.url ?? '',
          description: nextValue.description ?? operatorWebUrl?.description ?? '',
        },
      ],
      { shouldDirty: true },
    );
  };

  const setOperatorCoordinateValue = React.useCallback(
    (axis: 'latitude' | 'longitude', value: string) => {
      setValue(`content.operator.address.geoLocation.${axis}`, value, { shouldDirty: true });
      setMapError(null);
    },
    [setValue],
  );

  const applyOperatorSearchResult = React.useCallback(
    (result: MapGeocodingFeature) => {
      setValue('content.operator.address.geoLocation.latitude', String(result.coordinates.latitude), { shouldDirty: true });
      setValue('content.operator.address.geoLocation.longitude', String(result.coordinates.longitude), { shouldDirty: true });
      setMapError(null);
    },
    [setValue],
  );

  const applyOperatorReverseGeocodeResult = React.useCallback(
    (result: MapGeocodingFeature) => {
      setValue('content.operator.address.street', [result.street, result.houseNumber].filter(Boolean).join(' '), {
        shouldDirty: true,
      });
      setValue('content.operator.address.zip', result.postalCode ?? '', { shouldDirty: true });
      setValue('content.operator.address.city', result.city ?? '', { shouldDirty: true });
      setMapError(null);
    },
    [setValue],
  );

  const handleOperatorGeocode = React.useCallback(async () => {
    const address = {
      query: operatorLocationName.trim() || undefined,
      street: operatorStreet.trim() || undefined,
      zip: operatorZip.trim() || undefined,
      city: operatorCity.trim() || undefined,
      country: 'Deutschland',
    };

    if (!isGeocodingEnabled || !hasGeocodingInput) {
      setGeocodingError(pt('messages.locationGeocodeError'));
      return;
    }

    setIsGeocoding(true);
    setGeocodingError(null);
    try {
      const result = await geocodeMapAddress({ address });
      applyOperatorSearchResult(result);
      setMapError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setGeocodingError(message === 'no_result' ? pt('messages.locationGeocodeEmpty') : pt('messages.locationGeocodeError'));
    } finally {
      setIsGeocoding(false);
    }
  }, [
    applyOperatorSearchResult,
    hasGeocodingInput,
    isGeocodingEnabled,
    operatorCity,
    operatorLocationName,
    operatorStreet,
    operatorZip,
    pt,
  ]);

  const handleOperatorReverseGeocode = React.useCallback(async () => {
    if (!isReverseGeocodingEnabled || parsedLatitude === null || parsedLongitude === null) {
      setGeocodingError(pt('messages.locationGeocodeError'));
      return;
    }

    setIsReverseGeocoding(true);
    setGeocodingError(null);
    try {
      const result = await reverseMapCoordinates({
        latitude: parsedLatitude,
        longitude: parsedLongitude,
      });
      applyOperatorReverseGeocodeResult(result);
      setMapError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setGeocodingError(message === 'no_result' ? pt('messages.locationGeocodeEmpty') : pt('messages.locationGeocodeError'));
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [applyOperatorReverseGeocodeResult, isReverseGeocodingEnabled, parsedLatitude, parsedLongitude, pt]);

  const handleOperatorMapCoordinatesChange = React.useCallback(
    (coordinates: Readonly<{ latitude: string; longitude: string }>) => {
      setOperatorCoordinateValue('latitude', coordinates.latitude);
      setOperatorCoordinateValue('longitude', coordinates.longitude);
    },
    [setOperatorCoordinateValue],
  );

  return (
    <PoiDetailSectionCard title={pt('cards.operator.details.title')} description={pt('cards.operator.details.description')}>
      <StudioFieldGroup columns={2}>
        <StudioField id="poi-operator-name" label={pt('fields.operatorName')}>
          <Input
            id="poi-operator-name"
            value={operator.name ?? ''}
            onChange={(event) => setValue('content.operator.name', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-operator-email" label={pt('fields.email')}>
          <Input
            id="poi-operator-email"
            value={operator.contact?.email ?? ''}
            onChange={(event) => setValue('content.operator.contact.email', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-operator-contact-first-name" label={pt('fields.firstName')}>
          <Input
            id="poi-operator-contact-first-name"
            value={operator.contact?.firstName ?? ''}
            onChange={(event) => setValue('content.operator.contact.firstName', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-operator-contact-last-name" label={pt('fields.lastName')}>
          <Input
            id="poi-operator-contact-last-name"
            value={operator.contact?.lastName ?? ''}
            onChange={(event) => setValue('content.operator.contact.lastName', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-operator-phone" label={pt('fields.phone')}>
          <Input
            id="poi-operator-phone"
            value={operator.contact?.phone ?? ''}
            onChange={(event) => setValue('content.operator.contact.phone', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-operator-fax" label={pt('fields.fax')}>
          <Input
            id="poi-operator-fax"
            value={operator.contact?.fax ?? ''}
            onChange={(event) => setValue('content.operator.contact.fax', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField
          id="poi-operator-url"
          label={pt('fields.url')}
          error={operatorUrlError ? pt('validation.webUrls') : undefined}
          errorId="poi-operator-url-error"
        >
          <Input
            id="poi-operator-url"
            aria-describedby={operatorUrlError ? 'poi-operator-url-error' : undefined}
            aria-invalid={operatorUrlError ? true : undefined}
            value={operatorWebUrl?.url ?? ''}
            onChange={(event) => updateOperatorWebUrl({ url: event.target.value })}
          />
        </StudioField>
        <StudioField id="poi-operator-url-description" label={pt('fields.urlDescription')}>
          <Input
            id="poi-operator-url-description"
            value={operatorWebUrl?.description ?? ''}
            onChange={(event) => updateOperatorWebUrl({ description: event.target.value })}
          />
        </StudioField>
        <StudioField id="poi-operator-location-name" label={pt('fields.locationName')}>
          <Input
            id="poi-operator-location-name"
            value={operator.address?.addition ?? ''}
            onChange={(event) => setValue('content.operator.address.addition', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-operator-street" label={pt('fields.street')}>
          <Input
            id="poi-operator-street"
            value={operator.address?.street ?? ''}
            onChange={(event) => setValue('content.operator.address.street', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-operator-zip" label={pt('fields.zip')}>
          <Input
            id="poi-operator-zip"
            value={operator.address?.zip ?? ''}
            onChange={(event) => setValue('content.operator.address.zip', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="poi-operator-city" label={pt('fields.city')}>
          <Input
            id="poi-operator-city"
            value={operatorCity}
            onChange={(event) => setValue('content.operator.address.city', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
      </StudioFieldGroup>

      {hasGeocodingInput || hasReverseGeocodingInput ? (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => void handleOperatorGeocode()} disabled={isGeocoding}>
            {isGeocoding ? pt('actions.geocodingAddress') : pt('actions.geocodeAddress')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleOperatorReverseGeocode()}
            disabled={isReverseGeocoding || !hasReverseGeocodingInput}
          >
            {isReverseGeocoding ? pt('actions.reverseGeocodingAddress') : pt('actions.reverseGeocodeAddress')}
          </Button>
        </div>
      ) : null}

      {geocodingError ? (
        <Alert>
          <AlertDescription>{geocodingError}</AlertDescription>
        </Alert>
      ) : null}

      {isMapEnabled && mapStyleUrl ? (
        <PoiLocationMap
          styleUrl={mapStyleUrl}
          latitude={operatorLatitude}
          longitude={operatorLongitude}
          onCoordinatesChange={handleOperatorMapCoordinatesChange}
          onError={(message) => setMapError(message === 'map_error' ? pt('messages.locationMapError') : null)}
        />
      ) : (
        <Alert>
          <AlertDescription>{pt('messages.locationMapUnavailable')}</AlertDescription>
        </Alert>
      )}

      {mapError ? (
        <Alert>
          <AlertDescription>{mapError}</AlertDescription>
        </Alert>
      ) : null}

      <StudioFieldGroup columns={2}>
        <StudioField
          id="poi-operator-latitude"
          label={pt('fields.latitude')}
          error={operatorGeoLocationError ? pt('validation.geoLocation') : undefined}
          errorId="poi-operator-latitude-error"
        >
          <Input
            id="poi-operator-latitude"
            aria-describedby={operatorGeoLocationError ? 'poi-operator-latitude-error' : undefined}
            aria-invalid={operatorGeoLocationError ? true : undefined}
            value={operatorLatitude}
            onChange={(event) => setOperatorCoordinateValue('latitude', event.target.value)}
          />
        </StudioField>
        <StudioField
          id="poi-operator-longitude"
          label={pt('fields.longitude')}
          error={operatorGeoLocationError ? pt('validation.geoLocation') : undefined}
          errorId="poi-operator-longitude-error"
        >
          <Input
            id="poi-operator-longitude"
            aria-describedby={operatorGeoLocationError ? 'poi-operator-longitude-error' : undefined}
            aria-invalid={operatorGeoLocationError ? true : undefined}
            value={operatorLongitude}
            onChange={(event) => setOperatorCoordinateValue('longitude', event.target.value)}
          />
        </StudioField>
      </StudioFieldGroup>
    </PoiDetailSectionCard>
  );
}
