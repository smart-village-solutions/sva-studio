import { Alert, AlertDescription } from '@sva/studio-ui-react';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import { PoiLocationMap } from './poi.location-map.js';

type PoiDetailLocationMapSectionProps = Readonly<{
  pt: (key: string) => string;
  enabled: boolean;
  styleUrl: string;
  latitude?: string;
  longitude?: string;
  mapError: string | null;
  onMapError: (message: string | null) => void;
  onCoordinatesChange: (coordinates: Readonly<{ latitude: string; longitude: string }>) => void;
}>;

export function PoiDetailLocationMapSection({
  pt,
  enabled,
  styleUrl,
  latitude,
  longitude,
  mapError,
  onMapError,
  onCoordinatesChange,
}: PoiDetailLocationMapSectionProps) {
  return (
    <PoiDetailSectionCard title={pt('cards.location.map.title')} description={pt('cards.location.map.description')}>
      {enabled && styleUrl ? (
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
        <Alert className="mt-4">
          <AlertDescription>{mapError}</AlertDescription>
        </Alert>
      ) : null}
    </PoiDetailSectionCard>
  );
}
