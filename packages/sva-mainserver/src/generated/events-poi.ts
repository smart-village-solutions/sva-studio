export type SvaMainserverDateFragment = {
  readonly id?: string | null;
  readonly dateStart?: string | null;
  readonly dateEnd?: string | null;
  readonly timeStart?: string | null;
  readonly timeEnd?: string | null;
  readonly timeDescription?: string | null;
  readonly useOnlyTimeDescription?: string | null;
  readonly weekday?: string | null;
};

export type SvaMainserverWebUrlFragment = {
  readonly id?: string | null;
  readonly url?: string | null;
  readonly description?: string | null;
};

export type SvaMainserverGeoLocationFragment = {
  readonly latitude?: number | string | null;
  readonly longitude?: number | string | null;
};

export type SvaMainserverAddressFragment = {
  readonly id?: string | null;
  readonly addition?: string | null;
  readonly street?: string | null;
  readonly zip?: string | null;
  readonly city?: string | null;
  readonly kind?: string | null;
  readonly geoLocation?: SvaMainserverGeoLocationFragment | null;
};

export type SvaMainserverCategoryFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly iconName?: string | null;
  readonly position?: number | null;
  readonly tagList?: string | null;
  readonly children?: readonly SvaMainserverCategoryFragment[] | null;
};

export type SvaMainserverContactFragment = {
  readonly id?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly phone?: string | null;
  readonly fax?: string | null;
  readonly email?: string | null;
  readonly webUrls?: readonly SvaMainserverWebUrlFragment[] | null;
};

export type SvaMainserverLocationFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly department?: string | null;
  readonly district?: string | null;
  readonly regionName?: string | null;
  readonly state?: string | null;
  readonly geoLocation?: SvaMainserverGeoLocationFragment | null;
};

export type SvaMainserverOperatingCompanyFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly address?: SvaMainserverAddressFragment | null;
  readonly contact?: SvaMainserverContactFragment | null;
};

export type SvaMainserverPriceFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly amount?: number | null;
  readonly groupPrice?: boolean | null;
  readonly ageFrom?: number | null;
  readonly ageTo?: number | null;
  readonly minAdultCount?: number | null;
  readonly maxAdultCount?: number | null;
  readonly minChildrenCount?: number | null;
  readonly maxChildrenCount?: number | null;
  readonly description?: string | null;
  readonly category?: string | null;
};

export type SvaMainserverAccessibilityInformationFragment = {
  readonly id?: string | null;
  readonly description?: string | null;
  readonly types?: string | null;
  readonly urls?: readonly SvaMainserverWebUrlFragment[] | null;
};

export type SvaMainserverMediaContentFragment = {
  readonly id?: string | null;
  readonly captionText?: string | null;
  readonly copyright?: string | null;
  readonly height?: number | null;
  readonly width?: number | null;
  readonly contentType?: string | null;
  readonly sourceUrl?: SvaMainserverWebUrlFragment | null;
};

export type SvaMainserverRepeatDurationFragment = {
  readonly id?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly everyYear?: boolean | null;
};

export type SvaMainserverOpeningHourFragment = {
  readonly id?: string | null;
  readonly weekday?: string | null;
  readonly dateFrom?: string | null;
  readonly dateTo?: string | null;
  readonly timeFrom?: string | null;
  readonly timeTo?: string | null;
  readonly sortNumber?: number | null;
  readonly open?: boolean | null;
  readonly useYear?: boolean | null;
  readonly description?: string | null;
};

export type SvaMainserverCertificateFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
};

export type SvaMainserverEventFragment = {
  readonly id?: string | null;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly externalId?: string | null;
  readonly keywords?: string | null;
  readonly parentId?: number | null;
  readonly dates?: readonly SvaMainserverDateFragment[] | null;
  readonly listDate?: string | null;
  readonly sortDate?: string | null;
  readonly repeat?: boolean | null;
  readonly repeatDuration?: SvaMainserverRepeatDurationFragment | null;
  readonly recurring?: boolean | null;
  readonly recurringType?: number | null;
  readonly recurringInterval?: number | null;
  readonly recurringWeekdays?: readonly number[] | null;
  readonly category?: SvaMainserverCategoryFragment | null;
  readonly categories?: readonly SvaMainserverCategoryFragment[] | null;
  readonly addresses?: readonly SvaMainserverAddressFragment[] | null;
  readonly location?: SvaMainserverLocationFragment | null;
  readonly contacts?: readonly SvaMainserverContactFragment[] | null;
  readonly urls?: readonly SvaMainserverWebUrlFragment[] | null;
  readonly mediaContents?: readonly SvaMainserverMediaContentFragment[] | null;
  readonly organizer?: SvaMainserverOperatingCompanyFragment | null;
  readonly priceInformations?: readonly SvaMainserverPriceFragment[] | null;
  readonly accessibilityInformation?: SvaMainserverAccessibilityInformationFragment | null;
  readonly tagList?: readonly string[] | null;
  readonly visible?: boolean | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
};

export type SvaMainserverPoiFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly description?: string | null;
  readonly mobileDescription?: string | null;
  readonly externalId?: string | null;
  readonly keywords?: string | null;
  readonly active?: boolean | null;
  readonly payload?: unknown;
  readonly category?: SvaMainserverCategoryFragment | null;
  readonly categories?: readonly SvaMainserverCategoryFragment[] | null;
  readonly addresses?: readonly SvaMainserverAddressFragment[] | null;
  readonly contact?: SvaMainserverContactFragment | null;
  readonly priceInformations?: readonly SvaMainserverPriceFragment[] | null;
  readonly openingHours?: readonly SvaMainserverOpeningHourFragment[] | null;
  readonly operatingCompany?: SvaMainserverOperatingCompanyFragment | null;
  readonly webUrls?: readonly SvaMainserverWebUrlFragment[] | null;
  readonly mediaContents?: readonly SvaMainserverMediaContentFragment[] | null;
  readonly location?: SvaMainserverLocationFragment | null;
  readonly certificates?: readonly SvaMainserverCertificateFragment[] | null;
  readonly accessibilityInformation?: SvaMainserverAccessibilityInformationFragment | null;
  readonly tagList?: readonly string[] | null;
  readonly visible?: boolean | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
};

export type SvaMainserverEventListQuery = {
  readonly eventRecords?: readonly SvaMainserverEventFragment[] | null;
};

export type SvaMainserverEventDetailQuery = {
  readonly eventRecord?: SvaMainserverEventFragment | null;
};

export type SvaMainserverCreateEventMutation = {
  readonly createEventRecord?: SvaMainserverEventFragment | null;
};

export type SvaMainserverPoiListQuery = {
  readonly pointsOfInterest?: readonly SvaMainserverPoiFragment[] | null;
};

export type SvaMainserverPoiDetailQuery = {
  readonly pointOfInterest?: SvaMainserverPoiFragment | null;
};

export type SvaMainserverCreatePoiMutation = {
  readonly createPointOfInterest?: SvaMainserverPoiFragment | null;
};

export type SvaMainserverDestroyRecordMutation = {
  readonly destroyRecord?: {
    readonly id?: number | null;
    readonly status?: string | null;
    readonly statusCode?: number | null;
  } | null;
};

const webUrlFields = `
  id
  url
  description
`;

const geoLocationFields = `
  latitude
  longitude
`;

const addressFields = `
  id
  addition
  street
  zip
  city
  kind
  geoLocation {
    ${geoLocationFields}
  }
`;

const categoryFields = `
  id
  name
  iconName
  position
  tagList
  children {
    id
    name
    iconName
    position
    tagList
  }
`;

const contactFields = `
  id
  firstName
  lastName
  phone
  fax
  email
  webUrls {
    ${webUrlFields}
  }
`;

const locationFields = `
  id
  name
  department
  district
  regionName
  state
  geoLocation {
    ${geoLocationFields}
  }
`;

const operatingCompanyFields = `
  id
  name
  address {
    ${addressFields}
  }
  contact {
    ${contactFields}
  }
`;

const priceFields = `
  id
  name
  amount
  groupPrice
  ageFrom
  ageTo
  minAdultCount
  maxAdultCount
  minChildrenCount
  maxChildrenCount
  description
  category
`;

const accessibilityInformationFields = `
  id
  description
  types
  urls {
    ${webUrlFields}
  }
`;

const mediaContentFields = `
  id
  captionText
  copyright
  height
  width
  contentType
  sourceUrl {
    ${webUrlFields}
  }
`;

const eventFields = `
  id
  title
  description
  externalId
  keywords
  parentId
  dates {
    id
    dateStart
    dateEnd
    timeStart
    timeEnd
    timeDescription
    useOnlyTimeDescription
    weekday
  }
  listDate
  sortDate
  repeat
  repeatDuration {
    id
    startDate
    endDate
    everyYear
  }
  recurring
  recurringType
  recurringInterval
  recurringWeekdays
  category {
    ${categoryFields}
  }
  categories {
    ${categoryFields}
  }
  addresses {
    ${addressFields}
  }
  location {
    ${locationFields}
  }
  contacts {
    ${contactFields}
  }
  urls {
    ${webUrlFields}
  }
  mediaContents {
    ${mediaContentFields}
  }
  organizer {
    ${operatingCompanyFields}
  }
  priceInformations {
    ${priceFields}
  }
  accessibilityInformation {
    ${accessibilityInformationFields}
  }
  tagList
  createdAt
  updatedAt
  visible
`;

const poiFields = `
  id
  name
  description
  mobileDescription
  externalId
  keywords
  active
  payload
  category {
    ${categoryFields}
  }
  categories {
    ${categoryFields}
  }
  addresses {
    ${addressFields}
  }
  contact {
    ${contactFields}
  }
  priceInformations {
    ${priceFields}
  }
  openingHours {
    id
    weekday
    dateFrom
    dateTo
    timeFrom
    timeTo
    sortNumber
    open
    useYear
    description
  }
  operatingCompany {
    ${operatingCompanyFields}
  }
  webUrls {
    ${webUrlFields}
  }
  mediaContents {
    ${mediaContentFields}
  }
  location {
    ${locationFields}
  }
  certificates {
    id
    name
  }
  accessibilityInformation {
    ${accessibilityInformationFields}
  }
  tagList
  createdAt
  updatedAt
  visible
`;

export const svaMainserverEventListDocument = `
  query SvaMainserverEventList($limit: Int, $skip: Int, $order: EventRecordsOrder) {
    eventRecords(limit: $limit, skip: $skip, order: $order) {
      ${eventFields}
    }
  }
`;

export const svaMainserverEventDetailDocument = `
  query SvaMainserverEventDetail($id: ID!) {
    eventRecord(id: $id) {
      ${eventFields}
    }
  }
`;

export const svaMainserverCreateEventDocument = `
  mutation SvaMainserverCreateEvent(
    $id: ID
    $forceCreate: Boolean
    $pushNotification: Boolean
    $parentId: Int
    $keywords: String
    $description: String
    $externalId: String
    $title: String
    $dates: [DateInput!]
    $repeat: Boolean
    $repeatDuration: RepeatDurationInput
    $categoryName: String
    $categories: [CategoryInput!]
    $addresses: [AddressInput!]
    $location: LocationInput
    $contacts: [ContactInput!]
    $urls: [WebUrlInput!]
    $mediaContents: [MediaContentInput!]
    $organizer: OperatingCompanyInput
    $priceInformations: [PriceInput!]
    $accessibilityInformation: AccessibilityInformationInput
    $tags: [String!]
    $recurring: String
    $recurringWeekdays: [String!]
    $recurringType: String
    $recurringInterval: String
    $pointOfInterestId: ID
  ) {
    createEventRecord(
      id: $id
      forceCreate: $forceCreate
      pushNotification: $pushNotification
      parentId: $parentId
      keywords: $keywords
      description: $description
      externalId: $externalId
      title: $title
      dates: $dates
      repeat: $repeat
      repeatDuration: $repeatDuration
      categoryName: $categoryName
      categories: $categories
      addresses: $addresses
      location: $location
      contacts: $contacts
      urls: $urls
      mediaContents: $mediaContents
      organizer: $organizer
      priceInformations: $priceInformations
      accessibilityInformation: $accessibilityInformation
      tags: $tags
      recurring: $recurring
      recurringWeekdays: $recurringWeekdays
      recurringType: $recurringType
      recurringInterval: $recurringInterval
      pointOfInterestId: $pointOfInterestId
    ) {
      ${eventFields}
    }
  }
`;

export const svaMainserverPoiListDocument = `
  query SvaMainserverPoiList($limit: Int, $skip: Int, $order: PointsOfInterestOrder) {
    pointsOfInterest(limit: $limit, skip: $skip, order: $order) {
      ${poiFields}
    }
  }
`;

export const svaMainserverPoiDetailDocument = `
  query SvaMainserverPoiDetail($id: ID!) {
    pointOfInterest(id: $id) {
      ${poiFields}
    }
  }
`;

export const svaMainserverCreatePoiDocument = `
  mutation SvaMainserverCreatePoi(
    $id: ID
    $forceCreate: Boolean
    $name: String!
    $externalId: String
    $description: String
    $keywords: String
    $mobileDescription: String
    $active: Boolean
    $categoryName: String
    $payload: JSON
    $categories: [CategoryInput!]
    $addresses: [AddressInput!]
    $contact: ContactInput
    $priceInformations: [PriceInput!]
    $openingHours: [OpeningHourInput!]
    $operatingCompany: OperatingCompanyInput
    $webUrls: [WebUrlInput!]
    $mediaContents: [MediaContentInput!]
    $location: LocationInput
    $certificates: [CertificateInput!]
    $accessibilityInformation: AccessibilityInformationInput
    $tags: [String!]
  ) {
    createPointOfInterest(
      id: $id
      forceCreate: $forceCreate
      name: $name
      externalId: $externalId
      description: $description
      keywords: $keywords
      mobileDescription: $mobileDescription
      active: $active
      categoryName: $categoryName
      payload: $payload
      categories: $categories
      addresses: $addresses
      contact: $contact
      priceInformations: $priceInformations
      openingHours: $openingHours
      operatingCompany: $operatingCompany
      webUrls: $webUrls
      mediaContents: $mediaContents
      location: $location
      certificates: $certificates
      accessibilityInformation: $accessibilityInformation
      tags: $tags
    ) {
      ${poiFields}
    }
  }
`;

export const svaMainserverDestroyRecordDocument = `
  mutation SvaMainserverDestroyRecord($id: ID!, $recordType: String!) {
    destroyRecord(id: $id, recordType: $recordType) {
      id
      status
      statusCode
    }
  }
`;
