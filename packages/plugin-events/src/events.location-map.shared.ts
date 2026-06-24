export const defaultEventMapCenter = { latitude: 51.163361, longitude: 10.447683 } as const;
export const defaultEventMapZoom = 5.8;
export const focusedEventMapZoom = 19;

export const toCoordinateString = (value: number): string => value.toFixed(6);

export const parseCoordinate = (value?: string): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveEventMapCenter = (latitude?: string, longitude?: string) => {
  const parsedLatitude = parseCoordinate(latitude);
  const parsedLongitude = parseCoordinate(longitude);

  if (parsedLatitude === null || parsedLongitude === null) {
    return defaultEventMapCenter;
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
};
