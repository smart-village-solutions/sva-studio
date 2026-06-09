import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { buildNewsSavePayload, createNewsEditorFormValues } from './news.editor-model.js';
import type {
  NewsContentBlockFormValue,
  NewsContentItem,
  NewsDetailCompatibilityField,
  NewsDetailEditorialFormValues,
  NewsDetailFormValues,
  NewsDetailTabId,
  NewsFormInput,
  NewsLegacyCompatibilitySnapshot,
  NewsMediaContentFormValue,
  NewsWebUrl,
} from './news.types.js';

type DirtyFieldTree = {
  readonly [key: string]: true | DirtyFieldTree | readonly DirtyFieldTree[] | undefined;
};

type DirtyTabState = Record<NewsDetailTabId, boolean>;

type MutableLegacyCompatibilitySnapshot = {
  visible?: boolean;
  keywords?: string;
  externalId?: string;
  fullVersion?: boolean;
  charactersToBeShown?: number | string;
  newsType?: string;
  publishedAt?: string;
  publicationDate?: string;
  showPublishDate?: boolean;
  address?: {
    street?: string;
    zip?: string;
    city?: string;
  };
  pointOfInterestId?: string;
  pushNotificationsSentAt?: string;
  teaserImageAssetId?: string | null;
  headerImageAssetId?: string | null;
  legacyContentBlocks?: NewsContentBlockFormValue[];
};

type CompatibilityFormValues = NewsDetailFormValues & {
  keywords?: string;
  publishedAt?: string;
  publicationDate?: string;
  externalId?: string;
  newsType?: string;
  charactersToBeShown?: string;
  fullVersion?: boolean;
  showPublishDate?: boolean;
  pushNotification?: boolean;
  teaserImageAssetId?: string | null;
  headerImageAssetId?: string | null;
  contentBlocks?: NewsContentBlockFormValue[];
  address?: {
    street?: string;
    zip?: string;
    city?: string;
  };
  pointOfInterestId?: string;
};

const emptyWebUrl = (): NewsWebUrl => ({
  url: '',
  description: '',
});

const defaultMediaContent = (): NewsMediaContentFormValue => ({
  captionText: '',
  copyright: '',
  contentType: 'image',
  height: '',
  width: '',
  sourceUrl: emptyWebUrl(),
});

const createEmptyLegacySnapshot = (): MutableLegacyCompatibilitySnapshot => ({});

const createEmptyCompatibilityTouched = () => ({});

const defaultContentBlock = (): NewsContentBlockFormValue => ({
  title: '',
  intro: '',
  body: '',
  mediaContents: [],
});

const isValidDateString = (value: string): boolean => Number.isNaN(new Date(value).getTime()) === false;

const isValidLocalDateTimeString = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(value);
  if (!match) {
    return false;
  }

  const [, yearString, monthString, dayString, hourString, minuteString] = match;
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);
  const hour = Number(hourString);
  const minute = Number(minuteString);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
  );
};

const isHttpsUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
};

const compactString = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const getVisibleTextLength = (value: string): number => {
  let inTag = false;
  let previousWasWhitespace = true;
  let visibleLength = 0;

  for (const character of value) {
    if (character === '<') {
      inTag = true;
      continue;
    }

    if (character === '>' && inTag) {
      inTag = false;
      previousWasWhitespace = true;
      continue;
    }

    if (inTag) {
      continue;
    }

    if (/\s/u.test(character)) {
      previousWasWhitespace = true;
      continue;
    }

    if (previousWasWhitespace && visibleLength > 0) {
      visibleLength += 1;
    }

    visibleLength += 1;
    previousWasWhitespace = false;
  }

  return visibleLength;
};

const mediaContentSchema = z.object({
  captionText: z.string(),
  copyright: z.string(),
  contentType: z.string(),
  height: z.string(),
  width: z.string(),
  sourceUrl: z.object({
    url: z.string(),
    description: z.string().optional().default(''),
  }),
});

const legacySnapshotSchema = z.object({
  visible: z.boolean().optional(),
  keywords: z.string().optional(),
  externalId: z.string().optional(),
  fullVersion: z.boolean().optional(),
  charactersToBeShown: z.union([z.number(), z.string()]).optional(),
  newsType: z.string().optional(),
  publishedAt: z.string().optional(),
  publicationDate: z.string().optional(),
  showPublishDate: z.boolean().optional(),
  address: z.object({
    street: z.string().optional(),
    zip: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
  pointOfInterestId: z.string().optional(),
  pushNotificationsSentAt: z.string().optional(),
  teaserImageAssetId: z.string().nullable().optional(),
  headerImageAssetId: z.string().nullable().optional(),
  legacyContentBlocks: z.array(z.object({
    title: z.string(),
    intro: z.string(),
    body: z.string(),
    mediaContents: z.array(mediaContentSchema),
  })).optional(),
}).optional();

const hasInvalidMediaUrls = (mediaContents: readonly NewsMediaContentFormValue[]) =>
  mediaContents.some((media) => {
    const url = media.sourceUrl.url.trim();
    return url.length > 0 && isHttpsUrl(url) === false;
  });

const readCompatibilityString = (values: Record<string, unknown>, key: string): string | undefined => {
  const value = values[key];
  return typeof value === 'string' ? value : undefined;
};

const isStrictlyValidCompatibilityDate = (value: string): boolean => {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(value)) {
    return isValidLocalDateTimeString(value);
  }

  return isValidDateString(value);
};

const readCompatibilityContentBlocks = (values: Record<string, unknown>): NewsContentBlockFormValue[] => {
  const rawValue = values.contentBlocks;
  if (Array.isArray(rawValue) === false) {
    return [];
  }

  return rawValue.filter((entry): entry is NewsContentBlockFormValue => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate = entry as Record<string, unknown>;
    return (
      typeof candidate.title === 'string' &&
      typeof candidate.intro === 'string' &&
      typeof candidate.body === 'string' &&
      Array.isArray(candidate.mediaContents)
    );
  });
};

const usesLegacyPageCompatibility = (values: Record<string, unknown>) =>
  'publishedAt' in values ||
  'publicationDate' in values ||
  'contentBlocks' in values ||
  'keywords' in values ||
  'externalId' in values;

export const newsDetailFormSchema = z
  .object({
    title: z.string().trim().min(1, 'title'),
    author: z.string(),
    categories: z.array(z.string().trim().min(1, 'categories').max(128, 'categories')),
    contentTeaser: z.string(),
    contentBody: z.string(),
    contentMedia: z.array(mediaContentSchema),
    sourceUrl: z.object({
      url: z.string(),
      description: z.string(),
    }),
    sourceUrlDescription: z.string(),
    pushNotificationEnabled: z.boolean(),
    publicationMode: z.enum(['draft', 'immediate', 'scheduled']),
    scheduledPublicationAt: z.string(),
    __legacySnapshot: legacySnapshotSchema,
  })
  .passthrough()
  .superRefine((values, ctx) => {
    const compatibilityMode = usesLegacyPageCompatibility(values as Record<string, unknown>);

    if (compatibilityMode === false && values.author.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['author'],
        message: 'author',
      });
    }

    if (values.sourceUrl.url.trim().length > 0 && isHttpsUrl(values.sourceUrl.url) === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceUrl', 'url'],
        message: 'sourceUrl',
      });
    }

    if (hasInvalidMediaUrls(values.contentMedia)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentMedia'],
        message: 'mediaContents',
      });
    }

    if (values.publicationMode === 'scheduled' && isValidDateString(values.scheduledPublicationAt) === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledPublicationAt'],
        message: 'scheduledPublicationAt',
      });
    }

    if (getVisibleTextLength(values.contentBody) === 0) {
      const compatibilityBlocks = readCompatibilityContentBlocks(values as Record<string, unknown>);
      const fallbackBody = compatibilityBlocks[0]?.body ?? '';

      if (getVisibleTextLength(fallbackBody) === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['contentBody'],
          message: 'contentBody',
        });

        if (compatibilityMode) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['contentBlocks'],
            message: 'contentBlocks',
          });
        }
      }
    }

    const compatibilityPublishedAt = readCompatibilityString(values as Record<string, unknown>, 'publishedAt');
    if (
      compatibilityPublishedAt &&
      compatibilityPublishedAt.trim().length > 0 &&
      isStrictlyValidCompatibilityDate(compatibilityPublishedAt) === false
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publishedAt'],
        message: 'publishedAt',
      });
    }

    const compatibilityPublicationDate = readCompatibilityString(values as Record<string, unknown>, 'publicationDate');
    if (
      compatibilityPublicationDate &&
      compatibilityPublicationDate.trim().length > 0 &&
      isStrictlyValidCompatibilityDate(compatibilityPublicationDate) === false
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publicationDate'],
        message: 'publicationDate',
      });
    }

    const compatibilityCharactersToBeShown = readCompatibilityString(values as Record<string, unknown>, 'charactersToBeShown');
    if (
      compatibilityCharactersToBeShown &&
      (/^\d+$/u.test(compatibilityCharactersToBeShown) === false || Number(compatibilityCharactersToBeShown) < 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['charactersToBeShown'],
        message: 'charactersToBeShown',
      });
    }
  });

export const newsDetailFormResolver = zodResolver(newsDetailFormSchema as never);

const ensureLegacySnapshot = (values: NewsDetailEditorialFormValues): MutableLegacyCompatibilitySnapshot => {
  if (!values.__legacySnapshot) {
    values.__legacySnapshot = createEmptyLegacySnapshot();
  }

  return values.__legacySnapshot as MutableLegacyCompatibilitySnapshot;
};

const ensureCompatibilityTouched = (values: NewsDetailEditorialFormValues) => {
  if (!values.__compatibilityTouched) {
    values.__compatibilityTouched = createEmptyCompatibilityTouched();
  }

  return values.__compatibilityTouched;
};

const toCompatibilityContentBlocks = (values: NewsDetailEditorialFormValues): NewsContentBlockFormValue[] => [
  {
    title: values.title,
    intro: values.contentTeaser,
    body: values.contentBody,
    mediaContents: values.contentMedia,
  },
];

const buildCompatibilityContentBlocks = (values: NewsDetailEditorialFormValues): NewsContentBlockFormValue[] => {
  const { legacyContentBlocks = [] } = ensureLegacySnapshot(values);
  const [, ...remainingBlocks] = legacyContentBlocks;

  return [toCompatibilityContentBlocks(values)[0], ...remainingBlocks];
};

const syncPublicationModeFromPublishedAt = (values: NewsDetailEditorialFormValues, nextValue: string) => {
  const trimmedValue = nextValue.trim();

  if (trimmedValue.length === 0) {
    values.publicationMode = 'draft';
    values.scheduledPublicationAt = '';
    return;
  }

  if (isStrictlyValidCompatibilityDate(trimmedValue) === false) {
    values.publicationMode = 'draft';
    values.scheduledPublicationAt = '';
    return;
  }

  values.publicationMode = 'scheduled';
  values.scheduledPublicationAt = trimmedValue;
};

const defineCompatibilityAlias = <TValue>(
  values: CompatibilityFormValues,
  editorialValues: NewsDetailEditorialFormValues,
  key: NewsDetailCompatibilityField,
  getValue: () => TValue,
  setValue: (nextValue: TValue) => void
) => {
  if (Object.prototype.hasOwnProperty.call(values, key)) {
    return;
  }

  Object.defineProperty(values, key, {
    configurable: true,
    enumerable: true,
    get: getValue,
    set: (nextValue: TValue) => {
      ensureCompatibilityTouched(editorialValues)[key] = true;
      setValue(nextValue);
    },
  });
};

const attachLegacyCompatibilityAliases = (values: NewsDetailEditorialFormValues): NewsDetailFormValues => {
  const compatibilityValues = values as CompatibilityFormValues;

  defineCompatibilityAlias(compatibilityValues, values, 'keywords', () => ensureLegacySnapshot(values).keywords ?? '', (nextValue) => {
    ensureLegacySnapshot(values).keywords = nextValue;
  });
  defineCompatibilityAlias(compatibilityValues, values, 'externalId', () => ensureLegacySnapshot(values).externalId ?? '', (nextValue) => {
    ensureLegacySnapshot(values).externalId = nextValue;
  });
  defineCompatibilityAlias(compatibilityValues, values, 'newsType', () => ensureLegacySnapshot(values).newsType ?? '', (nextValue) => {
    ensureLegacySnapshot(values).newsType = nextValue;
  });
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'charactersToBeShown',
    () => {
      const currentValue = ensureLegacySnapshot(values).charactersToBeShown;
      return currentValue === undefined ? '' : String(currentValue);
    },
    (nextValue) => {
      ensureLegacySnapshot(values).charactersToBeShown = nextValue;
    }
  );
  defineCompatibilityAlias(compatibilityValues, values, 'fullVersion', () => ensureLegacySnapshot(values).fullVersion ?? false, (nextValue) => {
    ensureLegacySnapshot(values).fullVersion = nextValue;
  });
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'showPublishDate',
    () => ensureLegacySnapshot(values).showPublishDate ?? true,
    (nextValue) => {
      ensureLegacySnapshot(values).showPublishDate = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'pushNotification',
    () => values.pushNotificationEnabled,
    (nextValue) => {
      values.pushNotificationEnabled = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'teaserImageAssetId',
    () => ensureLegacySnapshot(values).teaserImageAssetId ?? null,
    (nextValue) => {
      ensureLegacySnapshot(values).teaserImageAssetId = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'headerImageAssetId',
    () => ensureLegacySnapshot(values).headerImageAssetId ?? null,
    (nextValue) => {
      ensureLegacySnapshot(values).headerImageAssetId = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'address',
    () =>
      ensureLegacySnapshot(values).address ?? {
        street: '',
        zip: '',
        city: '',
      },
    (nextValue) => {
      ensureLegacySnapshot(values).address = nextValue ?? {};
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'pointOfInterestId',
    () => ensureLegacySnapshot(values).pointOfInterestId ?? '',
    (nextValue) => {
      ensureLegacySnapshot(values).pointOfInterestId = nextValue;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'contentBlocks',
    () => buildCompatibilityContentBlocks(values),
    (nextValue) => {
      const firstBlock = nextValue?.[0] ?? defaultContentBlock();
      ensureLegacySnapshot(values).legacyContentBlocks = nextValue;
      values.title = firstBlock.title || values.title;
      values.contentTeaser = firstBlock.intro;
      values.contentBody = firstBlock.body;
      values.contentMedia = firstBlock.mediaContents;
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'publishedAt',
    () => {
      const snapshot = ensureLegacySnapshot(values);
      if (values.publicationMode === 'scheduled') {
        return values.scheduledPublicationAt;
      }

      return snapshot.publishedAt ?? '';
    },
    (nextValue) => {
      ensureLegacySnapshot(values).publishedAt = nextValue;
      syncPublicationModeFromPublishedAt(values, nextValue);
    }
  );
  defineCompatibilityAlias(
    compatibilityValues,
    values,
    'publicationDate',
    () => ensureLegacySnapshot(values).publicationDate ?? '',
    (nextValue) => {
      ensureLegacySnapshot(values).publicationDate = nextValue;
    }
  );

  return compatibilityValues;
};

export const createDefaultNewsDetailFormValues = (author = ''): NewsDetailFormValues =>
  attachLegacyCompatibilityAliases({
    title: '',
    author,
    categories: [],
    contentTeaser: '',
    contentBody: '',
    contentMedia: [],
    sourceUrl: emptyWebUrl(),
    sourceUrlDescription: '',
    pushNotificationEnabled: false,
    publicationMode: 'draft',
    scheduledPublicationAt: '',
    __legacySnapshot: createEmptyLegacySnapshot(),
    __compatibilityTouched: createEmptyCompatibilityTouched(),
  });

export const mapNewsItemToDetailFormValues = (item: NewsContentItem): NewsDetailFormValues =>
  attachLegacyCompatibilityAliases(createNewsEditorFormValues(item));

const compactWebUrl = (url: string, description?: string): NewsWebUrl | undefined => {
  const compactedUrl = compactString(url);
  if (!compactedUrl) {
    return undefined;
  }

  const compactedDescription = compactString(description);
  return compactedDescription ? { url: compactedUrl, description: compactedDescription } : { url: compactedUrl };
};

const buildCategoryMutation = (categories: NewsDetailFormValues['categories']): Pick<NewsFormInput, 'categories'> | undefined => {
  if (categories.length === 0) {
    return undefined;
  }

  return {
    categories: Array.from(new Set(categories.map((entry) => entry.trim()).filter(Boolean))).map((name) => ({ name })),
  };
};

const buildMediaContentMutation = (media: NewsMediaContentFormValue) => {
  const captionText = compactString(media.captionText);
  const copyright = compactString(media.copyright);
  const contentType = compactString(media.contentType);
  const height = compactString(media.height);
  const width = compactString(media.width);
  const sourceUrl = compactWebUrl(media.sourceUrl.url, media.sourceUrl.description);

  return {
    ...(captionText ? { captionText } : {}),
    ...(copyright ? { copyright } : {}),
    ...(contentType ? { contentType } : {}),
    ...(height ? { height: Number(height) } : {}),
    ...(width ? { width: Number(width) } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
  };
};

const normalizeEditorialValues = (values: NewsDetailFormValues): NewsDetailFormValues => {
  const compatibilityValues = values as CompatibilityFormValues;
  const compatibilityContentBlocks = Array.isArray(compatibilityValues.contentBlocks) ? compatibilityValues.contentBlocks : [];

  if (values.title.length === 0 && compatibilityContentBlocks[0]?.title) {
    values.title = compatibilityContentBlocks[0].title;
  }

  if (values.contentTeaser.length === 0 && compatibilityContentBlocks[0]?.intro) {
    values.contentTeaser = compatibilityContentBlocks[0].intro;
  }

  if (values.contentBody.length === 0 && compatibilityContentBlocks[0]?.body) {
    values.contentBody = compatibilityContentBlocks[0].body;
  }

  if (values.contentMedia.length === 0 && compatibilityContentBlocks[0]?.mediaContents) {
    values.contentMedia = compatibilityContentBlocks[0].mediaContents;
  }

  return values;
};

const syncSnapshotFromCompatibilityValues = (values: NewsDetailFormValues) => {
  const compatibilityValues = values as CompatibilityFormValues;
  const snapshot = ensureLegacySnapshot(values);
  const touched = ensureCompatibilityTouched(values);

  if (touched.keywords && typeof compatibilityValues.keywords === 'string') {
    snapshot.keywords = compatibilityValues.keywords;
  }
  if (touched.externalId && typeof compatibilityValues.externalId === 'string') {
    snapshot.externalId = compatibilityValues.externalId;
  }
  if (touched.newsType && typeof compatibilityValues.newsType === 'string') {
    snapshot.newsType = compatibilityValues.newsType;
  }
  if (touched.charactersToBeShown && typeof compatibilityValues.charactersToBeShown === 'string') {
    snapshot.charactersToBeShown = compatibilityValues.charactersToBeShown;
  }
  if (touched.fullVersion && typeof compatibilityValues.fullVersion === 'boolean') {
    snapshot.fullVersion = compatibilityValues.fullVersion;
  }
  if (touched.showPublishDate && typeof compatibilityValues.showPublishDate === 'boolean') {
    snapshot.showPublishDate = compatibilityValues.showPublishDate;
  }
  if (touched.pushNotification && typeof compatibilityValues.pushNotification === 'boolean') {
    values.pushNotificationEnabled = compatibilityValues.pushNotification;
  }
  if (touched.publishedAt && typeof compatibilityValues.publishedAt === 'string') {
    snapshot.publishedAt = compatibilityValues.publishedAt;
    if (values.publicationMode === 'draft' && values.scheduledPublicationAt.trim().length === 0) {
      syncPublicationModeFromPublishedAt(values, compatibilityValues.publishedAt);
    }
  }
  if (touched.publicationDate && typeof compatibilityValues.publicationDate === 'string') {
    snapshot.publicationDate = compatibilityValues.publicationDate;
  }
  if (touched.address && compatibilityValues.address && typeof compatibilityValues.address === 'object') {
    snapshot.address = compatibilityValues.address;
  }
  if (touched.pointOfInterestId && typeof compatibilityValues.pointOfInterestId === 'string') {
    snapshot.pointOfInterestId = compatibilityValues.pointOfInterestId;
  }
  if (touched.teaserImageAssetId && compatibilityValues.teaserImageAssetId !== undefined) {
    snapshot.teaserImageAssetId = compatibilityValues.teaserImageAssetId;
  }
  if (touched.headerImageAssetId && compatibilityValues.headerImageAssetId !== undefined) {
    snapshot.headerImageAssetId = compatibilityValues.headerImageAssetId;
  }
  if (touched.contentBlocks && Array.isArray(compatibilityValues.contentBlocks)) {
    snapshot.legacyContentBlocks = compatibilityValues.contentBlocks;
  }
};

export const mapNewsDetailFormValuesToMutation = (
  values: NewsDetailFormValues,
  mode: 'create' | 'edit'
): NewsFormInput => {
  const normalizedValues = normalizeEditorialValues({ ...values });
  syncSnapshotFromCompatibilityValues(normalizedValues);
  const snapshot = normalizedValues.__legacySnapshot ?? null;
  const mutation = buildNewsSavePayload(normalizedValues, snapshot, new Date().toISOString()).mutation;
  const categories = buildCategoryMutation(normalizedValues.categories);
  const sourceUrl = compactWebUrl(
    normalizedValues.sourceUrl.url,
    normalizedValues.sourceUrlDescription || normalizedValues.sourceUrl.description
  );

  const contentBlocks = [
    {
      title: normalizedValues.title.trim(),
      intro: normalizedValues.contentTeaser,
      body: normalizedValues.contentBody.trim(),
      mediaContents: normalizedValues.contentMedia
        .map(buildMediaContentMutation)
        .filter((media) => Object.keys(media).length > 0),
    },
  ];

  return {
    ...mutation,
    ...(compactString(normalizedValues.author) ? { author: compactString(normalizedValues.author) } : {}),
    ...(categories ?? {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    contentBlocks,
    ...(mode === 'create' || snapshot?.pushNotificationsSentAt === undefined
      ? { pushNotification: normalizedValues.pushNotificationEnabled }
      : {}),
  };
};

const hasDirtyPath = (tree: DirtyFieldTree | readonly DirtyFieldTree[] | true | undefined, path: readonly string[]): boolean => {
  if (tree === true) {
    return true;
  }

  if (!tree) {
    return false;
  }

  if (Array.isArray(tree)) {
    return tree.some((entry) => hasDirtyPath(entry, path));
  }

  if (path.length === 0) {
    return Object.keys(tree).length > 0;
  }

  const [head, ...tail] = path;
  const nextTree = (tree as Record<string, true | DirtyFieldTree | readonly DirtyFieldTree[] | undefined>)[head];
  return hasDirtyPath(nextTree, tail);
};

export const deriveDirtyNewsDetailTabs = (dirtyFields: DirtyFieldTree): DirtyTabState => ({
  basis: [
    ['title'],
    ['author'],
    ['keywords'],
    ['categories'],
  ].some((path) => hasDirtyPath(dirtyFields, path)),
  content: [
    ['teaserImageAssetId'],
    ['headerImageAssetId'],
    ['contentBlocks'],
    ['contentTeaser'],
    ['contentBody'],
    ['contentMedia'],
    ['sourceUrl'],
    ['sourceUrlDescription'],
    ['address'],
    ['pointOfInterestId'],
  ].some((path) => hasDirtyPath(dirtyFields, path)),
  release: [
    ['publishedAt'],
    ['publicationDate'],
    ['showPublishDate'],
    ['pushNotification'],
    ['pushNotificationEnabled'],
    ['publicationMode'],
    ['scheduledPublicationAt'],
  ].some((path) => hasDirtyPath(dirtyFields, path)),
  settings: [
    ['externalId'],
    ['newsType'],
    ['charactersToBeShown'],
    ['fullVersion'],
  ].some((path) => hasDirtyPath(dirtyFields, path)),
  history: false,
});

export const buildNewsDetailCharacterCounts = (
  values: Pick<NewsDetailFormValues, 'title'> &
  Partial<Pick<NewsDetailFormValues, 'contentTeaser' | 'contentBody'>> & {
    readonly contentBlocks?: readonly Pick<NewsContentBlockFormValue, 'intro' | 'body'>[];
  }
) => {
  const contentBlocks = values.contentBlocks ?? [{ intro: values.contentTeaser ?? '', body: values.contentBody ?? '' }];

  return {
    title: values.title.length,
    intros: contentBlocks.map((block) => block.intro.length),
    bodies: contentBlocks.map((block) => getVisibleTextLength(block.body)),
  };
};
