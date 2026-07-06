import * as React from 'react';
import { Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import { useGenericItemsGeocodingHandlers } from './generic-items.geo-field-handlers.js';
import { GenericItemsGeoMapSection, useGenericItemsGeoFieldState } from './generic-items.geo-fields.shared.js';
import { parseCoordinate } from './generic-items.location-map.shared.js';
import { geocodeMapAddress, reverseMapCoordinates } from './generic-items.map-geocoding-client.js';

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
  const hasGeocodingInput =
    addition.trim().length > 0 || street.trim().length > 0 || zip.trim().length > 0 || city.trim().length > 0;
  const parsedLatitude = parseCoordinate(latitude);
  const parsedLongitude = parseCoordinate(longitude);
  const hasReverseGeocodingInput = parsedLatitude !== null && parsedLongitude !== null;
  const geoState = useGenericItemsGeoFieldState({
    geocodingEnabled,
    geocodeAddress: async () => {
      const result = await geocodeMapAddress({
        address: {
          query: addition.trim() || undefined,
          street: street.trim() || undefined,
          zip: zip.trim() || undefined,
          city: city.trim() || undefined,
          country: 'Deutschland',
        },
      });
      onCoordinatesChange({
        latitude: String(result.coordinates.latitude),
        longitude: String(result.coordinates.longitude),
      });
    },
    hasGeocodingInput,
    hasReverseGeocodingInput,
    pt,
    reverseGeocodeAddress: async () => {
      const result = await reverseMapCoordinates({
        latitude: parsedLatitude as number,
        longitude: parsedLongitude as number,
      });
      onStreetChange([result.street, result.houseNumber].filter(Boolean).join(' '));
      onZipChange(result.postalCode ?? '');
      onCityChange(result.city ?? '');
    },
    reverseGeocodingEnabled,
  });

  const { handleGeocode, handleReverseGeocode } = useGenericItemsGeocodingHandlers({ geoState, pt });

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
      <GenericItemsGeoMapSection
        geocodingError={geoState.geocodingError}
        hasGeocodingInput={hasGeocodingInput}
        hasReverseGeocodingInput={hasReverseGeocodingInput}
        isGeocoding={geoState.isGeocoding}
        isReverseGeocoding={geoState.isReverseGeocoding}
        latitude={latitude}
        latitudeError={latitudeError}
        latitudeId={latitudeId}
        longitude={longitude}
        longitudeError={longitudeError}
        longitudeId={longitudeId}
        mapEnabled={mapEnabled}
        mapError={geoState.mapError}
        mapStyleUrl={mapStyleUrl}
        onCoordinatesChange={onCoordinatesChange}
        onGeocode={handleGeocode}
        onLatitudeChange={onLatitudeChange}
        onLongitudeChange={onLongitudeChange}
        onMapError={geoState.setMapError}
        onReverseGeocode={handleReverseGeocode}
        pt={pt}
      />
    </div>
  );
}
