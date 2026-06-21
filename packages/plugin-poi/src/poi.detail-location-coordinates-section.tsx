import * as React from 'react';
import { Alert, AlertDescription, Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import type { MapGeocodingFeature } from '@sva/plugin-sdk';

import { PoiDetailSectionCard } from './poi.detail-section-card.js';
import { reverseMapCoordinates } from './poi.map-geocoding-client.js';

type PoiDetailLocationCoordinatesSectionProps = Readonly<{
  pt: (key: string) => string;
  latitude: string;
  longitude: string;
  reverseGeocodingEnabled: boolean;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  onApplyResult: (result: MapGeocodingFeature) => void;
}>;

export function PoiDetailLocationCoordinatesSection({
  pt,
  latitude,
  longitude,
  reverseGeocodingEnabled,
  onLatitudeChange,
  onLongitudeChange,
  onApplyResult,
}: PoiDetailLocationCoordinatesSectionProps) {
  const [reverseError, setReverseError] = React.useState<string | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = React.useState(false);

  const handleReverseGeocode = React.useCallback(async () => {
    const nextLatitude = Number(latitude);
    const nextLongitude = Number(longitude);

    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude) || !reverseGeocodingEnabled) {
      setReverseError(pt('messages.locationReverseGeocodeError'));
      return;
    }

    setIsReverseGeocoding(true);
    setReverseError(null);
    try {
      const result = await reverseMapCoordinates({ latitude: nextLatitude, longitude: nextLongitude });
      onApplyResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setReverseError(
        message === 'no_result' ? pt('messages.locationReverseGeocodeEmpty') : pt('messages.locationReverseGeocodeError'),
      );
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [latitude, longitude, onApplyResult, pt, reverseGeocodingEnabled]);

  return (
    <PoiDetailSectionCard
      title={pt('cards.location.coordinates.title')}
      description={pt('cards.location.coordinates.description')}
    >
      <StudioFieldGroup columns={2}>
        <StudioField id="poi-latitude" label={pt('fields.latitude')}>
          <Input id="poi-latitude" value={latitude} onChange={(event) => onLatitudeChange(event.target.value)} />
        </StudioField>
        <StudioField id="poi-longitude" label={pt('fields.longitude')}>
          <Input id="poi-longitude" value={longitude} onChange={(event) => onLongitudeChange(event.target.value)} />
        </StudioField>
      </StudioFieldGroup>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => void handleReverseGeocode()} disabled={isReverseGeocoding}>
          {isReverseGeocoding ? pt('actions.reverseGeocoding') : pt('actions.reverseGeocode')}
        </Button>
      </div>
      {reverseError ? (
        <Alert className="mt-4">
          <AlertDescription>{reverseError}</AlertDescription>
        </Alert>
      ) : null}
    </PoiDetailSectionCard>
  );
}
