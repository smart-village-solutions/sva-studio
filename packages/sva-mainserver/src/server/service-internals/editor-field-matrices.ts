import type {
  SvaMainserverEventInput,
  SvaMainserverEventItem,
  SvaMainserverPoiInput,
  SvaMainserverPoiItem,
  MainserverDataDeviation,
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

const preserveDefinedUnlessDegraded = <T>(
  fieldGroup: string,
  current: T | undefined,
  submitted: T | undefined,
  degradedFields: ReadonlySet<string>
): T | undefined =>
  submitted === undefined && degradedFields.has(fieldGroup)
    ? undefined
    : preserveDefined(current, submitted);

export const mergeEventUpdateWithCurrent = (
  current: SvaMainserverEventItem,
  submitted: SvaMainserverEventInput,
  deviations: readonly Pick<MainserverDataDeviation, 'fieldGroup'>[] = []
): SvaMainserverEventInput => {
  const degradedFields = new Set(deviations.map(({ fieldGroup }) => fieldGroup));
  return {
    ...submitted,
    externalId: preserveDefinedUnlessDegraded(
      'externalId',
      current.externalId,
      submitted.externalId,
      degradedFields
    ),
    keywords: preserveDefinedUnlessDegraded(
      'keywords',
      current.keywords,
      submitted.keywords,
      degradedFields
    ),
    parentId: preserveDefinedUnlessDegraded(
      'parentId',
      current.parentId,
      submitted.parentId,
      degradedFields
    ),
    accessibilityInformation: preserveDefinedUnlessDegraded(
      'accessibilityInformation',
      current.accessibilityInformation,
      submitted.accessibilityInformation,
      degradedFields
    ),
    tags: preserveDefinedUnlessDegraded('tags', current.tags, submitted.tags, degradedFields),
  };
};

export const mergePoiUpdateWithCurrent = (
  current: SvaMainserverPoiItem,
  submitted: SvaMainserverPoiInput,
  deviations: readonly Pick<MainserverDataDeviation, 'fieldGroup'>[] = []
): SvaMainserverPoiInput => {
  const degradedFields = new Set(deviations.map(({ fieldGroup }) => fieldGroup));
  return {
    ...submitted,
    mobileDescription: preserveDefinedUnlessDegraded(
      'mobileDescription',
      current.mobileDescription,
      submitted.mobileDescription,
      degradedFields
    ),
    externalId: preserveDefinedUnlessDegraded(
      'externalId',
      current.externalId,
      submitted.externalId,
      degradedFields
    ),
    keywords: preserveDefinedUnlessDegraded(
      'keywords',
      current.keywords,
      submitted.keywords,
      degradedFields
    ),
    payload: preserveDefinedUnlessDegraded(
      'payload',
      current.payload,
      submitted.payload,
      degradedFields
    ),
    accessibilityInformation: preserveDefinedUnlessDegraded(
      'accessibilityInformation',
      current.accessibilityInformation,
      submitted.accessibilityInformation,
      degradedFields
    ),
    tags: preserveDefinedUnlessDegraded('tags', current.tags, submitted.tags, degradedFields),
  };
};
