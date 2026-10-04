import type {
  SvaMainserverAddress,
  SvaMainserverAddressInput,
  SvaMainserverGeoLocation,
  SvaMainserverWebUrl,
  SvaMainserverWebUrlInput,
} from './types.js';

export type SvaMainserverDateInput = {
  readonly weekday?: string;
  readonly dateStart?: string;
  readonly dateEnd?: string;
  readonly timeStart?: string;
  readonly timeEnd?: string;
  readonly timeDescription?: string;
  readonly useOnlyTimeDescription?: boolean;
};

export type SvaMainserverDate = Omit<SvaMainserverDateInput, 'useOnlyTimeDescription'> & {
  readonly id?: string;
  readonly useOnlyTimeDescription?: string;
};

export type SvaMainserverContactInput = {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly fax?: string;
  readonly email?: string;
  readonly webUrls?: readonly SvaMainserverWebUrlInput[];
};

export type SvaMainserverContact = Omit<SvaMainserverContactInput, 'webUrls'> & {
  readonly id?: string;
  readonly webUrls: readonly SvaMainserverWebUrl[];
};

export type SvaMainserverLocationInput = {
  readonly name?: string;
  readonly department?: string;
  readonly district?: string;
  readonly regionName?: string;
  readonly state?: string;
  readonly geoLocation?: SvaMainserverGeoLocation;
};

export type SvaMainserverLocation = SvaMainserverLocationInput & {
  readonly id?: string;
};

export type SvaMainserverOperatingCompanyInput = {
  readonly name?: string;
  readonly address?: SvaMainserverAddressInput;
  readonly contact?: SvaMainserverContactInput;
};

export type SvaMainserverOperatingCompany = {
  readonly id?: string;
  readonly name?: string;
  readonly address?: SvaMainserverAddress;
  readonly contact?: SvaMainserverContact;
};

export type SvaMainserverPriceInput = {
  readonly name?: string;
  readonly amount?: number;
  readonly groupPrice?: boolean;
  readonly ageFrom?: number;
  readonly ageTo?: number;
  readonly minAdultCount?: number;
  readonly maxAdultCount?: number;
  readonly minChildrenCount?: number;
  readonly maxChildrenCount?: number;
  readonly description?: string;
  readonly category?: string;
};

export type SvaMainserverPrice = SvaMainserverPriceInput & {
  readonly id?: string;
};

export type SvaMainserverAccessibilityInformationInput = {
  readonly description?: string;
  readonly types?: string;
  readonly urls?: readonly SvaMainserverWebUrlInput[];
};

export type SvaMainserverAccessibilityInformation = Omit<
  SvaMainserverAccessibilityInformationInput,
  'urls'
> & {
  readonly id?: string;
  readonly urls: readonly SvaMainserverWebUrl[];
};

export type SvaMainserverRepeatDurationInput = {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly everyYear?: boolean;
};

export type SvaMainserverRepeatDuration = SvaMainserverRepeatDurationInput & {
  readonly id?: string;
};

export type SvaMainserverOpeningHourInput = {
  readonly weekday?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly timeFrom?: string;
  readonly timeTo?: string;
  readonly sortNumber?: number;
  readonly open?: boolean;
  readonly useYear?: boolean;
  readonly description?: string;
};

export type SvaMainserverOpeningHour = SvaMainserverOpeningHourInput & {
  readonly id?: string;
};

export type SvaMainserverCertificateInput = {
  readonly name: string;
};

export type SvaMainserverCertificate = SvaMainserverCertificateInput & {
  readonly id?: string;
};
