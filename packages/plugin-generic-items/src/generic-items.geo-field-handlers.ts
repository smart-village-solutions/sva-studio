import * as React from 'react';

import { resolveGenericItemsMapGeocodingMessageKey } from './generic-items.map-geocoding-messages.js';

type GeoState = {
  handleGeocode: () => Promise<void>;
  handleReverseGeocode: () => Promise<void>;
  setGeocodingError: (message: string) => void;
};

type Translator = (key: string) => string;

const wrapGeocodingHandler =
  (action: () => Promise<void>, geoState: GeoState, pt: Translator) => () =>
    void action().catch((error) => {
      geoState.setGeocodingError(pt(resolveGenericItemsMapGeocodingMessageKey(error)));
    });

export const useGenericItemsGeocodingHandlers = ({
  geoState,
  pt,
}: Readonly<{
  geoState: GeoState;
  pt: Translator;
}>) => ({
  handleGeocode: React.useCallback(
    wrapGeocodingHandler(geoState.handleGeocode, geoState, pt),
    [geoState, pt]
  ),
  handleReverseGeocode: React.useCallback(
    wrapGeocodingHandler(geoState.handleReverseGeocode, geoState, pt),
    [geoState, pt]
  ),
});
