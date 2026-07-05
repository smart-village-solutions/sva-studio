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

export type SvaMainserverContentBlockFragment = {
  readonly id?: string | null;
  readonly title?: string | null;
  readonly intro?: string | null;
  readonly body?: string | null;
  readonly mediaContents?: readonly SvaMainserverMediaContentFragment[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
};

export type SvaMainserverGenericItemFragment = {
  readonly id?: string | null;
  readonly title?: string | null;
  readonly teaser?: string | null;
  readonly description?: string | null;
  readonly author?: string | null;
  readonly keywords?: string | null;
  readonly externalId?: string | null;
  readonly publicationDate?: string | null;
  readonly publishedAt?: string | null;
  readonly genericType?: string | null;
  readonly payload?: unknown;
  readonly visible?: boolean | null;
  readonly categories?: readonly SvaMainserverCategoryFragment[] | null;
  readonly contacts?: readonly SvaMainserverContactFragment[] | null;
  readonly webUrls?: readonly SvaMainserverWebUrlFragment[] | null;
  readonly addresses?: readonly SvaMainserverAddressFragment[] | null;
  readonly contentBlocks?: readonly SvaMainserverContentBlockFragment[] | null;
  readonly openingHours?: readonly SvaMainserverOpeningHourFragment[] | null;
  readonly mediaContents?: readonly SvaMainserverMediaContentFragment[] | null;
  readonly locations?: readonly SvaMainserverLocationFragment[] | null;
  readonly dates?: readonly SvaMainserverDateFragment[] | null;
  readonly accessibilityInformations?: readonly SvaMainserverAccessibilityInformationFragment[] | null;
  readonly priceInformations?: readonly SvaMainserverPriceFragment[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
};

export type SvaMainserverGenericItemListQuery = {
  readonly genericItems?: readonly SvaMainserverGenericItemFragment[] | null;
};

export type SvaMainserverGenericItemDetailQuery = {
  readonly genericItem?: SvaMainserverGenericItemFragment | null;
};

export type SvaMainserverCreateGenericItemMutation = {
  readonly createGenericItem?: SvaMainserverGenericItemFragment | null;
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

const openingHourFields = `
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
`;

const dateFields = `
  id
  weekday
  dateStart
  dateEnd
  timeStart
  timeEnd
  timeDescription
  useOnlyTimeDescription
`;

const contentBlockFields = `
  id
  title
  intro
  body
  mediaContents {
    ${mediaContentFields}
  }
  createdAt
  updatedAt
`;

const genericItemFields = `
  id
  title
  teaser
  description
  author
  keywords
  externalId
  publicationDate
  publishedAt
  genericType
  payload
  visible
  categories {
    ${categoryFields}
  }
  contacts {
    ${contactFields}
  }
  webUrls {
    ${webUrlFields}
  }
  addresses {
    ${addressFields}
  }
  contentBlocks {
    ${contentBlockFields}
  }
  openingHours {
    ${openingHourFields}
  }
  mediaContents {
    ${mediaContentFields}
  }
  locations {
    ${locationFields}
  }
  dates {
    ${dateFields}
  }
  accessibilityInformations {
    ${accessibilityInformationFields}
  }
  priceInformations {
    ${priceFields}
  }
  createdAt
  updatedAt
`;

export const svaMainserverGenericItemListDocument = /* GraphQL */ `
  query SvaMainserverGenericItemList($limit: Int!, $skip: Int!, $order: GenericItemOrder!) {
    genericItems(limit: $limit, skip: $skip, order: $order) {
      ${genericItemFields}
    }
  }
`;

export const svaMainserverGenericItemDetailDocument = /* GraphQL */ `
  query SvaMainserverGenericItemDetail($id: ID!) {
    genericItem(id: $id) {
      ${genericItemFields}
    }
  }
`;

export const svaMainserverCreateGenericItemDocument = /* GraphQL */ `
  mutation SvaMainserverCreateGenericItem(
    $id: ID
    $forceCreate: Boolean
    $pushNotification: Boolean
    $author: String
    $keywords: String
    $title: String!
    $teaser: String
    $genericType: String
    $externalId: String
    $publicationDate: String
    $publishedAt: String
    $categoryName: String
    $payload: JSON
    $contacts: [ContactInput!]
    $categories: [CategoryInput!]
    $webUrls: [WebUrlInput!]
    $addresses: [AddressInput!]
    $contentBlocks: [ContentBlockInput!]
    $openingHours: [OpeningHourInput!]
    $priceInformations: [PriceInput!]
    $mediaContents: [MediaContentInput!]
    $locations: [LocationInput!]
    $dates: [DateInput!]
    $accessibilityInformations: [AccessibilityInformationInput!]
    $visible: Boolean
  ) {
    createGenericItem(
      id: $id
      forceCreate: $forceCreate
      pushNotification: $pushNotification
      author: $author
      keywords: $keywords
      title: $title
      teaser: $teaser
      genericType: $genericType
      externalId: $externalId
      publicationDate: $publicationDate
      publishedAt: $publishedAt
      categoryName: $categoryName
      payload: $payload
      contacts: $contacts
      categories: $categories
      webUrls: $webUrls
      addresses: $addresses
      contentBlocks: $contentBlocks
      openingHours: $openingHours
      priceInformations: $priceInformations
      mediaContents: $mediaContents
      locations: $locations
      dates: $dates
      accessibilityInformations: $accessibilityInformations
      visible: $visible
    ) {
      ${genericItemFields}
    }
  }
`;
