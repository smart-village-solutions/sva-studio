import type {
  PoiAccessibilityInformation,
  PoiAddress,
  PoiCertificate,
  PoiContact,
  PoiLocation,
  PoiMediaContent,
  PoiPriceInformation,
  PoiWebUrl,
} from './poi.content.types.js';

export type PoiFormGeoLocationValue = Readonly<{
  latitude: string;
  longitude: string;
}>;

export type PoiAddressFormValue = Omit<PoiAddress, 'geoLocation'> & Readonly<{
  geoLocation?: PoiFormGeoLocationValue;
}>;

export type PoiLocationFormValue = Omit<PoiLocation, 'geoLocation'> & Readonly<{
  geoLocation?: PoiFormGeoLocationValue;
}>;

export type PoiOperatingCompanyFormValue = Readonly<{
  name?: string;
  address?: PoiAddressFormValue;
  contact?: PoiContact;
}>;

export type PoiPriceFormValue = Omit<
  PoiPriceInformation,
  'amount' | 'ageFrom' | 'ageTo' | 'minAdultCount' | 'maxAdultCount' | 'minChildrenCount' | 'maxChildrenCount'
> &
  Readonly<{
    amount?: string;
    ageFrom?: string;
    ageTo?: string;
    minAdultCount?: string;
    maxAdultCount?: string;
    minChildrenCount?: string;
    maxChildrenCount?: string;
  }>;

export type PoiMediaAttachment = Readonly<{
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
    openingHours: readonly {
      weekday?: string;
      dateFrom?: string;
      dateTo?: string;
      timeFrom?: string;
      timeTo?: string;
      open?: boolean;
      description?: string;
      sortNumber?: string | number;
      useYear?: boolean;
    }[];
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
