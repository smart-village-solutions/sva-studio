import type {
  SvaMainserverAccessibilityInformationInput,
  SvaMainserverAddressInput,
  SvaMainserverCategoryInput,
  SvaMainserverContactInput,
  SvaMainserverContentBlockInput,
  SvaMainserverDateInput,
  SvaMainserverGenericItemInput,
  SvaMainserverLocationInput,
  SvaMainserverMediaContentInput,
  SvaMainserverOpeningHourInput,
  SvaMainserverPriceInput,
  SvaMainserverWebUrlInput,
} from '../types.js';
import { readBoolean, readString } from './content-route-core.js';

const buildGenericItemScalarFields = (body: Record<string, unknown>) => ({
  ...(readString(body.teaser) ? { teaser: readString(body.teaser) } : {}),
  ...(readBoolean(body.visible) !== undefined ? { visible: readBoolean(body.visible) } : {}),
  ...(readString(body.author) ? { author: readString(body.author) } : {}),
  ...(readString(body.keywords) ? { keywords: readString(body.keywords) } : {}),
  ...(readString(body.externalId) ? { externalId: readString(body.externalId) } : {}),
  ...(readString(body.publicationDate) ? { publicationDate: readString(body.publicationDate) } : {}),
  ...(readString(body.publishedAt) ? { publishedAt: readString(body.publishedAt) } : {}),
  ...(readString(body.categoryName) ? { categoryName: readString(body.categoryName) } : {}),
  ...(body.payload !== undefined ? { payload: body.payload } : {}),
});

const buildGenericItemRelationFields = (input: {
  categories: readonly SvaMainserverCategoryInput[] | undefined;
  contacts: readonly SvaMainserverContactInput[] | undefined;
  webUrls: readonly SvaMainserverWebUrlInput[] | undefined;
  addresses: readonly SvaMainserverAddressInput[] | undefined;
  contentBlocks: readonly SvaMainserverContentBlockInput[] | undefined;
  openingHours: readonly SvaMainserverOpeningHourInput[] | undefined;
  priceInformations: readonly SvaMainserverPriceInput[] | undefined;
  mediaContents: readonly SvaMainserverMediaContentInput[] | undefined;
  locations: readonly SvaMainserverLocationInput[] | undefined;
  dates: readonly SvaMainserverDateInput[] | undefined;
  accessibilityInformations: readonly SvaMainserverAccessibilityInformationInput[] | undefined;
}) => ({
  ...(input.categories ? { categories: input.categories } : {}),
  ...(input.contacts ? { contacts: input.contacts } : {}),
  ...(input.webUrls ? { webUrls: input.webUrls } : {}),
  ...(input.addresses ? { addresses: input.addresses } : {}),
  ...(input.contentBlocks ? { contentBlocks: input.contentBlocks } : {}),
  ...(input.openingHours ? { openingHours: input.openingHours } : {}),
  ...(input.priceInformations ? { priceInformations: input.priceInformations } : {}),
  ...(input.mediaContents ? { mediaContents: input.mediaContents } : {}),
  ...(input.locations ? { locations: input.locations } : {}),
  ...(input.dates ? { dates: input.dates } : {}),
  ...(input.accessibilityInformations ? { accessibilityInformations: input.accessibilityInformations } : {}),
});

export const buildGenericItemInput = (input: {
  body: Record<string, unknown>;
  title: string;
  genericType: string;
  categories: readonly SvaMainserverCategoryInput[] | undefined;
  contacts: readonly SvaMainserverContactInput[] | undefined;
  webUrls: readonly SvaMainserverWebUrlInput[] | undefined;
  addresses: readonly SvaMainserverAddressInput[] | undefined;
  contentBlocks: readonly SvaMainserverContentBlockInput[] | undefined;
  openingHours: readonly SvaMainserverOpeningHourInput[] | undefined;
  priceInformations: readonly SvaMainserverPriceInput[] | undefined;
  mediaContents: readonly SvaMainserverMediaContentInput[] | undefined;
  locations: readonly SvaMainserverLocationInput[] | undefined;
  dates: readonly SvaMainserverDateInput[] | undefined;
  accessibilityInformations: readonly SvaMainserverAccessibilityInformationInput[] | undefined;
}): SvaMainserverGenericItemInput => ({
  title: input.title,
  genericType: input.genericType,
  ...buildGenericItemScalarFields(input.body),
  ...buildGenericItemRelationFields(input),
});
