import type {
  EventAccessibilityInformation,
  EventAddress,
  EventContact,
  EventContentItem,
  EventFormInput,
  EventMediaContent,
  EventOrganizer,
  EventPriceInformation,
  EventWebUrl,
} from './events.types.js';
import { toDateOnlyInputValue } from './events.date-only.js';
import {
  serializeEventAccessibility,
  serializeEventBasis,
  serializeEventContacts,
  serializeEventPrices,
  serializeEventSettings,
} from './events.detail-form-input-serializers.js';
import {
  serializeEventAddresses,
  serializeEventDates,
  serializeEventMediaContents,
  serializeEventOrganizer,
} from './events.detail-form-structured-serializers.js';
import {
  compactEventString,
  serializeEventWebUrls,
} from './events.detail-form-serialization-common.js';

export type EventsFormGeoLocationValue = Readonly<{
  latitude: string;
  longitude: string;
}>;

export type EventAddressFormValue = Omit<EventAddress, 'geoLocation'> &
  Readonly<{
    geoLocation?: EventsFormGeoLocationValue;
  }>;

export type EventOrganizerFormValue = Omit<EventOrganizer, 'address'> &
  Readonly<{
    address?: EventAddressFormValue;
  }>;

export type EventMediaContentFormValue = Omit<EventMediaContent, 'height' | 'sourceUrl' | 'width'> &
  Readonly<{
    height: string;
    width: string;
    sourceUrl: { url: string; description: string };
  }>;

export type EventsDetailFormValues = Readonly<{
  title: string;
  basis: {
    categories: string[];
    pointOfInterestId: string;
    repeat: boolean;
    recurring: string;
    recurringType: string;
    recurringInterval: string;
    recurringWeekdays: readonly string[];
  };
  content: {
    description: string;
    dates: EventFormInput['dates'];
    addresses: readonly EventAddressFormValue[];
    urls: EventFormInput['urls'];
    mediaContents: readonly EventMediaContentFormValue[];
    contacts: readonly EventContact[];
    organizer: EventOrganizerFormValue;
    priceInformations: readonly EventPriceInformation[];
    accessibilityInformation: EventAccessibilityInformation;
  };
  settings: {
    visible: boolean;
    externalId: string;
    keywords: string;
    tags: string;
  };
}>;

export const createDefaultDate = () => ({
  weekday: '',
  dateStart: '',
  dateEnd: '',
  timeStart: '',
  timeEnd: '',
  timeDescription: '',
  useOnlyTimeDescription: false,
});
export const createDefaultGeoLocation = (): EventsFormGeoLocationValue => ({
  latitude: '',
  longitude: '',
});

export const createDefaultAddress = (): EventAddressFormValue => ({
  addition: '',
  street: '',
  zip: '',
  city: '',
  kind: '',
  geoLocation: createDefaultGeoLocation(),
});
export const createDefaultContact = (): EventContact => ({
  firstName: '',
  lastName: '',
  phone: '',
  fax: '',
  email: '',
  webUrls: [{ url: '', description: '' }],
});
export const createDefaultUrl = (): EventWebUrl => ({ url: '', description: '' });
export const createDefaultMediaContent = (): EventMediaContentFormValue => ({
  captionText: '',
  copyright: '',
  contentType: '',
  sourceUrl: { url: '', description: '' },
  height: '',
  width: '',
});
export const createDefaultOrganizer = (): EventOrganizerFormValue => ({
  name: '',
  address: createDefaultAddress(),
  contact: createDefaultContact(),
});
export const createDefaultPriceInformation = (): EventPriceInformation => ({
  category: '',
  description: '',
  amount: undefined,
});
export const createDefaultAccessibilityInformation = (): EventAccessibilityInformation => ({
  description: '',
  types: '',
  urls: [{ url: '', description: '' }],
});

export const createDefaultEventsDetailFormValues = (): EventsDetailFormValues => ({
  title: '',
  basis: {
    categories: [],
    pointOfInterestId: '',
    repeat: false,
    recurring: '',
    recurringType: '',
    recurringInterval: '',
    recurringWeekdays: [],
  },
  content: {
    description: '',
    dates: [createDefaultDate()],
    addresses: [createDefaultAddress()],
    urls: [createDefaultUrl()],
    mediaContents: [],
    contacts: [createDefaultContact()],
    organizer: createDefaultOrganizer(),
    priceInformations: [createDefaultPriceInformation()],
    accessibilityInformation: createDefaultAccessibilityInformation(),
  },
  settings: {
    visible: true,
    externalId: '',
    keywords: '',
    tags: '',
  },
});

const mapNumberToString = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

const mapGeoLocationToFormValue = (
  value?: { readonly latitude?: number; readonly longitude?: number } | null
): EventsFormGeoLocationValue => ({
  latitude: mapNumberToString(value?.latitude),
  longitude: mapNumberToString(value?.longitude),
});

const mapAddressTextToFormValue = (address?: EventAddress) => ({
  addition: address?.addition ?? '',
  street: address?.street ?? '',
  kind: address?.kind ?? '',
});

const mapAddressPlaceToFormValue = (address?: EventAddress) => ({
  zip: address?.zip ?? '',
  city: address?.city ?? '',
});

const mapAddressToFormValue = (address?: EventAddress): EventAddressFormValue => ({
  ...mapAddressTextToFormValue(address),
  ...mapAddressPlaceToFormValue(address),
  geoLocation: mapGeoLocationToFormValue(address?.geoLocation),
});

const mapMediaContentToFormValue = (
  mediaContent: NonNullable<NonNullable<EventContentItem['mediaContents']>[number]>
): EventMediaContentFormValue => ({
  captionText: mediaContent.captionText ?? '',
  copyright: mediaContent.copyright ?? '',
  contentType: mediaContent.contentType ?? '',
  sourceUrl: {
    url: mediaContent.sourceUrl?.url ?? '',
    description: mediaContent.sourceUrl?.description ?? '',
  },
  height: mapNumberToString(mediaContent.height),
  width: mapNumberToString(mediaContent.width),
});

const mapEventDatesToFormValue = (dates: EventContentItem['dates']) =>
  dates?.length
    ? dates.map((entry) => ({
        ...entry,
        dateStart: toDateOnlyInputValue(entry.dateStart),
        dateEnd: toDateOnlyInputValue(entry.dateEnd),
      }))
    : [createDefaultDate()];

const mapEventOrganizerToFormValue = (organizer: EventContentItem['organizer']) =>
  organizer
    ? {
        ...organizer,
        address: mapAddressToFormValue(organizer.address),
      }
    : createDefaultOrganizer();

const mapEventAddressesToFormValue = (addresses: EventContentItem['addresses']) =>
  addresses?.length ? addresses.map(mapAddressToFormValue) : [createDefaultAddress()];

const mapEventUrlsToFormValue = (urls: EventContentItem['urls']) =>
  urls?.length ? urls : [createDefaultUrl()];

const mapEventMediaToFormValue = (mediaContents: EventContentItem['mediaContents']) =>
  mediaContents?.length ? mediaContents.map(mapMediaContentToFormValue) : [];

const mapEventContactsToFormValue = (contacts: EventContentItem['contacts']) =>
  contacts?.length ? contacts : [createDefaultContact()];

const mapEventPricesToFormValue = (prices: EventContentItem['priceInformations']) =>
  prices?.length ? prices : [createDefaultPriceInformation()];

const mapEventBasisToFormValue = (item: EventContentItem): EventsDetailFormValues['basis'] => ({
  categories:
    item.categories?.map((category) => category.name.trim()).filter((name) => name.length > 0) ??
    (item.categoryName ? [item.categoryName] : []),
  pointOfInterestId: item.pointOfInterestId ?? '',
  repeat: item.repeat ?? false,
  recurring: item.recurring ?? '',
  recurringType: item.recurringType ?? '',
  recurringInterval: item.recurringInterval ?? '',
  recurringWeekdays: item.recurringWeekdays ?? [],
});

const mapEventContentToFormValue = (item: EventContentItem): EventsDetailFormValues['content'] => ({
  description: item.description ?? '',
  dates: mapEventDatesToFormValue(item.dates),
  addresses: mapEventAddressesToFormValue(item.addresses),
  urls: mapEventUrlsToFormValue(item.urls),
  mediaContents: mapEventMediaToFormValue(item.mediaContents),
  contacts: mapEventContactsToFormValue(item.contacts),
  organizer: mapEventOrganizerToFormValue(item.organizer),
  priceInformations: mapEventPricesToFormValue(item.priceInformations),
  accessibilityInformation:
    item.accessibilityInformation ?? createDefaultAccessibilityInformation(),
});

const mapEventSettingsToFormValue = (
  item: EventContentItem
): EventsDetailFormValues['settings'] => ({
  visible: item.visible ?? true,
  externalId: item.externalId ?? '',
  keywords: item.keywords ?? '',
  tags: (item.tags ?? []).join(', '),
});

export const mapEventItemToDetailFormValues = (item: EventContentItem): EventsDetailFormValues => ({
  title: item.title,
  basis: mapEventBasisToFormValue(item),
  content: mapEventContentToFormValue(item),
  settings: mapEventSettingsToFormValue(item),
});

export const mapEventsDetailFormValuesToInput = (
  values: EventsDetailFormValues
): EventFormInput => {
  const contacts = serializeEventContacts(values.content.contacts);
  const organizer = serializeEventOrganizer(values.content.organizer);
  const prices = serializeEventPrices(values.content.priceInformations);
  const accessibility = serializeEventAccessibility(values.content.accessibilityInformation);
  const mediaContents = serializeEventMediaContents(values.content.mediaContents);
  const urls = serializeEventWebUrls(values.content.urls);

  return {
    title: values.title.trim(),
    ...(compactEventString(values.content.description)
      ? { description: compactEventString(values.content.description) }
      : {}),
    ...serializeEventSettings(values.settings),
    dates: serializeEventDates(values.content.dates),
    addresses: serializeEventAddresses(values.content.addresses),
    ...(contacts.length > 0 ? { contacts } : {}),
    ...(urls.length > 0 ? { urls } : {}),
    ...(mediaContents.length > 0 ? { mediaContents } : {}),
    ...(Object.keys(organizer).length > 0 ? { organizer } : {}),
    ...(prices.length > 0 ? { priceInformations: prices } : {}),
    ...(Object.keys(accessibility).length > 0 ? { accessibilityInformation: accessibility } : {}),
    ...serializeEventBasis(values.basis),
  };
};
