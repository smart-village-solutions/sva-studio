import * as React from 'react';
import { Alert, AlertDescription, Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import { GenericItemsLocationMap } from './generic-items.location-map.js';
import { parseCoordinate } from './generic-items.location-map.shared.js';
import { geocodeMapAddress, reverseMapCoordinates } from './generic-items.map-geocoding-client.js';
import { resolveGenericItemsMapGeocodingMessageKey } from './generic-items.map-geocoding-messages.js';

type Translator = (key: string) => string;

export function GenericItemsGeoAddressFields({
  pt,
  addition,
  additionId,
  city,
  cityId,
  geocodingEnabled,
  mapEnabled,
  mapStyleUrl,
  latitude,
  latitudeError,
  latitudeId,
  longitude,
  longitudeError,
  longitudeId,
  reverseGeocodingEnabled,
  street,
  streetId,
  zip,
  zipId,
  onAdditionChange,
  onCityChange,
  onCoordinatesChange,
  onLatitudeChange,
  onLongitudeChange,
  onStreetChange,
  onZipChange,
}: Readonly<{
  pt: Translator;
  addition: string;
  additionId: string;
  city: string;
  cityId: string;
  geocodingEnabled: boolean;
  mapEnabled: boolean;
  mapStyleUrl: string;
  latitude: string;
  latitudeError?: string;
  latitudeId: string;
  longitude: string;
  longitudeError?: string;
  longitudeId: string;
  reverseGeocodingEnabled: boolean;
  street: string;
  streetId: string;
  zip: string;
  zipId: string;
  onAdditionChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  onStreetChange: (value: string) => void;
  onZipChange: (value: string) => void;
}>) {
  const [mapError, setMapError] = React.useState<string | null>(null);
  const [geocodingError, setGeocodingError] = React.useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = React.useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = React.useState(false);
  const hasGeocodingInput =
    addition.trim().length > 0 || street.trim().length > 0 || zip.trim().length > 0 || city.trim().length > 0;
  const parsedLatitude = parseCoordinate(latitude);
  const parsedLongitude = parseCoordinate(longitude);
  const hasReverseGeocodingInput = parsedLatitude !== null && parsedLongitude !== null;
  const geoLocationError = latitudeError ?? longitudeError;

  const handleGeocode = React.useCallback(async () => {
    const address = {
      query: addition.trim() || undefined,
      street: street.trim() || undefined,
      zip: zip.trim() || undefined,
      city: city.trim() || undefined,
      country: 'Deutschland',
    };

    if (!geocodingEnabled || !hasGeocodingInput) {
      setGeocodingError(pt('messages.locationGeocodeDisabled'));
      return;
    }

    setIsGeocoding(true);
    setGeocodingError(null);
    try {
      const result = await geocodeMapAddress({ address });
      onCoordinatesChange({
        latitude: String(result.coordinates.latitude),
        longitude: String(result.coordinates.longitude),
      });
      setMapError(null);
    } catch (error) {
      setGeocodingError(pt(resolveGenericItemsMapGeocodingMessageKey(error)));
    } finally {
      setIsGeocoding(false);
    }
  }, [addition, city, geocodingEnabled, hasGeocodingInput, onCoordinatesChange, pt, street, zip]);

  const handleReverseGeocode = React.useCallback(async () => {
    if (!reverseGeocodingEnabled || parsedLatitude === null || parsedLongitude === null) {
      setGeocodingError(pt('messages.locationGeocodeDisabled'));
      return;
    }

    setIsReverseGeocoding(true);
    setGeocodingError(null);
    try {
      const result = await reverseMapCoordinates({
        latitude: parsedLatitude,
        longitude: parsedLongitude,
      });
      onStreetChange([result.street, result.houseNumber].filter(Boolean).join(' '));
      onZipChange(result.postalCode ?? '');
      onCityChange(result.city ?? '');
      setMapError(null);
    } catch (error) {
      setGeocodingError(pt(resolveGenericItemsMapGeocodingMessageKey(error)));
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [onCityChange, onStreetChange, onZipChange, parsedLatitude, parsedLongitude, pt, reverseGeocodingEnabled]);

  return (
    <div className="space-y-4">
      <StudioFieldGroup columns={2}>
        <StudioField id={additionId} label={pt('fields.addressAddition')}>
          <Input id={additionId} value={addition} onChange={(event) => onAdditionChange(event.target.value)} />
        </StudioField>
        <StudioField id={streetId} label={pt('fields.street')}>
          <Input id={streetId} value={street} onChange={(event) => onStreetChange(event.target.value)} />
        </StudioField>
      </StudioFieldGroup>
      <StudioFieldGroup columns={2}>
        <StudioField id={zipId} label={pt('fields.zip')}>
          <Input id={zipId} value={zip} onChange={(event) => onZipChange(event.target.value)} />
        </StudioField>
        <StudioField id={cityId} label={pt('fields.city')}>
          <Input id={cityId} value={city} onChange={(event) => onCityChange(event.target.value)} />
        </StudioField>
      </StudioFieldGroup>

      {hasGeocodingInput || hasReverseGeocodingInput ? (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => void handleGeocode()} disabled={isGeocoding}>
            {isGeocoding ? pt('actions.geocodingAddress') : pt('actions.geocodeAddress')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleReverseGeocode()}
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

      {mapEnabled && mapStyleUrl ? (
        <GenericItemsLocationMap
          styleUrl={mapStyleUrl}
          latitude={latitude}
          longitude={longitude}
          onCoordinatesChange={onCoordinatesChange}
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
        <StudioField id={latitudeId} label={pt('fields.latitude')} error={geoLocationError} errorId={`${latitudeId}-error`}>
          <Input
            id={latitudeId}
            aria-describedby={geoLocationError ? `${latitudeId}-error` : undefined}
            aria-invalid={geoLocationError ? true : undefined}
            value={latitude}
            onChange={(event) => onLatitudeChange(event.target.value)}
          />
        </StudioField>
        <StudioField id={longitudeId} label={pt('fields.longitude')} error={geoLocationError} errorId={`${longitudeId}-error`}>
          <Input
            id={longitudeId}
            aria-describedby={geoLocationError ? `${longitudeId}-error` : undefined}
            aria-invalid={geoLocationError ? true : undefined}
            value={longitude}
            onChange={(event) => onLongitudeChange(event.target.value)}
          />
        </StudioField>
      </StudioFieldGroup>
    </div>
  );
}
