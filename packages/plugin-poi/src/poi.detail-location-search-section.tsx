import * as React from 'react';
import { Alert, AlertDescription, Button, Input, StudioField } from '@sva/studio-ui-react';
import type { MapGeocodingFeature } from '@sva/plugin-sdk';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import { suggestMapAddresses } from './poi.map-geocoding-client.js';

type PoiDetailLocationSearchSectionProps = Readonly<{
  pt: (key: string) => string;
  enabled: boolean;
  onApplyResult: (result: MapGeocodingFeature) => void;
}>;

export function PoiDetailLocationSearchSection({
  pt,
  enabled,
  onApplyResult,
}: PoiDetailLocationSearchSectionProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<readonly MapGeocodingFeature[]>([]);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);

  const handleSearch = React.useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    if (!enabled) {
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
  }, [enabled, pt, searchQuery]);

  return (
    <PoiDetailSectionCard title={pt('cards.location.search.title')} description={pt('cards.location.search.description')}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <StudioField id="poi-address-search" label={pt('fields.addressSearch')}>
              <Input id="poi-address-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
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
                  <Button type="button" variant="outline" onClick={() => onApplyResult(result)}>
                    {pt('actions.applySearchResult')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </PoiDetailSectionCard>
  );
}
