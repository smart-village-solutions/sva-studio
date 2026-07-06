import * as React from 'react';

type Translator = (key: string) => string;

export const useGenericItemsGeoFieldState = ({
  geocodingEnabled,
  geocodeAddress,
  hasGeocodingInput,
  hasReverseGeocodingInput,
  pt,
  reverseGeocodeAddress,
  reverseGeocodingEnabled,
}: Readonly<{
  geocodingEnabled: boolean;
  geocodeAddress: () => Promise<void>;
  hasGeocodingInput: boolean;
  hasReverseGeocodingInput: boolean;
  pt: Translator;
  reverseGeocodeAddress: () => Promise<void>;
  reverseGeocodingEnabled: boolean;
}>) => {
  const [mapError, setMapError] = React.useState<string | null>(null);
  const [geocodingError, setGeocodingError] = React.useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = React.useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = React.useState(false);

  const handleGeocode = React.useCallback(async () => {
    if (!geocodingEnabled || !hasGeocodingInput) {
      setGeocodingError(pt('messages.locationGeocodeDisabled'));
      return;
    }

    setIsGeocoding(true);
    setGeocodingError(null);
    try {
      await geocodeAddress();
      setMapError(null);
    } finally {
      setIsGeocoding(false);
    }
  }, [geocodeAddress, geocodingEnabled, hasGeocodingInput, pt]);

  const handleReverseGeocode = React.useCallback(async () => {
    if (!reverseGeocodingEnabled || !hasReverseGeocodingInput) {
      setGeocodingError(pt('messages.locationGeocodeDisabled'));
      return;
    }

    setIsReverseGeocoding(true);
    setGeocodingError(null);
    try {
      await reverseGeocodeAddress();
      setMapError(null);
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [hasReverseGeocodingInput, pt, reverseGeocodeAddress, reverseGeocodingEnabled]);

  return {
    geocodingError,
    handleGeocode,
    handleReverseGeocode,
    isGeocoding,
    isReverseGeocoding,
    mapError,
    setGeocodingError,
    setMapError,
  };
};
