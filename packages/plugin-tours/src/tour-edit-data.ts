import { parsePoint, parseRoute, type Coordinates } from './tour-coordinates.js';
import type { Stop } from './tour-create-stations.js';

type StoredCoordinates = { latitude: number | null; longitude: number | null };
type StoredStop = {
  id: string;
  name: string | null;
  description: string | null;
  geoLocation: StoredCoordinates | null;
};

export type EditableTour = {
  id: string;
  revision: string;
  name: string | null;
  lengthKm: number | null;
  description: string | null;
  geometryTourData: readonly StoredCoordinates[];
  tourStops: readonly StoredStop[];
};

type StationPatch = {
  id?: string;
  name?: string;
  description?: string | null;
  geoLocation?: Coordinates | null;
};

export const routeValue = (tour: EditableTour) =>
  tour.geometryTourData
    .map(({ latitude, longitude }) => `${latitude ?? ''} ${longitude ?? ''}`)
    .join('\n');

export const editableStops = (tour: EditableTour): Stop[] =>
  tour.tourStops.map((stop) => ({
    key: stop.id,
    id: stop.id,
    name: stop.name ?? '',
    description: stop.description ?? '',
    latitude: String(stop.geoLocation?.latitude ?? ''),
    longitude: String(stop.geoLocation?.longitude ?? ''),
  }));

const stationPatch = (stop: Stop, initial?: Stop): StationPatch => {
  const patch: StationPatch = { id: stop.id };
  if (stop.name !== (initial?.name ?? '')) patch.name = stop.name.trim();
  if (stop.description !== (initial?.description ?? ''))
    patch.description = stop.description.trim() || null;
  if (
    stop.latitude !== (initial?.latitude ?? '') ||
    stop.longitude !== (initial?.longitude ?? '')
  ) {
    patch.geoLocation =
      stop.latitude || stop.longitude ? parsePoint(stop.latitude, stop.longitude) : null;
  }
  return patch;
};

export const buildTourEdit = (form: FormData, stops: readonly Stop[], initial: EditableTour) => {
  const field = (name: string) => String(form.get(name) ?? '');
  const name = field('name');
  const length = field('length');
  const description = field('description');
  const route = field('route');
  const previousStops = editableStops(initial);
  const stopsById = new Map(previousStops.map((stop) => [stop.id, stop]));
  const stationChanges = stops.map((stop) => stationPatch(stop, stopsById.get(stop.id)));
  const stationsChanged =
    stationChanges.length !== previousStops.length ||
    stationChanges.some(
      (stop, index) => stop.id !== previousStops[index]?.id || Object.keys(stop).length > 1
    );

  return {
    expectedRevision: initial.revision,
    patch: {
      ...(name !== (initial.name ?? '') ? { name: name.trim() } : {}),
      ...(length !== String(initial.lengthKm ?? '') ? { lengthKm: Number(length) } : {}),
      ...(description !== (initial.description ?? '')
        ? { description: description.trim() || null }
        : {}),
      ...(route !== routeValue(initial) ? { geometryTourData: parseRoute(route) } : {}),
      ...(stationsChanged ? { tourStops: stationChanges } : {}),
    },
  };
};
