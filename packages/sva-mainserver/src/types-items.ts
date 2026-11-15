import type {
  SvaMainserverAccessibilityInformation,
  SvaMainserverAccessibilityInformationInput,
  SvaMainserverAddress,
  SvaMainserverAddressInput,
  SvaMainserverCategory,
  SvaMainserverCategoryInput,
  SvaMainserverCertificate,
  SvaMainserverCertificateInput,
  SvaMainserverContact,
  SvaMainserverContactInput,
  SvaMainserverContentBlock,
  SvaMainserverContentBlockInput,
  SvaMainserverDataProvider,
  SvaMainserverDate,
  SvaMainserverDateInput,
  SvaMainserverLocation,
  SvaMainserverLocationInput,
  SvaMainserverMediaContent,
  SvaMainserverMediaContentInput,
  SvaMainserverOpeningHour,
  SvaMainserverOpeningHourInput,
  SvaMainserverOperatingCompany,
  SvaMainserverOperatingCompanyInput,
  SvaMainserverPrice,
  SvaMainserverPriceInput,
  SvaMainserverRepeatDuration,
  SvaMainserverRepeatDurationInput,
  SvaMainserverWebUrl,
  SvaMainserverWebUrlInput,
} from './types.js';

/** Event media entry; `id` references a stored entry for the host merge and is never sent. */
export type SvaMainserverEventMediaContentInput = SvaMainserverMediaContentInput & {
  readonly id?: string;
};

export type SvaMainserverEventInput = {
  readonly payload?: unknown;
  readonly title: string;
  readonly description?: string;
  readonly externalId?: string;
  readonly keywords?: string;
  readonly parentId?: number;
  readonly registrationRequired?: boolean;
  /** `null` clears a stored limit; an omitted value keeps it. */
  readonly maximumAttendees?: number | null;
  readonly dates?: readonly SvaMainserverDateInput[];
  readonly repeat?: boolean;
  readonly repeatDuration?: SvaMainserverRepeatDurationInput;
  readonly categoryName?: string;
  readonly categories?: readonly SvaMainserverCategoryInput[];
  readonly addresses?: readonly SvaMainserverAddressInput[];
  readonly location?: SvaMainserverLocationInput;
  readonly contacts?: readonly SvaMainserverContactInput[];
  readonly urls?: readonly SvaMainserverWebUrlInput[];
  readonly mediaContents?: readonly SvaMainserverEventMediaContentInput[];
  readonly organizer?: SvaMainserverOperatingCompanyInput;
  readonly priceInformations?: readonly SvaMainserverPriceInput[];
  readonly accessibilityInformation?: SvaMainserverAccessibilityInformationInput;
  readonly tags?: readonly string[];
  readonly recurring?: string;
  readonly recurringWeekdays?: readonly string[];
  readonly recurringType?: string;
  readonly recurringInterval?: string;
  readonly pointOfInterestId?: string;
};

export type SvaMainserverEventItem = {
  readonly payload?: unknown;
  readonly id: string;
  readonly title: string;
  readonly contentType: 'events.event-record';
  readonly status: 'published';
  readonly description?: string;
  readonly externalId?: string;
  readonly keywords?: string;
  readonly parentId?: number;
  readonly registrationRequired?: boolean;
  readonly maximumAttendees?: number;
  readonly dates: readonly SvaMainserverDate[];
  readonly listDate?: string;
  readonly sortDate?: string;
  readonly repeat?: boolean;
  readonly repeatDuration?: SvaMainserverRepeatDuration;
  readonly recurring?: boolean;
  readonly recurringType?: number;
  readonly recurringInterval?: number;
  readonly recurringWeekdays: readonly number[];
  readonly categoryName?: string;
  readonly categories: readonly SvaMainserverCategory[];
  readonly addresses: readonly SvaMainserverAddress[];
  readonly location?: SvaMainserverLocation;
  readonly contacts: readonly SvaMainserverContact[];
  readonly urls: readonly SvaMainserverWebUrl[];
  readonly mediaContents: readonly SvaMainserverMediaContent[];
  readonly organizer?: SvaMainserverOperatingCompany;
  readonly priceInformations: readonly SvaMainserverPrice[];
  readonly accessibilityInformation?: SvaMainserverAccessibilityInformation;
  readonly tags: readonly string[];
  readonly visible: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly dataProvider?: SvaMainserverDataProvider;
};

// Server-read lunch data is carried through POI updates; the Studio has no lunch editor.
type PoiLunchInput = {
  readonly text: string | null;
  readonly pointOfInterestAttributes: string | null;
  readonly lunchOffers:
    readonly { readonly name: string | null; readonly price: string | null }[] | null;
  readonly dates:
    | readonly {
        readonly weekday: string | null;
        readonly dateStart: string | null;
        readonly dateEnd: string | null;
        readonly timeStart: string | null;
        readonly timeEnd: string | null;
        readonly timeDescription: string | null;
        readonly useOnlyTimeDescription: boolean | null;
      }[]
    | null;
};

export type SvaMainserverPoiInput = {
  readonly name: string;
  readonly description?: string;
  readonly mobileDescription?: string;
  readonly externalId?: string;
  readonly keywords?: string;
  readonly active?: boolean;
  readonly visible?: boolean;
  readonly categoryName?: string;
  readonly payload?: unknown;
  readonly categories?: readonly SvaMainserverCategoryInput[];
  readonly addresses?: readonly SvaMainserverAddressInput[];
  readonly contact?: SvaMainserverContactInput;
  readonly priceInformations?: readonly SvaMainserverPriceInput[];
  readonly openingHours?: readonly SvaMainserverOpeningHourInput[];
  readonly lunches?: readonly PoiLunchInput[];
  readonly operatingCompany?: SvaMainserverOperatingCompanyInput;
  readonly webUrls?: readonly SvaMainserverWebUrlInput[];
  readonly mediaContents?: readonly SvaMainserverMediaContentInput[];
  readonly location?: SvaMainserverLocationInput;
  readonly certificates?: readonly SvaMainserverCertificateInput[];
  readonly accessibilityInformation?: SvaMainserverAccessibilityInformationInput;
  readonly tags?: readonly string[];
};

export type SvaMainserverPoiItem = {
  readonly id: string;
  readonly name: string;
  readonly contentType: 'poi.point-of-interest';
  readonly status: 'draft' | 'published';
  readonly description?: string;
  readonly mobileDescription?: string;
  readonly externalId?: string;
  readonly keywords?: string;
  readonly active: boolean;
  readonly categoryName?: string;
  readonly payload?: unknown;
  readonly categories: readonly SvaMainserverCategory[];
  readonly addresses: readonly SvaMainserverAddress[];
  readonly contact?: SvaMainserverContact;
  readonly priceInformations: readonly SvaMainserverPrice[];
  readonly openingHours: readonly SvaMainserverOpeningHour[];
  readonly lunches?: readonly PoiLunchInput[];
  readonly operatingCompany?: SvaMainserverOperatingCompany;
  readonly webUrls: readonly SvaMainserverWebUrl[];
  readonly mediaContents: readonly SvaMainserverMediaContent[];
  readonly location?: SvaMainserverLocation;
  readonly certificates: readonly SvaMainserverCertificate[];
  readonly accessibilityInformation?: SvaMainserverAccessibilityInformation;
  readonly tags: readonly string[];
  readonly visible: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly dataProvider?: SvaMainserverDataProvider;
};

export type SvaMainserverGenericItemInput = {
  readonly title: string;
  readonly genericType: string;
  readonly visible?: boolean;
  readonly author?: string;
  readonly keywords?: string;
  readonly externalId?: string;
  readonly publicationDate?: string;
  readonly publishedAt?: string;
  readonly categoryName?: string;
  readonly payload?: unknown;
  readonly categories?: readonly SvaMainserverCategoryInput[];
  readonly contacts?: readonly SvaMainserverContactInput[];
  readonly webUrls?: readonly SvaMainserverWebUrlInput[];
  readonly addresses?: readonly SvaMainserverAddressInput[];
  readonly contentBlocks?: readonly SvaMainserverContentBlockInput[];
  readonly openingHours?: readonly SvaMainserverOpeningHourInput[];
  readonly priceInformations?: readonly SvaMainserverPriceInput[];
  readonly mediaContents?: readonly SvaMainserverMediaContentInput[];
  readonly locations?: readonly SvaMainserverLocationInput[];
  readonly dates?: readonly SvaMainserverDateInput[];
  readonly accessibilityInformations?: readonly SvaMainserverAccessibilityInformationInput[];
};

export type SvaMainserverGenericItem = {
  readonly id: string;
  readonly title: string;
  readonly contentType: 'generic-items.generic-item';
  readonly status: 'published';
  readonly genericType: string;
  readonly pointOfInterestId?: string;
  readonly description?: string;
  readonly visible: boolean;
  readonly author?: string;
  readonly keywords?: string;
  readonly externalId?: string;
  readonly publicationDate?: string;
  readonly publishedAt?: string;
  readonly payload?: unknown;
  readonly categories: readonly SvaMainserverCategory[];
  readonly contacts: readonly SvaMainserverContact[];
  readonly webUrls: readonly SvaMainserverWebUrl[];
  readonly addresses: readonly SvaMainserverAddress[];
  readonly contentBlocks: readonly SvaMainserverContentBlock[];
  readonly openingHours: readonly SvaMainserverOpeningHour[];
  readonly priceInformations: readonly SvaMainserverPrice[];
  readonly mediaContents: readonly SvaMainserverMediaContent[];
  readonly locations: readonly SvaMainserverLocation[];
  readonly dates: readonly SvaMainserverDate[];
  readonly accessibilityInformations: readonly SvaMainserverAccessibilityInformation[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly dataProvider?: SvaMainserverDataProvider;
};

export type SvaMainserverProjectStatus = 'draft' | 'published' | 'archived';

export type SvaMainserverProjectAuthor =
  | Readonly<{ type: 'organization'; id: string; displayName: string }>
  | Readonly<{ type: 'person'; id: string; displayName: string }>;

export type SvaMainserverProjectImage = Readonly<{
  url: string;
  altText: string;
  caption?: string;
  credits?: string;
  position: number;
}>;

export type SvaMainserverProjectInput = Readonly<{
  language: string;
  title: string;
  description: string;
  fullText: string;
  images: readonly SvaMainserverProjectImage[];
  status: SvaMainserverProjectStatus;
}>;

export type SvaMainserverProject = SvaMainserverProjectInput &
  Readonly<{
    id: string;
    published: boolean;
    publishedAt?: string;
    createdAt: string;
    updatedAt: string;
    author: SvaMainserverProjectAuthor;
    dataProvider?: Readonly<{ id?: string; name?: string }>;
  }>;

export type SvaMainserverLocalizedText = Readonly<Record<string, string>>;

export type SvaMainserverSurveyStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type SvaMainserverSurveyQuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'FREE_TEXT'
  | 'SINGLE_CHOICE_WITH_TEXT'
  | 'MULTIPLE_CHOICE_WITH_TEXT';

export type SvaMainserverSurveyFreeTextStatus = 'INTERNAL' | 'PUBLIC';

export type SvaMainserverSurveyResultVisibility = 'NONE' | 'AFTER_SUBMISSION' | 'AFTER_SURVEY_END';
