type GenericItemsMapGeocodingMessageKey =
  | 'messages.locationGeocodeDisabled'
  | 'messages.locationGeocodeEmpty'
  | 'messages.locationGeocodeRateLimited'
  | 'messages.locationGeocodeTimeout'
  | 'messages.locationGeocodeForbidden'
  | 'messages.locationGeocodeUnauthorized'
  | 'messages.locationGeocodeError';

const readErrorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return error instanceof Error ? error.message : '';
};

export const resolveGenericItemsMapGeocodingMessageKey = (error: unknown): GenericItemsMapGeocodingMessageKey => {
  switch (readErrorCode(error)) {
    case 'disabled':
    case 'invalid_config':
      return 'messages.locationGeocodeDisabled';
    case 'no_result':
      return 'messages.locationGeocodeEmpty';
    case 'rate_limited':
      return 'messages.locationGeocodeRateLimited';
    case 'timeout':
    case 'mainserver_timeout':
      return 'messages.locationGeocodeTimeout';
    case 'forbidden':
      return 'messages.locationGeocodeForbidden';
    case 'unauthorized':
      return 'messages.locationGeocodeUnauthorized';
    default:
      return 'messages.locationGeocodeError';
  }
};
