export type CockpitCardPayload = Readonly<{ languageCode: string; sortWeight: number }>;

export type CockpitCardCategory = Readonly<{ name: string }>;
export type CockpitCardWebUrl = Readonly<{ url: string; description?: string }>;
export type CockpitCardMedia = Readonly<{
  sourceUrl: CockpitCardWebUrl;
  contentType: 'image';
  captionText?: string;
  copyright?: string;
}>;

export type CockpitCardFormValues = Readonly<{
  heading: string;
  text: string;
  languageCode: string;
  sortWeight: number;
  category: string;
  images: CockpitCardMedia[];
  link: string;
  visible: boolean;
  publicationDate?: string;
}>;

export type GenericItemCockpitCardRecord = Readonly<{
  id: string;
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
}>;

export type GenericItemCockpitCardInput = Readonly<{
  title: string;
  genericType: 'COCKPIT_CARD';
  contentBlocks: readonly Readonly<{ body: string }>[];
  payload: Readonly<Record<string, unknown>>;
  categories: readonly CockpitCardCategory[];
  categoryName: string;
  mediaContents: readonly CockpitCardMedia[];
  webUrls: readonly CockpitCardWebUrl[];
  visible: boolean;
  publicationDate?: string;
}>;
