import type { EventContact, EventFormInput, EventWebUrl } from './events.types.js';
import { normalizeMediaContentType } from './events.detail-media-content-type.js';
import {
  compactEventString,
  serializeEventWebUrls,
} from './events.detail-form-serialization-common.js';

type SerializableGeoLocation = Readonly<{
  latitude?: string | null;
  longitude?: string | null;
}>;

type SerializableAddress = Readonly<{
  addition?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  kind?: string | null;
  geoLocation?: SerializableGeoLocation;
}>;

type SerializableOrganizer = Readonly<{
  name?: string | null;
  address?: SerializableAddress;
  contact?: EventContact;
}>;

type SerializableMediaContent = Readonly<{
  captionText?: string | null;
  copyright?: string | null;
  height?: string | number | null;
  width?: string | number | null;
  contentType?: string | null;
  sourceUrl?: EventWebUrl;
}>;

const compactFiniteNumber = (value?: string | number | null) => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim().length === 0)
  ) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const serializeGeoLocation = (value?: SerializableGeoLocation) => {
  const latitude = compactFiniteNumber(value?.latitude);
  const longitude = compactFiniteNumber(value?.longitude);
  return latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined;
};

const serializeAddressText = (address: SerializableAddress | undefined | null) => ({
  ...(compactEventString(address?.addition)
    ? { addition: compactEventString(address?.addition) }
    : {}),
  ...(compactEventString(address?.street) ? { street: compactEventString(address?.street) } : {}),
});

const serializeAddressPlace = (address: SerializableAddress | undefined | null) => ({
  ...(compactEventString(address?.zip) ? { zip: compactEventString(address?.zip) } : {}),
  ...(compactEventString(address?.city) ? { city: compactEventString(address?.city) } : {}),
});

const serializeAddressKind = (address: SerializableAddress | undefined | null) => ({
  ...(compactEventString(address?.kind) ? { kind: compactEventString(address?.kind) } : {}),
});

const serializeEventAddress = (address: SerializableAddress | undefined | null) => ({
  ...serializeAddressText(address),
  ...serializeAddressPlace(address),
  ...serializeAddressKind(address),
  ...(serializeGeoLocation(address?.geoLocation)
    ? { geoLocation: serializeGeoLocation(address?.geoLocation) }
    : {}),
});

export const serializeEventAddresses = (
  addresses: readonly SerializableAddress[] | undefined | null
) => (addresses ?? []).map(serializeEventAddress).filter((entry) => Object.keys(entry).length > 0);

export const serializeEventOrganizer = (organizer: SerializableOrganizer) => {
  const address = organizer.address;
  const contact = organizer.contact;

  return {
    ...(compactEventString(organizer.name) ? { name: compactEventString(organizer.name) } : {}),
    ...(address ? { address: serializeEventAddress(address) } : {}),
    ...(contact
      ? {
          contact: {
            ...(compactEventString(contact.firstName)
              ? { firstName: compactEventString(contact.firstName) }
              : {}),
            ...(compactEventString(contact.lastName)
              ? { lastName: compactEventString(contact.lastName) }
              : {}),
            ...(compactEventString(contact.phone)
              ? { phone: compactEventString(contact.phone) }
              : {}),
            ...(compactEventString(contact.fax) ? { fax: compactEventString(contact.fax) } : {}),
            ...(compactEventString(contact.email)
              ? { email: compactEventString(contact.email) }
              : {}),
            ...(serializeEventWebUrls(contact.webUrls).length > 0
              ? { webUrls: serializeEventWebUrls(contact.webUrls) }
              : {}),
          },
        }
      : {}),
  };
};

export const serializeEventMediaContents = (
  mediaContents: readonly (SerializableMediaContent | null)[] | undefined | null
) =>
  (mediaContents ?? [])
    .filter((entry): entry is SerializableMediaContent => entry !== null)
    .map(serializeEventMediaContent)
    .filter((entry) => Object.keys(entry).length > 0);

const serializeEventMediaText = (entry: SerializableMediaContent) => ({
  ...(compactEventString(entry.captionText)
    ? { captionText: compactEventString(entry.captionText) }
    : {}),
  ...(compactEventString(entry.copyright)
    ? { copyright: compactEventString(entry.copyright) }
    : {}),
  ...(normalizeMediaContentType(entry.contentType)
    ? { contentType: normalizeMediaContentType(entry.contentType) }
    : {}),
});

const serializeEventMediaDimensions = (entry: SerializableMediaContent) => ({
  ...(compactFiniteNumber(entry.height) !== undefined
    ? { height: compactFiniteNumber(entry.height) }
    : {}),
  ...(compactFiniteNumber(entry.width) !== undefined
    ? { width: compactFiniteNumber(entry.width) }
    : {}),
});

const serializeEventMediaSource = (entry: SerializableMediaContent) => {
  const sourceUrls = entry.sourceUrl ? serializeEventWebUrls([entry.sourceUrl]) : [];
  return sourceUrls.length > 0 ? { sourceUrl: sourceUrls[0] } : {};
};

function serializeEventMediaContent(entry: SerializableMediaContent) {
  return {
    ...serializeEventMediaText(entry),
    ...serializeEventMediaDimensions(entry),
    ...serializeEventMediaSource(entry),
  };
}

export const serializeEventDates = (dates: EventFormInput['dates']) =>
  (dates ?? []).map(serializeEventDate).filter((entry) => Object.keys(entry).length > 0);

const serializeEventCalendarDays = (
  entry: NonNullable<EventFormInput['dates']>[number] | null
) => ({
  ...(compactEventString(entry?.dateStart) ? { dateStart: entry?.dateStart } : {}),
  ...(compactEventString(entry?.dateEnd) ? { dateEnd: entry?.dateEnd } : {}),
});

const serializeEventWeekday = (entry: NonNullable<EventFormInput['dates']>[number] | null) => ({
  ...(compactEventString(entry?.weekday) ? { weekday: compactEventString(entry?.weekday) } : {}),
});

const serializeEventTimes = (entry: NonNullable<EventFormInput['dates']>[number] | null) => ({
  ...(compactEventString(entry?.timeStart) ? { timeStart: entry?.timeStart } : {}),
  ...(compactEventString(entry?.timeEnd) ? { timeEnd: entry?.timeEnd } : {}),
});

const serializeEventTimeDescription = (
  entry: NonNullable<EventFormInput['dates']>[number] | null
) => ({
  ...(compactEventString(entry?.timeDescription)
    ? { timeDescription: compactEventString(entry?.timeDescription) }
    : {}),
  ...(entry?.useOnlyTimeDescription ? { useOnlyTimeDescription: true } : {}),
});

const serializeEventDate = (entry: NonNullable<EventFormInput['dates']>[number] | null) => ({
  ...serializeEventWeekday(entry),
  ...serializeEventCalendarDays(entry),
  ...serializeEventTimes(entry),
  ...serializeEventTimeDescription(entry),
});
