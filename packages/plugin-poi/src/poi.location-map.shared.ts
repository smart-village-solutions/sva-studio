export const defaultPoiMapCenter = { latitude: 52.52, longitude: 13.405 } as const;

export const toCoordinateString = (value: number): string => value.toFixed(6);

export const parseCoordinate = (value?: string): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolvePoiMapCenter = (latitude?: string, longitude?: string) => {
  const parsedLatitude = parseCoordinate(latitude);
  const parsedLongitude = parseCoordinate(longitude);

  if (parsedLatitude === null || parsedLongitude === null) {
    return defaultPoiMapCenter;
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
};
