export type FaqPayload = Readonly<{
  readonly languageCode: string;
  readonly sortWeight: number;
}>;

export type FaqFormValues = Readonly<{
  readonly question: string;
  readonly answer: string;
  readonly languageCode: string;
  readonly sortWeight: number;
  readonly visible: boolean;
  readonly publicationDate?: string;
}>;

export type GenericItemContentBlock = Readonly<{ readonly body?: string }>;

export type GenericItemFaqRecord = Readonly<{
  readonly id: string;
  readonly title: string;
  readonly genericType: string;
  readonly contentBlocks: readonly GenericItemContentBlock[];
  readonly payload?: unknown;
  readonly visible: boolean;
  readonly publicationDate?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}>;

export type GenericItemFaqInput = Readonly<{
  readonly title: string;
  readonly genericType: 'FAQ';
  readonly contentBlocks: readonly Readonly<{ readonly body: string }>[];
  readonly payload: Readonly<Record<string, unknown>>;
  readonly visible: boolean;
  readonly publicationDate?: string;
}>;
