export const defaultPoiMapCenter = { latitude: 51.163361, longitude: 10.447683 } as const;
export const defaultPoiMapZoom = 5.8;
export const focusedPoiMapZoom = 19;

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
