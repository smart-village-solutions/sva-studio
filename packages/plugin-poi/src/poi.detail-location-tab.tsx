import * as React from 'react';
import { Alert, AlertDescription, Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { MapGeocodingFeature } from '@sva/plugin-sdk';

import { PoiLocationMap } from './poi.location-map.js';
import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';
import { getMapGeocodingConfig, reverseMapCoordinates, suggestMapAddresses } from './poi.map-geocoding-client.js';

const joinStreetParts = (street?: string, houseNumber?: string): string => {
  const parts = [street?.trim(), houseNumber?.trim()].filter((value): value is string => Boolean(value));
  return parts.join(' ');
};

export function PoiDetailLocationTab({ pt }: Readonly<{ pt: (key: string) => string }>) {
  const { control, setValue } = useFormContext<PoiDetailFormValues>();
  const address = useWatch({ control, name: 'content.addresses.0' });
  const location = useWatch({ control, name: 'content.location' });
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<readonly MapGeocodingFeature[]>([]);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isSearchEnabled, setIsSearchEnabled] = React.useState(true);
  const [reverseError, setReverseError] = React.useState<string | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = React.useState(false);
  const [isReverseGeocodingEnabled, setIsReverseGeocodingEnabled] = React.useState(true);
  const [isMapEnabled, setIsMapEnabled] = React.useState(true);
  const [mapStyleUrl, setMapStyleUrl] = React.useState('');
  const [mapError, setMapError] = React.useState<string | null>(null);

  const currentAddress = address ?? {
    addition: '',
    street: '',
    zip: '',
    city: '',
    kind: '',
    geoLocation: { latitude: '', longitude: '' },
  };
  const currentLocation = location ?? { geoLocation: { latitude: '', longitude: '' } };

  React.useEffect(() => {
    let active = true;

    void getMapGeocodingConfig()
      .then((config) => {
        if (!active) {
          return;
        }
        setIsSearchEnabled(config.autocompleteEnabled);
        setIsReverseGeocodingEnabled(config.reverseGeocodeEnabled);
        setMapStyleUrl(config.styleUrl);
        setIsMapEnabled(config.killSwitchEnabled === false && config.styleUrl.length > 0);
      })
      .catch(() => {
        if (active) {
          setIsSearchEnabled(false);
          setIsReverseGeocodingEnabled(false);
          setIsMapEnabled(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCoordinateChange = React.useCallback(
    (axis: 'latitude' | 'longitude', value: string) => {
      setValue(`content.addresses.0.geoLocation.${axis}`, value, { shouldDirty: true });
      setValue(`content.location.geoLocation.${axis}`, value, { shouldDirty: true });
      setReverseError(null);
      setMapError(null);
    },
    [setValue],
  );

  const handleSearch = React.useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    if (!isSearchEnabled) {
      setSearchResults([]);
      setSearchError(pt('messages.locationSearchError'));
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await suggestMapAddresses({ query });
      setSearchResults(results);
      setSearchError(results.length > 0 ? null : pt('messages.locationSearchEmpty'));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setSearchResults([]);
      setSearchError(message === 'no_result' ? pt('messages.locationSearchEmpty') : pt('messages.locationSearchError'));
    } finally {
      setIsSearching(false);
    }
  }, [isSearchEnabled, pt, searchQuery]);

  const applySearchResult = React.useCallback(
    (result: (typeof searchResults)[number]) => {
      const latitude = String(result.coordinates.latitude);
      const longitude = String(result.coordinates.longitude);
      const street = joinStreetParts(result.street, result.houseNumber);

      setValue('content.addresses.0.street', street, { shouldDirty: true });
      setValue('content.addresses.0.zip', result.postalCode ?? '', { shouldDirty: true });
      setValue('content.addresses.0.city', result.city ?? '', { shouldDirty: true });
      setValue('content.addresses.0.geoLocation.latitude', latitude, { shouldDirty: true });
      setValue('content.addresses.0.geoLocation.longitude', longitude, { shouldDirty: true });
      setValue('content.location.geoLocation.latitude', latitude, { shouldDirty: true });
      setValue('content.location.geoLocation.longitude', longitude, { shouldDirty: true });
      setValue('content.location.name', currentLocation.name?.trim() ? currentLocation.name : result.label, { shouldDirty: true });
      setSearchError(null);
      setReverseError(null);
      setMapError(null);
    },
    [currentLocation.name, searchResults, setValue],
  );

  const handleMapCoordinatesChange = React.useCallback(
    (coordinates: Readonly<{ latitude: string; longitude: string }>) => {
      handleCoordinateChange('latitude', coordinates.latitude);
      handleCoordinateChange('longitude', coordinates.longitude);
    },
    [handleCoordinateChange],
  );

  const handleReverseGeocode = React.useCallback(async () => {
    const latitude = Number(currentAddress.geoLocation?.latitude ?? '');
    const longitude = Number(currentAddress.geoLocation?.longitude ?? '');

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !isReverseGeocodingEnabled) {
      setReverseError(pt('messages.locationReverseGeocodeError'));
      return;
    }

    setIsReverseGeocoding(true);
    setReverseError(null);

    try {
      const result = await reverseMapCoordinates({ latitude, longitude });
      applySearchResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setReverseError(
        message === 'no_result' ? pt('messages.locationReverseGeocodeEmpty') : pt('messages.locationReverseGeocodeError'),
      );
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [
    applySearchResult,
    currentAddress.geoLocation?.latitude,
    currentAddress.geoLocation?.longitude,
    isReverseGeocodingEnabled,
    pt,
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6">
          <PoiDetailSectionCard title={pt('cards.location.search.title')} description={pt('cards.location.search.description')}>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="min-w-0 flex-1">
                  <StudioField id="poi-address-search" label={pt('fields.addressSearch')}>
                    <Input
                      id="poi-address-search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </StudioField>
                </div>
                <Button type="button" variant="outline" onClick={() => void handleSearch()} disabled={isSearching}>
                  {pt('actions.searchAddress')}
                </Button>
              </div>
              {searchError ? (
                <Alert>
                  <AlertDescription>{searchError}</AlertDescription>
                </Alert>
              ) : null}
              {searchResults.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">{pt('fields.searchResults')}</p>
                  <ul className="space-y-2">
                    {searchResults.map((result) => (
                      <li
                        key={`${result.label}:${result.coordinates.latitude}:${result.coordinates.longitude}`}
                        className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <span className="text-sm text-foreground">{result.label}</span>
                        <Button type="button" variant="outline" onClick={() => applySearchResult(result)}>
                          {pt('actions.applySearchResult')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </PoiDetailSectionCard>

          <PoiDetailSectionCard title={pt('cards.location.address.title')} description={pt('cards.location.address.description')}>
            <StudioFieldGroup columns={2}>
              <StudioField id="poi-street" label={pt('fields.street')}>
                <Input
                  id="poi-street"
                  value={currentAddress.street ?? ''}
                  onChange={(event) => setValue('content.addresses.0.street', event.target.value, { shouldDirty: true })}
                />
              </StudioField>
              <StudioField id="poi-zip" label={pt('fields.zip')}>
                <Input
                  id="poi-zip"
                  value={currentAddress.zip ?? ''}
                  onChange={(event) => setValue('content.addresses.0.zip', event.target.value, { shouldDirty: true })}
                />
              </StudioField>
              <StudioField id="poi-city" label={pt('fields.city')}>
                <Input
                  id="poi-city"
                  value={currentAddress.city ?? ''}
                  onChange={(event) => setValue('content.addresses.0.city', event.target.value, { shouldDirty: true })}
                />
              </StudioField>
              <StudioField id="poi-location-name" label={pt('fields.locationName')}>
                <Input
                  id="poi-location-name"
                  value={currentLocation.name ?? ''}
                  onChange={(event) => setValue('content.location.name', event.target.value, { shouldDirty: true })}
                />
              </StudioField>
            </StudioFieldGroup>
          </PoiDetailSectionCard>

          <PoiDetailSectionCard
            title={pt('cards.location.coordinates.title')}
            description={pt('cards.location.coordinates.description')}
          >
            <StudioFieldGroup columns={2}>
              <StudioField id="poi-latitude" label={pt('fields.latitude')}>
                <Input
                  id="poi-latitude"
                  value={currentAddress.geoLocation?.latitude ?? ''}
                  onChange={(event) => handleCoordinateChange('latitude', event.target.value)}
                />
              </StudioField>
              <StudioField id="poi-longitude" label={pt('fields.longitude')}>
                <Input
                  id="poi-longitude"
                  value={currentAddress.geoLocation?.longitude ?? ''}
                  onChange={(event) => handleCoordinateChange('longitude', event.target.value)}
                />
              </StudioField>
            </StudioFieldGroup>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleReverseGeocode()}
                disabled={isReverseGeocoding}
              >
                {isReverseGeocoding ? pt('actions.reverseGeocoding') : pt('actions.reverseGeocode')}
              </Button>
            </div>
            {reverseError ? (
              <Alert className="mt-4">
                <AlertDescription>{reverseError}</AlertDescription>
              </Alert>
            ) : null}
          </PoiDetailSectionCard>
        </div>

        <PoiDetailSectionCard title={pt('cards.location.map.title')} description={pt('cards.location.map.description')}>
          {isMapEnabled && mapStyleUrl ? (
            <PoiLocationMap
              styleUrl={mapStyleUrl}
              latitude={currentAddress.geoLocation?.latitude}
              longitude={currentAddress.geoLocation?.longitude}
              onCoordinatesChange={handleMapCoordinatesChange}
              onError={(message) => setMapError(message === 'map_error' ? pt('messages.locationMapError') : null)}
            />
          ) : (
            <Alert>
              <AlertDescription>{pt('messages.locationMapUnavailable')}</AlertDescription>
            </Alert>
          )}
          {mapError ? (
            <Alert className="mt-4">
              <AlertDescription>{mapError}</AlertDescription>
            </Alert>
          ) : null}
        </PoiDetailSectionCard>
      </div>
    </div>
  );
}
