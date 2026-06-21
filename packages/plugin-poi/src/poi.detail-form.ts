import type {
  PoiAccessibilityInformation,
  PoiAddress,
  PoiCertificate,
  PoiContact,
  PoiContentItem,
  PoiFormInput,
  PoiLocation,
  PoiMediaContent,
  PoiPriceInformation,
  PoiWebUrl,
} from './poi.types.js';

type PoiFormGeoLocationValue = Readonly<{
  latitude: string;
  longitude: string;
}>;

type PoiAddressFormValue = Omit<PoiAddress, 'geoLocation'> & Readonly<{
  geoLocation?: PoiFormGeoLocationValue;
}>;

type PoiLocationFormValue = Omit<PoiLocation, 'geoLocation'> & Readonly<{
  geoLocation?: PoiFormGeoLocationValue;
}>;

type PoiOperatingCompanyFormValue = Readonly<{
  name?: string;
  address?: PoiAddressFormValue;
  contact?: PoiContact;
}>;

type PoiPriceFormValue = Omit<PoiPriceInformation, 'amount' | 'ageFrom' | 'ageTo' | 'minAdultCount' | 'maxAdultCount' | 'minChildrenCount' | 'maxChildrenCount'> & Readonly<{
  amount?: string;
  ageFrom?: string;
  ageTo?: string;
  minAdultCount?: string;
  maxAdultCount?: string;
  minChildrenCount?: string;
  maxChildrenCount?: string;
}>;

type PoiMediaAttachment = Readonly<{
  assetId: string;
  label?: string;
}>;

export type PoiDetailFormValues = Readonly<{
  name: string;
  basis: {
    categoryName: string;
    active: boolean;
  };
  content: {
    description: string;
    mobileDescription: string;
    addresses: readonly PoiAddressFormValue[];
    location: PoiLocationFormValue;
    contact: PoiContact;
    openingHours: PoiFormInput['openingHours'];
    webUrls: readonly PoiWebUrl[];
    operator: PoiOperatingCompanyFormValue;
    prices: readonly PoiPriceFormValue[];
    mediaContents: readonly PoiMediaContent[];
    certificates: readonly PoiCertificate[];
    accessibilityInformation: PoiAccessibilityInformation;
    tagsText: string;
    payloadText: string;
  };
  media: {
    teaserImageAssetId: string;
    attachments: readonly PoiMediaAttachment[];
  };
  settings: {
    teaserImageAssetId: string;
  };
}>;

const createDefaultGeoLocation = (): PoiFormGeoLocationValue => ({ latitude: '', longitude: '' });
const createDefaultAddress = (): PoiAddressFormValue => ({ addition: '', street: '', zip: '', city: '', kind: '', geoLocation: createDefaultGeoLocation() });
const createDefaultContact = (): PoiContact => ({ firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] });
const createDefaultOpeningHour = () => ({ weekday: '', dateFrom: '', dateTo: '', timeFrom: '', timeTo: '', open: true, description: '' });
const createDefaultWebUrl = (): PoiWebUrl => ({ url: '', description: '' });
const createDefaultLocation = (): PoiLocationFormValue => ({
  name: '',
  department: '',
  district: '',
  regionName: '',
  state: '',
  geoLocation: createDefaultGeoLocation(),
});
const createDefaultOperator = (): PoiOperatingCompanyFormValue => ({
  name: '',
  address: createDefaultAddress(),
  contact: createDefaultContact(),
});
const createDefaultPrice = (): PoiPriceFormValue => ({
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
const createDefaultMediaContent = (): PoiMediaContent => ({
  captionText: '',
  copyright: '',
  contentType: '',
  sourceUrl: createDefaultWebUrl(),
});
const createDefaultCertificate = (): PoiCertificate => ({ name: '' });
const createDefaultAccessibilityInformation = (): PoiAccessibilityInformation => ({
  description: '',
  types: '',
  urls: [],
});

const mapNumberToString = (value?: number) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : '');

const mapGeoLocationToFormValue = (value?: { readonly latitude?: number; readonly longitude?: number } | null): PoiFormGeoLocationValue => ({
  latitude: mapNumberToString(value?.latitude),
  longitude: mapNumberToString(value?.longitude),
});

const mapAddressToFormValue = (address?: PoiAddress): PoiAddressFormValue => ({
  addition: address?.addition ?? '',
  street: address?.street ?? '',
  zip: address?.zip ?? '',
  city: address?.city ?? '',
  kind: address?.kind ?? '',
  geoLocation: mapGeoLocationToFormValue(address?.geoLocation),
});

const mapLocationToFormValue = (location?: PoiLocation): PoiLocationFormValue => ({
  name: location?.name ?? '',
  department: location?.department ?? '',
  district: location?.district ?? '',
  regionName: location?.regionName ?? '',
  state: location?.state ?? '',
  geoLocation: mapGeoLocationToFormValue(location?.geoLocation),
});

const mapContactToFormValue = (contact?: PoiContact): PoiContact => ({
  firstName: contact?.firstName ?? '',
  lastName: contact?.lastName ?? '',
  phone: contact?.phone ?? '',
  fax: contact?.fax ?? '',
  email: contact?.email ?? '',
  webUrls: contact?.webUrls?.length ? contact.webUrls : [],
});

const mapPriceToFormValue = (price?: PoiPriceInformation): PoiPriceFormValue => ({
  name: price?.name ?? '',
  amount: mapNumberToString(price?.amount),
  groupPrice: price?.groupPrice ?? false,
  ageFrom: mapNumberToString(price?.ageFrom),
  ageTo: mapNumberToString(price?.ageTo),
  minAdultCount: mapNumberToString(price?.minAdultCount),
  maxAdultCount: mapNumberToString(price?.maxAdultCount),
  minChildrenCount: mapNumberToString(price?.minChildrenCount),
  maxChildrenCount: mapNumberToString(price?.maxChildrenCount),
  description: price?.description ?? '',
  category: price?.category ?? '',
});

export const createDefaultPoiDetailFormValues = (): PoiDetailFormValues => ({
  name: '',
  basis: {
    categoryName: '',
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
    mediaContents: [createDefaultMediaContent()],
    certificates: [createDefaultCertificate()],
    accessibilityInformation: createDefaultAccessibilityInformation(),
    tagsText: '',
    payloadText: '{}',
  },
  media: {
    teaserImageAssetId: '',
    attachments: [],
  },
  settings: {
    teaserImageAssetId: '',
  },
});

export const mapPoiItemToDetailFormValues = (item: PoiContentItem): PoiDetailFormValues => ({
  name: item.name,
  basis: {
    categoryName: item.categoryName ?? '',
    active: item.active !== false,
  },
  content: {
    description: item.description ?? '',
    mobileDescription: item.mobileDescription ?? '',
    addresses: item.addresses?.length ? item.addresses.map(mapAddressToFormValue) : [createDefaultAddress()],
    location: mapLocationToFormValue(item.location),
    contact: mapContactToFormValue(item.contact),
    openingHours: item.openingHours?.length ? item.openingHours : [createDefaultOpeningHour()],
    webUrls: item.webUrls?.length ? item.webUrls : [createDefaultWebUrl()],
    operator: {
      name: item.operatingCompany?.name ?? '',
      address: mapAddressToFormValue(item.operatingCompany?.address),
      contact: mapContactToFormValue(item.operatingCompany?.contact),
    },
    prices: item.priceInformations?.length ? item.priceInformations.map(mapPriceToFormValue) : [createDefaultPrice()],
    mediaContents: item.mediaContents?.length ? item.mediaContents : [createDefaultMediaContent()],
    certificates: item.certificates?.length ? item.certificates : [createDefaultCertificate()],
    accessibilityInformation: {
      description: item.accessibilityInformation?.description ?? '',
      types: item.accessibilityInformation?.types ?? '',
      urls: item.accessibilityInformation?.urls?.length ? item.accessibilityInformation.urls : [],
    },
    tagsText: item.tags?.join(', ') ?? '',
    payloadText: JSON.stringify(item.payload ?? {}, null, 2),
  },
  media: {
    teaserImageAssetId: '',
    attachments: [],
  },
  settings: {
    teaserImageAssetId: '',
  },
});

export const parsePoiPayloadText = (payloadText: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(payloadText) as unknown;
    return parsed !== null && typeof parsed === 'object' && Array.isArray(parsed) === false
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const compactString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const compactNumber = (value?: string | number | null) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const compactGeoLocation = (value?: PoiFormGeoLocationValue | null) => {
  const latitude = compactNumber(value?.latitude);
  const longitude = compactNumber(value?.longitude);

  return latitude !== undefined || longitude !== undefined ? { latitude, longitude } : undefined;
};

const compactWebUrls = (value?: readonly PoiWebUrl[] | null) =>
  (value ?? [])
    .map((entry) => ({
      ...(compactString(entry?.url) ? { url: compactString(entry?.url) as string } : {}),
      ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
    }))
    .filter((entry): entry is PoiWebUrl => Boolean(entry.url));

const compactAddress = (value?: PoiAddressFormValue | PoiAddress | null) => {
  const geoLocation = 'geoLocation' in (value ?? {}) ? compactGeoLocation((value as PoiAddressFormValue | undefined)?.geoLocation as PoiFormGeoLocationValue | undefined) : undefined;
  const address = {
    ...(compactString(value?.addition) ? { addition: compactString(value?.addition) } : {}),
    ...(compactString(value?.street) ? { street: compactString(value?.street) } : {}),
    ...(compactString(value?.zip) ? { zip: compactString(value?.zip) } : {}),
    ...(compactString(value?.city) ? { city: compactString(value?.city) } : {}),
    ...(compactString(value?.kind) ? { kind: compactString(value?.kind) } : {}),
    ...(geoLocation ? { geoLocation } : {}),
  };

  return Object.keys(address).length > 0 ? address : undefined;
};

const compactContact = (value?: PoiContact | null) => {
  const webUrls = compactWebUrls(value?.webUrls);
  const contact = {
    ...(compactString(value?.firstName) ? { firstName: compactString(value?.firstName) } : {}),
    ...(compactString(value?.lastName) ? { lastName: compactString(value?.lastName) } : {}),
    ...(compactString(value?.phone) ? { phone: compactString(value?.phone) } : {}),
    ...(compactString(value?.fax) ? { fax: compactString(value?.fax) } : {}),
    ...(compactString(value?.email) ? { email: compactString(value?.email) } : {}),
    ...(webUrls.length > 0 ? { webUrls } : {}),
  };

  return Object.keys(contact).length > 0 ? contact : undefined;
};

const compactLocation = (value?: PoiLocationFormValue | null) => {
  const geoLocation = compactGeoLocation(value?.geoLocation);
  const location = {
    ...(compactString(value?.name) ? { name: compactString(value?.name) } : {}),
    ...(compactString(value?.department) ? { department: compactString(value?.department) } : {}),
    ...(compactString(value?.district) ? { district: compactString(value?.district) } : {}),
    ...(compactString(value?.regionName) ? { regionName: compactString(value?.regionName) } : {}),
    ...(compactString(value?.state) ? { state: compactString(value?.state) } : {}),
    ...(geoLocation ? { geoLocation } : {}),
  };

  return Object.keys(location).length > 0 ? location : undefined;
};

export const mapPoiDetailFormValuesToInput = (
  values: PoiDetailFormValues,
  payload: Record<string, unknown>
): PoiFormInput => {
  const contact = compactContact(values.content.contact);
  const operatingCompanyAddress = compactAddress(values.content.operator.address as PoiAddressFormValue | undefined);
  const operatingCompanyContact = compactContact(values.content.operator.contact);
  const operatingCompany = {
    ...(compactString(values.content.operator.name) ? { name: compactString(values.content.operator.name) } : {}),
    ...(operatingCompanyAddress ? { address: operatingCompanyAddress } : {}),
    ...(operatingCompanyContact ? { contact: operatingCompanyContact } : {}),
  };
  const accessibilityUrls = compactWebUrls(values.content.accessibilityInformation.urls);
  const accessibilityInformation = {
    ...(compactString(values.content.accessibilityInformation.description)
      ? { description: compactString(values.content.accessibilityInformation.description) }
      : {}),
    ...(compactString(values.content.accessibilityInformation.types)
      ? { types: compactString(values.content.accessibilityInformation.types) }
      : {}),
    ...(accessibilityUrls.length > 0 ? { urls: accessibilityUrls } : {}),
  };

  return {
    name: values.name.trim(),
    ...(compactString(values.content.description) ? { description: compactString(values.content.description) } : {}),
    ...(compactString(values.content.mobileDescription)
      ? { mobileDescription: compactString(values.content.mobileDescription) }
      : {}),
    active: values.basis.active,
    ...(compactString(values.basis.categoryName) ? { categoryName: compactString(values.basis.categoryName) } : {}),
    addresses: (values.content.addresses ?? [])
      .map((entry) => compactAddress(entry))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    ...(contact ? { contact } : {}),
    ...(compactLocation(values.content.location) ? { location: compactLocation(values.content.location) } : {}),
    openingHours: (values.content.openingHours ?? [])
      .map((entry) => ({
        ...(compactString(entry?.weekday) ? { weekday: compactString(entry?.weekday) } : {}),
        ...(compactString(entry?.dateFrom) ? { dateFrom: compactString(entry?.dateFrom) } : {}),
        ...(compactString(entry?.dateTo) ? { dateTo: compactString(entry?.dateTo) } : {}),
        ...(compactString(entry?.timeFrom) ? { timeFrom: compactString(entry?.timeFrom) } : {}),
        ...(compactString(entry?.timeTo) ? { timeTo: compactString(entry?.timeTo) } : {}),
        ...(compactNumber(entry?.sortNumber) !== undefined ? { sortNumber: compactNumber(entry?.sortNumber) } : {}),
        ...(entry?.open !== undefined ? { open: entry.open } : {}),
        ...(entry?.useYear !== undefined ? { useYear: entry.useYear } : {}),
        ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
      }))
      .filter((entry) => Object.keys(entry).length > 0),
    webUrls: compactWebUrls(values.content.webUrls),
    ...(Object.keys(operatingCompany).length > 0 ? { operatingCompany } : {}),
    priceInformations: (values.content.prices ?? [])
      .map((entry) => ({
        ...(compactString(entry?.name) ? { name: compactString(entry?.name) } : {}),
        ...(compactNumber(entry?.amount) !== undefined ? { amount: compactNumber(entry?.amount) } : {}),
        ...(entry?.groupPrice !== undefined ? { groupPrice: entry.groupPrice } : {}),
        ...(compactNumber(entry?.ageFrom) !== undefined ? { ageFrom: compactNumber(entry?.ageFrom) } : {}),
        ...(compactNumber(entry?.ageTo) !== undefined ? { ageTo: compactNumber(entry?.ageTo) } : {}),
        ...(compactNumber(entry?.minAdultCount) !== undefined ? { minAdultCount: compactNumber(entry?.minAdultCount) } : {}),
        ...(compactNumber(entry?.maxAdultCount) !== undefined ? { maxAdultCount: compactNumber(entry?.maxAdultCount) } : {}),
        ...(compactNumber(entry?.minChildrenCount) !== undefined ? { minChildrenCount: compactNumber(entry?.minChildrenCount) } : {}),
        ...(compactNumber(entry?.maxChildrenCount) !== undefined ? { maxChildrenCount: compactNumber(entry?.maxChildrenCount) } : {}),
        ...(compactString(entry?.description) ? { description: compactString(entry?.description) } : {}),
        ...(compactString(entry?.category) ? { category: compactString(entry?.category) } : {}),
      }))
      .filter((entry) => Object.keys(entry).length > 0),
    mediaContents: (values.content.mediaContents ?? [])
      .map((entry) => ({
        ...(compactString(entry?.captionText) ? { captionText: compactString(entry?.captionText) } : {}),
        ...(compactString(entry?.copyright) ? { copyright: compactString(entry?.copyright) } : {}),
        ...(compactNumber(entry?.height) !== undefined ? { height: compactNumber(entry?.height) } : {}),
        ...(compactNumber(entry?.width) !== undefined ? { width: compactNumber(entry?.width) } : {}),
        ...(compactString(entry?.contentType) ? { contentType: compactString(entry?.contentType) } : {}),
        ...(entry?.sourceUrl && compactWebUrls([entry.sourceUrl]).length > 0 ? { sourceUrl: compactWebUrls([entry.sourceUrl])[0] } : {}),
      }))
      .filter((entry) => Object.keys(entry).length > 0),
    certificates: (values.content.certificates ?? [])
      .map((entry) => ({ ...(compactString(entry?.name) ? { name: compactString(entry?.name) as string } : {}) }))
      .filter((entry): entry is PoiCertificate => Boolean(entry.name)),
    ...(Object.keys(accessibilityInformation).length > 0 ? { accessibilityInformation } : {}),
    ...(compactString(values.content.tagsText)
      ? {
          tags: values.content.tagsText
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
        }
      : {}),
    ...(Object.keys(payload).length > 0 ? { payload } : {}),
  };
};
