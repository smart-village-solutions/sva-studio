import * as React from 'react';
import type { MapGeocodingFeature } from '@sva/plugin-sdk';
import { Alert, AlertDescription, Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import { PoiLocationMap } from './poi.location-map.js';
import { geocodeMapAddress, reverseMapCoordinates } from './poi.map-geocoding-client.js';
import { parseCoordinate } from './poi.location-map.shared.js';

type PoiDetailLocationSectionProps = Readonly<{
  pt: (key: string) => string;
  geocodingEnabled: boolean;
  reverseGeocodingEnabled: boolean;
  mapEnabled: boolean;
  styleUrl: string;
  street: string;
  zip: string;
  city: string;
  locationName: string;
  latitude: string;
  longitude: string;
  mapError: string | null;
  onMapError: (message: string | null) => void;
  onStreetChange: (value: string) => void;
  onZipChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onLocationNameChange: (value: string) => void;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onApplyResult: (result: MapGeocodingFeature) => void;
  onApplyReverseGeocodeResult: (result: MapGeocodingFeature) => void;
}>;

export function PoiDetailLocationSection({
  pt,
  geocodingEnabled,
  reverseGeocodingEnabled,
  mapEnabled,
  styleUrl,
  street,
  zip,
  city,
  locationName,
  latitude,
  longitude,
  mapError,
  onMapError,
  onStreetChange,
  onZipChange,
  onCityChange,
  onLocationNameChange,
  onLatitudeChange,
  onLongitudeChange,
  onCoordinatesChange,
  onApplyResult,
  onApplyReverseGeocodeResult,
}: PoiDetailLocationSectionProps) {
  const [geocodingError, setGeocodingError] = React.useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = React.useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = React.useState(false);
  const hasGeocodingInput =
    locationName.trim().length > 0 ||
    street.trim().length > 0 ||
    zip.trim().length > 0 ||
    city.trim().length > 0;
  const parsedLatitude = parseCoordinate(latitude);
  const parsedLongitude = parseCoordinate(longitude);
  const hasReverseGeocodingInput = parsedLatitude !== null && parsedLongitude !== null;

  const handleGeocode = React.useCallback(async () => {
    const address = {
      query: locationName.trim() || undefined,
      street: street.trim() || undefined,
      zip: zip.trim() || undefined,
      city: city.trim() || undefined,
      country: 'Deutschland',
    };

    if (!geocodingEnabled || !hasGeocodingInput) {
      setGeocodingError(pt('messages.locationGeocodeError'));
      return;
    }

    setIsGeocoding(true);
    setGeocodingError(null);
    try {
      const result = await geocodeMapAddress({ address });
      onApplyResult(result);
      onMapError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setGeocodingError(message === 'no_result' ? pt('messages.locationGeocodeEmpty') : pt('messages.locationGeocodeError'));
    } finally {
      setIsGeocoding(false);
    }
  }, [city, geocodingEnabled, hasGeocodingInput, locationName, onApplyResult, onMapError, pt, street, zip]);

  const handleReverseGeocode = React.useCallback(async () => {
    if (!reverseGeocodingEnabled || parsedLatitude === null || parsedLongitude === null) {
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
      onApplyReverseGeocodeResult(result);
      onMapError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setGeocodingError(message === 'no_result' ? pt('messages.locationGeocodeEmpty') : pt('messages.locationGeocodeError'));
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [onApplyReverseGeocodeResult, onMapError, parsedLatitude, parsedLongitude, pt, reverseGeocodingEnabled]);

  return (
    <PoiDetailSectionCard title={pt('cards.location.address.title')} description={pt('cards.location.address.description')}>
      <StudioFieldGroup columns={2}>
        <StudioField id="poi-location-name" label={pt('fields.locationName')}>
          <Input id="poi-location-name" value={locationName} onChange={(event) => onLocationNameChange(event.target.value)} />
        </StudioField>
        <StudioField id="poi-street" label={pt('fields.street')}>
          <Input id="poi-street" value={street} onChange={(event) => onStreetChange(event.target.value)} />
        </StudioField>
        <StudioField id="poi-zip" label={pt('fields.zip')}>
          <Input id="poi-zip" value={zip} onChange={(event) => onZipChange(event.target.value)} />
        </StudioField>
        <StudioField id="poi-city" label={pt('fields.city')}>
          <Input id="poi-city" value={city} onChange={(event) => onCityChange(event.target.value)} />
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

      {mapEnabled && styleUrl ? (
        <PoiLocationMap
          styleUrl={styleUrl}
          latitude={latitude}
          longitude={longitude}
          onCoordinatesChange={onCoordinatesChange}
          onError={(message) => onMapError(message === 'map_error' ? pt('messages.locationMapError') : null)}
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
        <StudioField id="poi-latitude" label={pt('fields.latitude')}>
          <Input id="poi-latitude" value={latitude} onChange={(event) => onLatitudeChange(event.target.value)} />
        </StudioField>
        <StudioField id="poi-longitude" label={pt('fields.longitude')}>
          <Input id="poi-longitude" value={longitude} onChange={(event) => onLongitudeChange(event.target.value)} />
        </StudioField>
      </StudioFieldGroup>
    </PoiDetailSectionCard>
  );
}
