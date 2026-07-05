import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

export const createDefaultWebUrlFormValue = () => ({
  url: '',
  description: '',
});

export const createDefaultAccessibilityInformationFormValue = () => ({
  description: '',
  types: '',
  urls: [createDefaultWebUrlFormValue()],
});

export const createDefaultContactFormValue = () => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
});

export const createDefaultAddressFormValue = () => ({
  addition: '',
  street: '',
  zip: '',
  city: '',
  kind: '',
  latitude: '',
  longitude: '',
});

export const createDefaultDateFormValue = () => ({
  weekday: '',
  dateStart: '',
  dateEnd: '',
  timeStart: '',
  timeEnd: '',
  timeDescription: '',
  useOnlyTimeDescription: false,
});

export const createDefaultPriceInformationFormValue = () => ({
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

export const createDefaultContentBlockFormValue = () => ({
  title: '',
  intro: '',
  body: '',
  mediaContents: [],
});

export const createDefaultOpeningHourFormValue = () => ({
  weekday: '',
  dateFrom: '',
  dateTo: '',
  timeFrom: '',
  timeTo: '',
  description: '',
  open: false,
});

export const createDefaultLocationFormValue = () => ({
  name: '',
  department: '',
  district: '',
  regionName: '',
  state: '',
  latitude: '',
  longitude: '',
});

export const createDefaultGenericItemsDetailFormValues = (): GenericItemsDetailFormValues => ({
  title: '',
  genericType: '',
  teaser: '',
  visible: true,
  author: '',
  keywords: '',
  externalId: '',
  publicationDate: '',
  publishedAt: '',
  categories: [],
  contacts: [createDefaultContactFormValue()],
  webUrls: [createDefaultWebUrlFormValue()],
  addresses: [createDefaultAddressFormValue()],
  contentBlocks: [createDefaultContentBlockFormValue()],
  openingHours: [createDefaultOpeningHourFormValue()],
  mediaContents: [],
  locations: [createDefaultLocationFormValue()],
  dates: [createDefaultDateFormValue()],
  accessibilityInformations: [createDefaultAccessibilityInformationFormValue()],
  priceInformations: [createDefaultPriceInformationFormValue()],
  payloadText: '{}',
});
