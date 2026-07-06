export type GenericItemWebUrl = {
  readonly url: string;
  readonly description?: string;
};

export type GenericItemCategory = {
  readonly name: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly children?: readonly GenericItemCategory[];
};

export type GenericItemAddress = {
  readonly addition?: string;
  readonly street?: string;
  readonly zip?: string;
  readonly city?: string;
  readonly kind?: string;
  readonly geoLocation?: {
    readonly latitude?: number;
    readonly longitude?: number;
  };
};

export type GenericItemContact = {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly fax?: string;
  readonly email?: string;
  readonly webUrls?: readonly GenericItemWebUrl[];
};

export type GenericItemMediaContent = {
  readonly captionText?: string;
  readonly copyright?: string;
  readonly height?: number;
  readonly width?: number;
  readonly contentType?: string;
  readonly sourceUrl?: GenericItemWebUrl;
};

export type GenericItemContentBlock = {
  readonly title?: string;
  readonly intro?: string;
  readonly body?: string;
  readonly mediaContents?: readonly GenericItemMediaContent[];
};

export type GenericItemDate = {
  readonly weekday?: string;
  readonly dateStart?: string;
  readonly dateEnd?: string;
  readonly timeStart?: string;
  readonly timeEnd?: string;
  readonly timeDescription?: string;
  readonly useOnlyTimeDescription?: boolean;
};

export type GenericItemLocation = {
  readonly name?: string;
  readonly department?: string;
  readonly district?: string;
  readonly regionName?: string;
  readonly state?: string;
  readonly geoLocation?: {
    readonly latitude?: number;
    readonly longitude?: number;
  };
};

export type GenericItemOpeningHour = {
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

export type GenericItemAccessibilityInformation = {
  readonly description?: string;
  readonly types?: string;
  readonly urls?: readonly GenericItemWebUrl[];
};

export type GenericItemPriceInformation = {
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
