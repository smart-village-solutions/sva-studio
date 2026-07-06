import * as React from 'react';
import { Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import { useGenericItemsGeocodingHandlers } from './generic-items.geo-field-handlers.js';
import { GenericItemsGeoMapSection, useGenericItemsGeoFieldState } from './generic-items.geo-fields.shared.js';
import { parseCoordinate } from './generic-items.location-map.shared.js';
import { geocodeMapAddress, reverseMapCoordinates } from './generic-items.map-geocoding-client.js';

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
  const hasGeocodingInput =
    name.trim().length > 0 ||
    department.trim().length > 0 ||
    district.trim().length > 0 ||
    regionName.trim().length > 0 ||
    state.trim().length > 0;
  const parsedLatitude = parseCoordinate(latitude);
  const parsedLongitude = parseCoordinate(longitude);
  const hasReverseGeocodingInput = parsedLatitude !== null && parsedLongitude !== null;
  const geoState = useGenericItemsGeoFieldState({
    geocodingEnabled,
    geocodeAddress: async () => {
      const result = await geocodeMapAddress({
        address: {
          query: name.trim() || undefined,
          street: department.trim() || district.trim() || undefined,
          city: regionName.trim() || state.trim() || undefined,
          country: 'Deutschland',
        },
      });
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
    },
    hasGeocodingInput,
    hasReverseGeocodingInput,
    pt,
    reverseGeocodeAddress: async () => {
      const result = await reverseMapCoordinates({
        latitude: parsedLatitude as number,
        longitude: parsedLongitude as number,
      });
      onNameChange(result.label ?? '');
      onRegionNameChange(result.city ?? '');
      onStateChange(result.country ?? '');
    },
    reverseGeocodingEnabled,
  });

  const { handleGeocode, handleReverseGeocode } = useGenericItemsGeocodingHandlers({ geoState, pt });

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
      <GenericItemsGeoMapSection
        geocodingError={geoState.geocodingError}
        hasGeocodingInput={hasGeocodingInput}
        hasReverseGeocodingInput={hasReverseGeocodingInput}
        isGeocoding={geoState.isGeocoding}
        isReverseGeocoding={geoState.isReverseGeocoding}
        latitude={latitude}
        latitudeId={latitudeId}
        longitude={longitude}
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
