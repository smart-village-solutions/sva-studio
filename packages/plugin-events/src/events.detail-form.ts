import type {
  EventAccessibilityInformation,
  EventAddress,
  EventContact,
  EventContentItem,
  EventFormInput,
  EventOrganizer,
  EventPriceInformation,
  EventWebUrl,
} from './events.types.js';
import { toDateOnlyInputValue } from './events.date-only.js';

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
    contacts: readonly EventContact[];
    organizer: EventOrganizerFormValue;
    priceInformations: readonly EventPriceInformation[];
    accessibilityInformation: EventAccessibilityInformation;
  };
  settings: {
    headerImageAssetId: string;
    pushNotification: boolean;
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
    contacts: [createDefaultContact()],
    organizer: createDefaultOrganizer(),
    priceInformations: [createDefaultPriceInformation()],
    accessibilityInformation: createDefaultAccessibilityInformation(),
  },
  settings: {
    headerImageAssetId: '',
    pushNotification: false,
    visible: true,
    externalId: '',
    keywords: '',
    tags: '',
  },
});

const mapNumberToString = (value?: number) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : '');

const mapGeoLocationToFormValue = (
  value?: { readonly latitude?: number; readonly longitude?: number } | null,
): EventsFormGeoLocationValue => ({
  latitude: mapNumberToString(value?.latitude),
  longitude: mapNumberToString(value?.longitude),
});

const mapAddressToFormValue = (address?: EventAddress): EventAddressFormValue => ({
  addition: address?.addition ?? '',
  street: address?.street ?? '',
  zip: address?.zip ?? '',
  city: address?.city ?? '',
  kind: address?.kind ?? '',
  geoLocation: mapGeoLocationToFormValue(address?.geoLocation),
});

export const mapEventItemToDetailFormValues = (item: EventContentItem): EventsDetailFormValues => ({
  title: item.title,
  basis: {
    categories:
      item.categories?.map((category) => category.name.trim()).filter((name) => name.length > 0) ??
      (item.categoryName ? [item.categoryName] : []),
    pointOfInterestId: item.pointOfInterestId ?? '',
    repeat: item.repeat ?? false,
    recurring: item.recurring ?? '',
    recurringType: item.recurringType ?? '',
    recurringInterval: item.recurringInterval ?? '',
    recurringWeekdays: item.recurringWeekdays ?? [],
  },
  content: {
    description: item.description ?? '',
    dates: item.dates?.length
      ? item.dates.map((entry) => ({
          ...entry,
          dateStart: toDateOnlyInputValue(entry.dateStart),
          dateEnd: toDateOnlyInputValue(entry.dateEnd),
        }))
      : [createDefaultDate()],
    addresses: item.addresses?.length ? item.addresses.map(mapAddressToFormValue) : [createDefaultAddress()],
    urls: item.urls?.length ? item.urls : [createDefaultUrl()],
    contacts: item.contacts?.length ? item.contacts : [createDefaultContact()],
    organizer: item.organizer
      ? {
          ...item.organizer,
          address: mapAddressToFormValue(item.organizer.address),
        }
      : createDefaultOrganizer(),
    priceInformations: item.priceInformations?.length ? item.priceInformations : [createDefaultPriceInformation()],
    accessibilityInformation: item.accessibilityInformation ?? createDefaultAccessibilityInformation(),
  },
  settings: {
    headerImageAssetId: '',
    pushNotification: item.pushNotification ?? false,
    visible: item.visible ?? true,
    externalId: item.externalId ?? '',
    keywords: item.keywords ?? '',
    tags: (item.tags ?? []).join(', '),
  },
});

const compactString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const compactValidatedNumber = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const compactGeoLocation = (value?: EventsFormGeoLocationValue) => {
  const latitude = compactValidatedNumber(value?.latitude);
  const longitude = compactValidatedNumber(value?.longitude);
  return latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined;
};

export const mapEventsDetailFormValuesToInput = (values: EventsDetailFormValues): EventFormInput => {
  const compactWebUrls = (urls: readonly EventWebUrl[] | undefined) =>
    (urls ?? [])
      .map((entry) => ({
        ...(compactString(entry?.url) ? { url: compactString(entry?.url) as string } : {}),
        ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
      }))
      .filter((entry): entry is { url: string; description?: string } => Boolean(entry.url));

  const contacts = (values.content.contacts ?? [])
    .map((entry) => ({
      ...(compactString(entry.firstName) ? { firstName: compactString(entry.firstName) } : {}),
      ...(compactString(entry.lastName) ? { lastName: compactString(entry.lastName) } : {}),
      ...(compactString(entry.phone) ? { phone: compactString(entry.phone) } : {}),
      ...(compactString(entry.fax) ? { fax: compactString(entry.fax) } : {}),
      ...(compactString(entry.email) ? { email: compactString(entry.email) } : {}),
      ...(compactWebUrls(entry.webUrls).length > 0 ? { webUrls: compactWebUrls(entry.webUrls) } : {}),
    }))
    .filter((entry) => Object.keys(entry).length > 0);

  const organizerAddress = values.content.organizer.address;
  const organizerContact = values.content.organizer.contact;
  const organizer = {
    ...(compactString(values.content.organizer.name) ? { name: compactString(values.content.organizer.name) } : {}),
    ...(organizerAddress
      ? {
          address: {
            ...(compactString(organizerAddress.addition) ? { addition: compactString(organizerAddress.addition) } : {}),
            ...(compactString(organizerAddress.street) ? { street: compactString(organizerAddress.street) } : {}),
            ...(compactString(organizerAddress.zip) ? { zip: compactString(organizerAddress.zip) } : {}),
            ...(compactString(organizerAddress.city) ? { city: compactString(organizerAddress.city) } : {}),
            ...(compactString(organizerAddress.kind) ? { kind: compactString(organizerAddress.kind) } : {}),
            ...(compactGeoLocation(organizerAddress.geoLocation)
              ? { geoLocation: compactGeoLocation(organizerAddress.geoLocation) }
              : {}),
          },
        }
      : {}),
    ...(organizerContact
      ? {
          contact: {
            ...(compactString(organizerContact.firstName) ? { firstName: compactString(organizerContact.firstName) } : {}),
            ...(compactString(organizerContact.lastName) ? { lastName: compactString(organizerContact.lastName) } : {}),
            ...(compactString(organizerContact.phone) ? { phone: compactString(organizerContact.phone) } : {}),
            ...(compactString(organizerContact.fax) ? { fax: compactString(organizerContact.fax) } : {}),
            ...(compactString(organizerContact.email) ? { email: compactString(organizerContact.email) } : {}),
            ...(compactWebUrls(organizerContact.webUrls).length > 0
              ? { webUrls: compactWebUrls(organizerContact.webUrls) }
              : {}),
          },
        }
      : {}),
  };

  const prices = (values.content.priceInformations ?? [])
    .map((entry) => ({
      ...(compactString(entry.name) ? { name: compactString(entry.name) } : {}),
      ...(entry.amount !== undefined && Number.isFinite(entry.amount) ? { amount: entry.amount } : {}),
      ...(compactString(entry.description) ? { description: compactString(entry.description) } : {}),
      ...(compactString(entry.category) ? { category: compactString(entry.category) } : {}),
    }))
    .filter((entry) => Object.keys(entry).length > 0);

  const accessibility = {
    ...(compactString(values.content.accessibilityInformation.description)
      ? { description: compactString(values.content.accessibilityInformation.description) }
      : {}),
    ...(compactString(values.content.accessibilityInformation.types)
      ? { types: compactString(values.content.accessibilityInformation.types) }
      : {}),
    ...(compactWebUrls(values.content.accessibilityInformation.urls).length > 0
      ? { urls: compactWebUrls(values.content.accessibilityInformation.urls) }
      : {}),
  };

  return {
    title: values.title.trim(),
    ...(compactString(values.content.description) ? { description: compactString(values.content.description) } : {}),
    ...((values.basis.categories ?? []).length > 0
      ? {
          categoryName: values.basis.categories[0]?.trim(),
          categories: Array.from(new Set((values.basis.categories ?? []).map((entry) => entry.trim()).filter(Boolean))).map((name) => ({
            name,
          })),
        }
      : {}),
    ...(compactString(values.settings.externalId) ? { externalId: compactString(values.settings.externalId) } : {}),
    ...(compactString(values.settings.keywords) ? { keywords: compactString(values.settings.keywords) } : {}),
    dates: (values.content.dates ?? [])
      .map((entry) => ({
        ...(compactString(entry?.weekday) ? { weekday: compactString(entry?.weekday) } : {}),
        ...(compactString(entry?.dateStart) ? { dateStart: entry?.dateStart } : {}),
        ...(compactString(entry?.dateEnd) ? { dateEnd: entry?.dateEnd } : {}),
        ...(compactString(entry?.timeStart) ? { timeStart: entry?.timeStart } : {}),
        ...(compactString(entry?.timeEnd) ? { timeEnd: entry?.timeEnd } : {}),
        ...(compactString(entry?.timeDescription) ? { timeDescription: compactString(entry?.timeDescription) } : {}),
        ...(entry?.useOnlyTimeDescription ? { useOnlyTimeDescription: true } : {}),
      }))
      .filter((entry) => Object.keys(entry).length > 0),
    addresses: (values.content.addresses ?? [])
      .map((entry) => ({
        ...(compactString(entry?.addition) ? { addition: compactString(entry?.addition) } : {}),
        ...(compactString(entry?.street) ? { street: compactString(entry?.street) } : {}),
        ...(compactString(entry?.zip) ? { zip: compactString(entry?.zip) } : {}),
        ...(compactString(entry?.city) ? { city: compactString(entry?.city) } : {}),
        ...(compactString(entry?.kind) ? { kind: compactString(entry?.kind) } : {}),
        ...(compactGeoLocation(entry?.geoLocation) ? { geoLocation: compactGeoLocation(entry?.geoLocation) } : {}),
      }))
      .filter((entry) => Object.keys(entry).length > 0),
    ...(contacts.length > 0 ? { contacts } : {}),
    ...(compactWebUrls(values.content.urls).length > 0 ? { urls: compactWebUrls(values.content.urls) } : {}),
    ...(Object.keys(organizer).length > 0 ? { organizer } : {}),
    ...(prices.length > 0 ? { priceInformations: prices } : {}),
    ...(Object.keys(accessibility).length > 0 ? { accessibilityInformation: accessibility } : {}),
    ...(compactString(values.basis.pointOfInterestId)
      ? { pointOfInterestId: compactString(values.basis.pointOfInterestId) }
      : {}),
    repeat: values.basis.repeat,
    ...(compactString(values.basis.recurring) ? { recurring: compactString(values.basis.recurring) } : {}),
    ...(compactString(values.basis.recurringType)
      ? { recurringType: compactString(values.basis.recurringType) }
      : {}),
    ...(compactString(values.basis.recurringInterval)
      ? { recurringInterval: compactString(values.basis.recurringInterval) }
      : {}),
    recurringWeekdays: (values.basis.recurringWeekdays ?? []).map((entry) => entry.trim()).filter(Boolean),
    ...(compactString(values.settings.tags)
      ? { tags: values.settings.tags.split(',').map((entry) => entry.trim()).filter(Boolean) }
      : {}),
    pushNotification: values.settings.pushNotification,
    visible: values.settings.visible,
  };
};
