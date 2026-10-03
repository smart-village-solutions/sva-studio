import type {
  EventAccessibilityInformation,
  EventContact,
  EventPriceInformation,
  EventWebUrl,
} from './events.types.js';
import type {
  EventsFormGeoLocationValue,
  EventAddressFormValue,
  EventMediaContentFormValue,
  EventOrganizerFormValue,
  EventsDetailFormValues,
} from './events.detail-form-types.js';

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
