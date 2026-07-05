import { Alert, AlertDescription } from '@sva/studio-ui-react';

import {
  GenericItemsGeoActionButtons,
  GenericItemsGeoAlerts,
  GenericItemsGeoMapCanvas,
  GenericItemsGeoCoordinateFields,
} from './generic-items.geo-map-section.parts.js';

type Translator = (key: string) => string;
type GenericItemsGeoMapSectionProps = Readonly<{
  geocodingError: string | null;
  hasGeocodingInput: boolean;
  hasReverseGeocodingInput: boolean;
  isGeocoding: boolean;
  isReverseGeocoding: boolean;
  latitude: string;
  latitudeError?: string;
  latitudeId: string;
  longitude: string;
  longitudeError?: string;
  longitudeId: string;
  mapEnabled: boolean;
  mapError: string | null;
  mapStyleUrl: string;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onGeocode: () => void;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  onMapError: (message: string | null) => void;
  onReverseGeocode: () => void;
  pt: Translator;
}>;

export const GenericItemsGeoMapSection = ({
  geocodingError,
  hasGeocodingInput,
  hasReverseGeocodingInput,
  isGeocoding,
  isReverseGeocoding,
  latitude,
  latitudeError,
  latitudeId,
  longitude,
  longitudeError,
  longitudeId,
  mapEnabled,
  mapError,
  mapStyleUrl,
  onCoordinatesChange,
  onGeocode,
  onLatitudeChange,
  onLongitudeChange,
  onMapError,
  onReverseGeocode,
  pt,
}: GenericItemsGeoMapSectionProps) => (
  <>
    <GenericItemsGeoActionButtons
      hasGeocodingInput={hasGeocodingInput}
      hasReverseGeocodingInput={hasReverseGeocodingInput}
      isGeocoding={isGeocoding}
      isReverseGeocoding={isReverseGeocoding}
      onGeocode={onGeocode}
      onReverseGeocode={onReverseGeocode}
      pt={pt}
    />

    <GenericItemsGeoMapCanvas
      latitude={latitude}
      longitude={longitude}
      mapEnabled={mapEnabled}
      mapStyleUrl={mapStyleUrl}
      onCoordinatesChange={onCoordinatesChange}
      onMapError={onMapError}
      pt={pt}
    />

    <GenericItemsGeoAlerts geocodingError={geocodingError} mapError={mapError} />
    <GenericItemsGeoCoordinateFields
      latitude={latitude}
      latitudeError={latitudeError}
      latitudeId={latitudeId}
      longitude={longitude}
      longitudeError={longitudeError}
      longitudeId={longitudeId}
      onLatitudeChange={onLatitudeChange}
      onLongitudeChange={onLongitudeChange}
      pt={pt}
    />
  </>
);
