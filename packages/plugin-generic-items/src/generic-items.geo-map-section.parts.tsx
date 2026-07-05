import { Alert, AlertDescription, Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import { GenericItemsLocationMap } from './generic-items.location-map.js';

type Translator = (key: string) => string;

export const GenericItemsGeoActionButtons = ({
  hasGeocodingInput,
  hasReverseGeocodingInput,
  isGeocoding,
  isReverseGeocoding,
  onGeocode,
  onReverseGeocode,
  pt,
}: Readonly<{
  hasGeocodingInput: boolean;
  hasReverseGeocodingInput: boolean;
  isGeocoding: boolean;
  isReverseGeocoding: boolean;
  onGeocode: () => void;
  onReverseGeocode: () => void;
  pt: Translator;
}>) =>
  hasGeocodingInput || hasReverseGeocodingInput ? (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="outline" onClick={onGeocode} disabled={isGeocoding}>
        {isGeocoding ? pt('actions.geocodingAddress') : pt('actions.geocodeAddress')}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onReverseGeocode}
        disabled={isReverseGeocoding || !hasReverseGeocodingInput}
      >
        {isReverseGeocoding ? pt('actions.reverseGeocodingAddress') : pt('actions.reverseGeocodeAddress')}
      </Button>
    </div>
  ) : null;

export const GenericItemsGeoAlerts = ({
  geocodingError,
  mapError,
}: Readonly<{
  geocodingError: string | null;
  mapError: string | null;
}>) => (
  <>
    {geocodingError ? (
      <Alert>
        <AlertDescription>{geocodingError}</AlertDescription>
      </Alert>
    ) : null}
    {mapError ? (
      <Alert>
        <AlertDescription>{mapError}</AlertDescription>
      </Alert>
    ) : null}
  </>
);

export const GenericItemsGeoMapCanvas = ({
  latitude,
  longitude,
  mapEnabled,
  mapStyleUrl,
  onCoordinatesChange,
  onMapError,
  pt,
}: Readonly<{
  latitude: string;
  longitude: string;
  mapEnabled: boolean;
  mapStyleUrl: string;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onMapError: (message: string | null) => void;
  pt: Translator;
}>) =>
  mapEnabled && mapStyleUrl ? (
    <GenericItemsLocationMap
      styleUrl={mapStyleUrl}
      latitude={latitude}
      longitude={longitude}
      onCoordinatesChange={onCoordinatesChange}
      onError={(message) => onMapError(message === 'map_error' ? pt('messages.locationMapError') : null)}
    />
  ) : (
    <Alert>
      <AlertDescription>{pt('messages.locationMapUnavailable')}</AlertDescription>
    </Alert>
  );

export const GenericItemsGeoCoordinateFields = ({
  latitude,
  latitudeError,
  latitudeId,
  longitude,
  longitudeError,
  longitudeId,
  onLatitudeChange,
  onLongitudeChange,
  pt,
}: Readonly<{
  latitude: string;
  latitudeError?: string;
  latitudeId: string;
  longitude: string;
  longitudeError?: string;
  longitudeId: string;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  pt: Translator;
}>) => {
  const geoLocationError = latitudeError ?? longitudeError;

  return (
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
  );
};
