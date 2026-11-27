import { parsePoint, parseRoute, type Coordinates } from './tour-coordinates.js';
import type { Stop } from './tour-create-stations.js';

export type TourAudio = Readonly<{
  id?: string | null;
  captionText?: string | null;
  copyright?: string | null;
  contentType: 'audio';
  sourceUrl: Readonly<{ url: string }>;
}>;

export type TourAudioByTarget = Readonly<Record<string, readonly TourAudio[]>>;
export const tourAudioTarget = 'tour';

type StoredCoordinates = { latitude: number | null; longitude: number | null };
type StoredStop = {
  id: string;
  name: string | null;
  description: string | null;
  geoLocation: StoredCoordinates | null;
  mediaContents?: readonly TourAudio[];
  inheritedPoiMediaContents?: readonly TourAudio[];
};

export type EditableTour = {
  id: string;
  revision: string;
  name: string | null;
  lengthKm: number | null;
  description: string | null;
  geometryTourData: readonly StoredCoordinates[];
  mediaContents?: readonly TourAudio[];
  tourStops: readonly StoredStop[];
};

type StationPatch = {
  id?: string;
  name?: string;
  description?: string | null;
  geoLocation?: Coordinates | null;
  mediaContents?: readonly TourAudio[];
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

const normalizedAudio = (entry: TourAudio) => ({
  contentType: 'audio' as const,
  captionText: entry.captionText ?? '',
  copyright: entry.copyright ?? '',
  sourceUrl: { url: entry.sourceUrl.url },
});

const diffAudio = (
  current: readonly TourAudio[] | undefined,
  initial: readonly TourAudio[] = []
) => {
  if (!current) return undefined;
  const normalized = current.map(normalizedAudio);
  return JSON.stringify(normalized) === JSON.stringify(initial.map(normalizedAudio))
    ? undefined
    : normalized;
};

const stationPatch = (
  stop: Stop,
  initial?: Stop,
  mediaContents?: readonly TourAudio[]
): StationPatch => {
  const patch: StationPatch = { id: stop.id };
  if (mediaContents !== undefined) patch.mediaContents = mediaContents;
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

const tourFieldChanges = (form: FormData, initial: EditableTour) => {
  const field = (name: string) => String(form.get(name) ?? '');
  const name = field('name');
  const length = field('length');
  const description = field('description');
  const route = field('route');
  return {
    ...(name !== (initial.name ?? '') ? { name: name.trim() } : {}),
    ...(length !== String(initial.lengthKm ?? '') ? { lengthKm: Number(length) } : {}),
    ...(description !== (initial.description ?? '')
      ? { description: description.trim() || null }
      : {}),
    ...(route !== routeValue(initial) ? { geometryTourData: parseRoute(route) } : {}),
  };
};

export const buildTourEdit = (
  form: FormData,
  stops: readonly Stop[],
  initial: EditableTour,
  audio: TourAudioByTarget = {}
) => {
  const previousStops = editableStops(initial);
  const stopsById = new Map(previousStops.map((stop) => [stop.id, stop]));
  const storedStops = new Map(initial.tourStops.map((stop) => [stop.id, stop]));
  const stationChanges = stops.map((stop) =>
    stationPatch(
      stop,
      stopsById.get(stop.id),
      diffAudio(audio[stop.key], stop.id ? storedStops.get(stop.id)?.mediaContents : undefined)
    )
  );
  const mediaContents = diffAudio(audio[tourAudioTarget], initial.mediaContents);
  const stationsChanged =
    stationChanges.length !== previousStops.length ||
    stationChanges.some(
      (stop, index) => stop.id !== previousStops[index]?.id || Object.keys(stop).length > 1
    );

  return {
    expectedRevision: initial.revision,
    patch: {
      ...tourFieldChanges(form, initial),
      ...(mediaContents !== undefined ? { mediaContents } : {}),
      ...(stationsChanged ? { tourStops: stationChanges } : {}),
    },
  };
};

const buildDraftStop = (stop: Stop, audio: readonly TourAudio[] = []) => ({
  name: stop.name.trim(),
  description: stop.description.trim() || undefined,
  ...(stop.latitude || stop.longitude
    ? { location: { geoLocation: parsePoint(stop.latitude, stop.longitude) } }
    : {}),
  ...(audio.length ? { mediaContents: audio.map(normalizedAudio) } : {}),
});

export const buildTourDraft = (
  form: FormData,
  stops: readonly Stop[],
  audio: TourAudioByTarget
) => {
  const field = (name: string) => String(form.get(name) ?? '').trim() || undefined;
  const route = parseRoute(field('route') ?? '');
  const category = field('category');
  const company = field('operator');
  const media = field('media');
  const address = { street: field('street'), city: field('city'), zip: field('zip') };
  const contact = { email: field('email'), phone: field('phone') };
  const mediaContents = [
    ...(media
      ? [
          {
            contentType: 'image' as const,
            sourceUrl: { url: media },
            copyright: field('copyright'),
            captionText: field('caption'),
          },
        ]
      : []),
    ...(audio[tourAudioTarget] ?? []).map(normalizedAudio),
  ];
  return {
    name: field('name'),
    lengthKm: Number(field('length')),
    visible: false as const,
    description: field('description'),
    ...(category ? { categories: [{ id: category }] } : {}),
    ...(Object.values(address).some(Boolean) ? { addresses: [address] } : {}),
    ...(Object.values(contact).some(Boolean) ? { contact } : {}),
    ...(company ? { operatingCompany: { name: company } } : {}),
    ...(mediaContents.length ? { mediaContents } : {}),
    ...(route.length ? { geometryTourData: route } : {}),
    tourStops: stops.map((stop) => buildDraftStop(stop, audio[stop.key])),
  };
};
