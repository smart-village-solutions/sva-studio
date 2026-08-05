import type {
  SvaMainserverEventInput,
  SvaMainserverEventItem,
  SvaMainserverPoiInput,
  SvaMainserverPoiItem,
} from '../../types.js';

export type MainserverEditorFieldClassification =
  'hard' | 'controlled' | 'passthrough' | 'readonly' | 'not_preservable';

export type MainserverEditorFieldMatrix = Readonly<
  Record<string, MainserverEditorFieldClassification>
>;

export const eventEditorFieldMatrix = {
  id: 'hard',
  title: 'controlled',
  description: 'controlled',
  externalId: 'passthrough',
  keywords: 'passthrough',
  parentId: 'passthrough',
  dates: 'controlled',
  listDate: 'readonly',
  sortDate: 'readonly',
  categories: 'controlled',
  addresses: 'controlled',
  contacts: 'controlled',
  urls: 'controlled',
  mediaContents: 'controlled',
  organizer: 'controlled',
  priceInformations: 'controlled',
  accessibilityInformation: 'passthrough',
  tags: 'passthrough',
  createdAt: 'readonly',
  updatedAt: 'readonly',
} as const satisfies MainserverEditorFieldMatrix;

export const poiEditorFieldMatrix = {
  id: 'hard',
  name: 'controlled',
  description: 'controlled',
  mobileDescription: 'passthrough',
  externalId: 'passthrough',
  keywords: 'passthrough',
  payload: 'passthrough',
  categories: 'controlled',
  addresses: 'controlled',
  contact: 'controlled',
  priceInformations: 'controlled',
  openingHours: 'controlled',
  operatingCompany: 'controlled',
  webUrls: 'controlled',
  mediaContents: 'controlled',
  location: 'controlled',
  certificates: 'controlled',
  accessibilityInformation: 'passthrough',
  tags: 'passthrough',
  createdAt: 'readonly',
  updatedAt: 'readonly',
} as const satisfies MainserverEditorFieldMatrix;

export const newsEditorFieldMatrix = {
  id: 'hard',
  title: 'controlled',
  publishedAt: 'controlled',
  publicationDate: 'controlled',
  contentBlocks: 'controlled',
  categories: 'controlled',
  sourceUrl: 'controlled',
  address: 'controlled',
  payload: 'readonly',
  dataProvider: 'readonly',
  settings: 'readonly',
  announcements: 'readonly',
  createdAt: 'readonly',
  updatedAt: 'readonly',
} as const satisfies MainserverEditorFieldMatrix;

export const genericItemEditorFieldMatrix = {
  id: 'hard',
  genericType: 'hard',
  title: 'controlled',
  teaser: 'controlled',
  description: 'controlled',
  payload: 'passthrough',
  categories: 'controlled',
  contacts: 'controlled',
  webUrls: 'controlled',
  addresses: 'controlled',
  contentBlocks: 'controlled',
  openingHours: 'controlled',
  mediaContents: 'controlled',
  locations: 'controlled',
  dates: 'controlled',
  accessibilityInformations: 'controlled',
  priceInformations: 'controlled',
  createdAt: 'readonly',
  updatedAt: 'readonly',
} as const satisfies MainserverEditorFieldMatrix;

const preserveDefined = <T>(current: T | undefined, submitted: T | undefined): T | undefined =>
  submitted === undefined ? current : submitted;

export const mergeEventUpdateWithCurrent = (
  current: SvaMainserverEventItem,
  submitted: SvaMainserverEventInput
): SvaMainserverEventInput => ({
  ...submitted,
  externalId: preserveDefined(current.externalId, submitted.externalId),
  keywords: preserveDefined(current.keywords, submitted.keywords),
  parentId: preserveDefined(current.parentId, submitted.parentId),
  accessibilityInformation: preserveDefined(
    current.accessibilityInformation,
    submitted.accessibilityInformation
  ),
  tags: preserveDefined(current.tags, submitted.tags),
});

export const mergePoiUpdateWithCurrent = (
  current: SvaMainserverPoiItem,
  submitted: SvaMainserverPoiInput
): SvaMainserverPoiInput => ({
  ...submitted,
  mobileDescription: preserveDefined(current.mobileDescription, submitted.mobileDescription),
  externalId: preserveDefined(current.externalId, submitted.externalId),
  keywords: preserveDefined(current.keywords, submitted.keywords),
  payload: preserveDefined(current.payload, submitted.payload),
  accessibilityInformation: preserveDefined(
    current.accessibilityInformation,
    submitted.accessibilityInformation
  ),
  tags: preserveDefined(current.tags, submitted.tags),
});
