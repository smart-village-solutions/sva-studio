import * as React from 'react';

import { usePoiDetailLocationController } from './poi.detail-location-controller.js';
import { PoiDetailLocationSection } from './poi.detail-location-section.js';

export function PoiDetailLocationTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const {
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
  } = usePoiDetailLocationController();

  const handleMapCoordinatesChange = React.useCallback(
    (coordinates: Readonly<{ latitude: string; longitude: string }>) => {
      setCoordinateValue('latitude', coordinates.latitude);
      setCoordinateValue('longitude', coordinates.longitude);
    },
    [setCoordinateValue],
  );

  return (
    <div className="space-y-6">
      <PoiDetailLocationSection
        pt={pt}
        geocodingEnabled={isGeocodingEnabled}
        reverseGeocodingEnabled={isReverseGeocodingEnabled}
        mapEnabled={isMapEnabled}
        styleUrl={mapStyleUrl}
        street={currentAddress.street ?? ''}
        zip={currentAddress.zip ?? ''}
        city={currentAddress.city ?? ''}
        locationName={currentLocation.name ?? ''}
        latitude={currentAddress.geoLocation?.latitude ?? ''}
        longitude={currentAddress.geoLocation?.longitude ?? ''}
        mapError={mapError}
        onMapError={setMapError}
        onStreetChange={(value) => setValue('content.addresses.0.street', value, { shouldDirty: true })}
        onZipChange={(value) => setValue('content.addresses.0.zip', value, { shouldDirty: true })}
        onCityChange={(value) => setValue('content.addresses.0.city', value, { shouldDirty: true })}
        onLocationNameChange={(value) => setValue('content.location.name', value, { shouldDirty: true })}
        onLatitudeChange={(value) => setCoordinateValue('latitude', value)}
        onLongitudeChange={(value) => setCoordinateValue('longitude', value)}
        onCoordinatesChange={handleMapCoordinatesChange}
        onApplyResult={applySearchResult}
        onApplyReverseGeocodeResult={applyReverseGeocodeResult}
      />
    </div>
  );
}
