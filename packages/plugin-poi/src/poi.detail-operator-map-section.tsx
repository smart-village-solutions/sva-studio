import {
  Alert,
  AlertDescription,
  Input,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';

import type { PoiDetailOperatorController } from './poi.detail-operator-controller.js';
import { PoiLocationMap } from './poi.location-map.js';

type Translate = (key: string) => string;

export function PoiDetailOperatorMap({
  mapEnabled,
  mapError,
  mapStyleUrl,
  pt,
  setCoordinateValue,
  setMapError,
  values,
}: Pick<
  PoiDetailOperatorController,
  'mapEnabled' | 'mapError' | 'mapStyleUrl' | 'setCoordinateValue' | 'setMapError' | 'values'
> &
  Readonly<{ pt: Translate }>) {
  return (
    <>
      {mapEnabled && mapStyleUrl ? (
        <PoiLocationMap
          styleUrl={mapStyleUrl}
          latitude={values.latitude}
          longitude={values.longitude}
          onCoordinatesChange={(coordinates) => {
            setCoordinateValue('latitude', coordinates.latitude);
            setCoordinateValue('longitude', coordinates.longitude);
          }}
          onError={(message) =>
            setMapError(message === 'map_error' ? pt('messages.locationMapError') : null)
          }
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
    </>
  );
}

export function PoiDetailOperatorCoordinateFields({
  coordinateError,
  pt,
  setCoordinateValue,
  values,
}: Pick<PoiDetailOperatorController, 'coordinateError' | 'setCoordinateValue' | 'values'> &
  Readonly<{ pt: Translate }>) {
  const errorMessage = coordinateError ? pt('validation.geoLocation') : undefined;
  return (
    <StudioFieldGroup columns={2}>
      <StudioField
        id="poi-operator-latitude"
        label={pt('fields.latitude')}
        error={errorMessage}
        errorId="poi-operator-latitude-error"
      >
        <Input
          id="poi-operator-latitude"
          aria-describedby={coordinateError ? 'poi-operator-latitude-error' : undefined}
          aria-invalid={coordinateError ? true : undefined}
          value={values.latitude}
          onChange={(event) => setCoordinateValue('latitude', event.target.value)}
        />
      </StudioField>
      <StudioField
        id="poi-operator-longitude"
        label={pt('fields.longitude')}
        error={errorMessage}
        errorId="poi-operator-longitude-error"
      >
        <Input
          id="poi-operator-longitude"
          aria-describedby={coordinateError ? 'poi-operator-longitude-error' : undefined}
          aria-invalid={coordinateError ? true : undefined}
          value={values.longitude}
          onChange={(event) => setCoordinateValue('longitude', event.target.value)}
        />
      </StudioField>
    </StudioFieldGroup>
  );
}
