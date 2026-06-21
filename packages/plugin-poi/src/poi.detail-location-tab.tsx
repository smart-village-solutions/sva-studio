import * as React from 'react';

import { usePoiDetailLocationController } from './poi.detail-location-controller.js';
import { PoiDetailLocationAddressSection } from './poi.detail-location-address-section.js';
import { PoiDetailLocationCoordinatesSection } from './poi.detail-location-coordinates-section.js';
import { PoiDetailLocationMapSection } from './poi.detail-location-map-section.js';
import { PoiDetailLocationSearchSection } from './poi.detail-location-search-section.js';

export function PoiDetailLocationTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const {
    applySearchResult,
    currentAddress,
    currentLocation,
    isMapEnabled,
    isReverseGeocodingEnabled,
    isSearchEnabled,
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6">
          <PoiDetailLocationSearchSection pt={pt} enabled={isSearchEnabled} onApplyResult={applySearchResult} />
          <PoiDetailLocationAddressSection
            pt={pt}
            street={currentAddress.street ?? ''}
            zip={currentAddress.zip ?? ''}
            city={currentAddress.city ?? ''}
            locationName={currentLocation.name ?? ''}
            onStreetChange={(value) => setValue('content.addresses.0.street', value, { shouldDirty: true })}
            onZipChange={(value) => setValue('content.addresses.0.zip', value, { shouldDirty: true })}
            onCityChange={(value) => setValue('content.addresses.0.city', value, { shouldDirty: true })}
            onLocationNameChange={(value) => setValue('content.location.name', value, { shouldDirty: true })}
          />
          <PoiDetailLocationCoordinatesSection
            pt={pt}
            latitude={currentAddress.geoLocation?.latitude ?? ''}
            longitude={currentAddress.geoLocation?.longitude ?? ''}
            reverseGeocodingEnabled={isReverseGeocodingEnabled}
            onLatitudeChange={(value) => setCoordinateValue('latitude', value)}
            onLongitudeChange={(value) => setCoordinateValue('longitude', value)}
            onApplyResult={applySearchResult}
          />
        </div>
        <PoiDetailLocationMapSection
          pt={pt}
          enabled={isMapEnabled}
          styleUrl={mapStyleUrl}
          latitude={currentAddress.geoLocation?.latitude}
          longitude={currentAddress.geoLocation?.longitude}
          mapError={mapError}
          onMapError={setMapError}
          onCoordinatesChange={handleMapCoordinatesChange}
        />
      </div>
    </div>
  );
}
