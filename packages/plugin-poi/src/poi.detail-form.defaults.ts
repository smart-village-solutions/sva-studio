import type {
  PoiAccessibilityInformation,
  PoiCertificate,
  PoiContact,
  PoiMediaContent,
  PoiWebUrl,
} from './poi.content.types.js';
import type {
  PoiAddressFormValue,
  PoiDetailFormValues,
  PoiFormGeoLocationValue,
  PoiLocationFormValue,
  PoiOperatingCompanyFormValue,
  PoiPriceFormValue,
} from './poi.detail-form.types.js';

export const createDefaultGeoLocation = (): PoiFormGeoLocationValue => ({ latitude: '', longitude: '' });

export const createDefaultAddress = (): PoiAddressFormValue => ({
  addition: '',
  street: '',
  zip: '',
  city: '',
  kind: '',
  geoLocation: createDefaultGeoLocation(),
});

export const createDefaultContact = (): PoiContact => ({
  firstName: '',
  lastName: '',
  phone: '',
  fax: '',
  email: '',
  webUrls: [],
});

export const createDefaultOpeningHour = () => ({
  weekday: '',
  dateFrom: '',
  dateTo: '',
  timeFrom: '',
  timeTo: '',
  open: true,
  description: '',
});

export const createDefaultWebUrl = (): PoiWebUrl => ({ url: '', description: '' });

export const createDefaultLocation = (): PoiLocationFormValue => ({
  name: '',
  department: '',
  district: '',
  regionName: '',
  state: '',
  geoLocation: createDefaultGeoLocation(),
});

export const createDefaultOperator = (): PoiOperatingCompanyFormValue => ({
  name: '',
  address: createDefaultAddress(),
  contact: createDefaultContact(),
});

export const createDefaultPrice = (): PoiPriceFormValue => ({
  name: '',
  amount: '',
  groupPrice: false,
  ageFrom: '',
  ageTo: '',
  minAdultCount: '',
  maxAdultCount: '',
  minChildrenCount: '',
  maxChildrenCount: '',
  description: '',
  category: '',
});

export const createDefaultMediaContent = (): PoiMediaContent => ({
  captionText: '',
  copyright: '',
  contentType: '',
  sourceUrl: createDefaultWebUrl(),
});

export const createDefaultCertificate = (): PoiCertificate => ({ name: '' });

export const createDefaultAccessibilityInformation = (): PoiAccessibilityInformation => ({
  description: '',
  types: '',
  urls: [],
});

export const createDefaultPoiDetailFormValues = (): PoiDetailFormValues => ({
  name: '',
  basis: {
    categories: [],
    active: true,
  },
  content: {
    description: '',
    mobileDescription: '',
    addresses: [createDefaultAddress()],
    location: createDefaultLocation(),
    contact: createDefaultContact(),
    openingHours: [createDefaultOpeningHour()],
    webUrls: [createDefaultWebUrl()],
    operator: createDefaultOperator(),
    prices: [createDefaultPrice()],
    mediaContents: [],
    certificates: [createDefaultCertificate()],
    accessibilityInformation: createDefaultAccessibilityInformation(),
    tagsText: '',
    payloadText: '{}',
  },
  settings: {
    externalId: '',
    keywords: '',
  },
});
