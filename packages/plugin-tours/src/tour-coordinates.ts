export type Coordinates = { latitude: number; longitude: number };
export const parsePoint = (latitude: string, longitude: string): Coordinates => {
  const point = { latitude: Number(latitude), longitude: Number(longitude) };
  if (
    !latitude.trim() ||
    !longitude.trim() ||
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180
  )
    throw new Error('coordinatesInvalid');
  return point;
};

export const parseRoute = (value: string) => {
  const route = value
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const coordinates = line.trim().split(/\s+/u);
      if (coordinates.length !== 2) throw new Error('coordinatesInvalid');
      return parsePoint(coordinates[0]!, coordinates[1]!);
    });
  if (route.length === 1) throw new Error('coordinatesInvalid');
  return route;
};
