export type CockpitCardPayload = Readonly<{
  languageCode: string;
  sortWeight: number;
  openInNewTab: boolean;
}>;

export type CockpitCardCategory = Readonly<{ name: string }>;
export type CockpitCardWebUrl = Readonly<{
  url: string;
  description?: string;
  readonly [key: string]: unknown;
}>;
export type CockpitCardMedia = Readonly<{
  sourceUrl: CockpitCardWebUrl;
  contentType: 'image';
  captionText?: string;
  copyright?: string;
  readonly [key: string]: unknown;
}>;

export type CockpitCardFormValues = Readonly<{
  heading: string;
  text: string;
  languageCode: string;
  sortWeight: number;
  category: string;
  images: CockpitCardMedia[];
  link: string;
  linkText: string;
  openInNewTab: boolean;
  visible: boolean;
  publicationDate?: string;
}>;

export type GenericItemCockpitCardRecord = Readonly<{
  id: string;
  externalId?: string;
  title: string;
  genericType: string;
  contentBlocks: readonly Readonly<{ body?: string }>[];
  payload?: unknown;
  categories: readonly CockpitCardCategory[];
  mediaContents: readonly CockpitCardMedia[];
  webUrls: readonly CockpitCardWebUrl[];
  visible: boolean;
  publicationDate?: string;
  createdAt: string;
  updatedAt: string;
  dataProvider?: Readonly<{ id?: string; name?: string }>;
}>;

export type GenericItemCockpitCardInput = Readonly<{
  title: string;
  genericType: 'COCKPIT_CARD';
  externalId?: string;
  contentBlocks: readonly Readonly<{ body: string }>[];
  payload: Readonly<Record<string, unknown>>;
  categories: readonly CockpitCardCategory[];
  categoryName: string;
  mediaContents: readonly CockpitCardMedia[];
  webUrls: readonly CockpitCardWebUrl[];
  visible: boolean;
  publicationDate?: string;
}>;
