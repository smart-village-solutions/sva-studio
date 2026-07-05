import * as React from 'react';
import { Alert, AlertDescription, Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import { GenericItemsLocationMap } from './generic-items.location-map.js';
import { parseCoordinate } from './generic-items.location-map.shared.js';
import { geocodeMapAddress, reverseMapCoordinates } from './generic-items.map-geocoding-client.js';
import { resolveGenericItemsMapGeocodingMessageKey } from './generic-items.map-geocoding-messages.js';

type Translator = (key: string) => string;

export function GenericItemsGeoLocationFields({
  pt,
  name,
  nameId,
  department,
  departmentId,
  district,
  districtId,
  regionName,
  regionNameId,
  state,
  stateId,
  geocodingEnabled,
  mapEnabled,
  mapStyleUrl,
  latitude,
  latitudeId,
  longitude,
  longitudeId,
  reverseGeocodingEnabled,
  onNameChange,
  onDepartmentChange,
  onDistrictChange,
  onRegionNameChange,
  onStateChange,
  onCoordinatesChange,
  onLatitudeChange,
  onLongitudeChange,
}: Readonly<{
  pt: Translator;
  name: string;
  nameId: string;
  department: string;
  departmentId: string;
  district: string;
  districtId: string;
  regionName: string;
  regionNameId: string;
  state: string;
  stateId: string;
  geocodingEnabled: boolean;
  mapEnabled: boolean;
  mapStyleUrl: string;
  latitude: string;
  latitudeId: string;
  longitude: string;
  longitudeId: string;
  reverseGeocodingEnabled: boolean;
  onNameChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onRegionNameChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
}>) {
  const [mapError, setMapError] = React.useState<string | null>(null);
  const [geocodingError, setGeocodingError] = React.useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = React.useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = React.useState(false);
  const hasGeocodingInput =
    name.trim().length > 0 ||
    department.trim().length > 0 ||
    district.trim().length > 0 ||
    regionName.trim().length > 0 ||
    state.trim().length > 0;
  const parsedLatitude = parseCoordinate(latitude);
  const parsedLongitude = parseCoordinate(longitude);
  const hasReverseGeocodingInput = parsedLatitude !== null && parsedLongitude !== null;

  const handleGeocode = React.useCallback(async () => {
    const address = {
      query: name.trim() || undefined,
      street: department.trim() || district.trim() || undefined,
      city: regionName.trim() || state.trim() || undefined,
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
      if (name.trim().length === 0 && result.label) {
        onNameChange(result.label);
      }
      if (regionName.trim().length === 0 && result.city) {
        onRegionNameChange(result.city);
      }
      setMapError(null);
    } catch (error) {
      setGeocodingError(pt(resolveGenericItemsMapGeocodingMessageKey(error)));
    } finally {
      setIsGeocoding(false);
    }
  }, [
    department,
    district,
    geocodingEnabled,
    hasGeocodingInput,
    name,
    onCoordinatesChange,
    onNameChange,
    onRegionNameChange,
    pt,
    regionName,
    state,
  ]);

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
      onNameChange(result.label ?? '');
      onRegionNameChange(result.city ?? '');
      onStateChange(result.country ?? '');
      setMapError(null);
    } catch (error) {
      setGeocodingError(pt(resolveGenericItemsMapGeocodingMessageKey(error)));
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [onNameChange, onRegionNameChange, onStateChange, parsedLatitude, parsedLongitude, pt, reverseGeocodingEnabled]);

  return (
    <div className="space-y-4">
      <StudioFieldGroup columns={2}>
        <StudioField id={nameId} label={pt('fields.locationName')}>
          <Input id={nameId} value={name} onChange={(event) => onNameChange(event.target.value)} />
        </StudioField>
        <StudioField id={departmentId} label={pt('fields.department')}>
          <Input id={departmentId} value={department} onChange={(event) => onDepartmentChange(event.target.value)} />
        </StudioField>
      </StudioFieldGroup>
      <StudioFieldGroup columns={2}>
        <StudioField id={districtId} label={pt('fields.district')}>
          <Input id={districtId} value={district} onChange={(event) => onDistrictChange(event.target.value)} />
        </StudioField>
        <StudioField id={regionNameId} label={pt('fields.regionName')}>
          <Input id={regionNameId} value={regionName} onChange={(event) => onRegionNameChange(event.target.value)} />
        </StudioField>
      </StudioFieldGroup>
      <StudioFieldGroup columns={2}>
        <StudioField id={stateId} label={pt('fields.state')}>
          <Input id={stateId} value={state} onChange={(event) => onStateChange(event.target.value)} />
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
        <StudioField id={latitudeId} label={pt('fields.latitude')}>
          <Input id={latitudeId} value={latitude} onChange={(event) => onLatitudeChange(event.target.value)} />
        </StudioField>
        <StudioField id={longitudeId} label={pt('fields.longitude')}>
          <Input id={longitudeId} value={longitude} onChange={(event) => onLongitudeChange(event.target.value)} />
        </StudioField>
      </StudioFieldGroup>
    </div>
  );
}
