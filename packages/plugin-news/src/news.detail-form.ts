import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type {
  NewsContentBlockFormValue,
  NewsContentItem,
  NewsDetailFormValues,
  NewsDetailTabId,
  NewsFormInput,
  NewsMediaContentFormValue,
  NewsWebUrl,
} from './news.types.js';

type DirtyFieldTree = {
  readonly [key: string]: true | DirtyFieldTree | readonly DirtyFieldTree[] | undefined;
};

type DirtyTabState = Record<NewsDetailTabId, boolean>;

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

const defaultContentBlock = (): NewsContentBlockFormValue => ({
  title: '',
  intro: '',
  body: '',
  mediaContents: [],
});

const isValidDateString = (value: string): boolean => Number.isNaN(new Date(value).getTime()) === false;

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

const contentBlockSchema = z.object({
  title: z.string(),
  intro: z.string(),
  body: z.string(),
  mediaContents: z.array(mediaContentSchema),
});

export const newsDetailFormSchema = z
  .object({
    title: z.string().trim().min(1, 'title'),
    author: z.string(),
    keywords: z.string(),
    categoryName: z.string().max(128, 'categoryName'),
    categoriesText: z.string(),
    publishedAt: z
      .string()
      .trim()
      .min(1, 'publishedAt')
      .refine(isValidDateString, 'publishedAt'),
    publicationDate: z
      .string()
      .trim()
      .refine((value) => value.length === 0 || isValidDateString(value), 'publicationDate'),
    externalId: z.string(),
    newsType: z.string(),
    charactersToBeShown: z
      .string()
      .trim()
      .refine((value) => value.length === 0 || (/^\d+$/u.test(value) && Number(value) >= 0), 'charactersToBeShown'),
    fullVersion: z.boolean(),
    showPublishDate: z.boolean(),
    pushNotification: z.boolean(),
    teaserImageAssetId: z.string().nullable(),
    headerImageAssetId: z.string().nullable(),
    contentBlocks: z.array(contentBlockSchema),
    sourceUrl: z.object({
      url: z.string(),
      description: z.string(),
    }),
    address: z.object({
      street: z.string(),
      zip: z.string(),
      city: z.string(),
    }),
    pointOfInterestId: z.string(),
  })
  .superRefine((values, ctx) => {
    const categoryNames = values.categoriesText
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (categoryNames.some((entry) => entry.length > 128)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoriesText'],
        message: 'categories',
      });
    }

    if (values.sourceUrl.url.trim().length > 0 && isHttpsUrl(values.sourceUrl.url) === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceUrl', 'url'],
        message: 'sourceUrl',
      });
    }

    if (values.contentBlocks.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentBlocks'],
        message: 'contentBlocks',
      });
    }

    if (values.contentBlocks.some((block) => block.body.length > 50_000)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentBlocks'],
        message: 'contentBlocks',
      });
    }

    if (values.contentBlocks.some((block) => block.mediaContents.some((media) => {
      const url = media.sourceUrl.url.trim();
      return url.length > 0 && isHttpsUrl(url) === false;
    }))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentBlocks'],
        message: 'mediaContents',
      });
    }

    if (values.contentBlocks.some((block) => getVisibleTextLength(block.body) > 0) === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentBlocks'],
        message: 'contentBlocks',
      });
    }
  });

export const newsDetailFormResolver = zodResolver(newsDetailFormSchema);

export const createDefaultNewsDetailFormValues = (): NewsDetailFormValues => ({
  title: '',
  author: '',
  keywords: '',
  categoryName: '',
  categoriesText: '',
  publishedAt: '',
  publicationDate: '',
  externalId: '',
  newsType: '',
  charactersToBeShown: '',
  fullVersion: false,
  showPublishDate: true,
  pushNotification: false,
  teaserImageAssetId: null,
  headerImageAssetId: null,
  contentBlocks: [defaultContentBlock()],
  sourceUrl: emptyWebUrl(),
  address: {
    street: '',
    zip: '',
    city: '',
  },
  pointOfInterestId: '',
});

export const mapNewsItemToDetailFormValues = (item: NewsContentItem): NewsDetailFormValues => ({
  ...createDefaultNewsDetailFormValues(),
  title: item.title,
  author: item.author ?? '',
  keywords: item.keywords ?? '',
  categoryName: item.categoryName ?? item.payload.category ?? '',
  categoriesText: (item.categories ?? []).map((category) => category.name).join('\n'),
  publishedAt: item.publishedAt,
  publicationDate: item.publicationDate ?? '',
  externalId: item.externalId ?? '',
  newsType: item.newsType ?? '',
  charactersToBeShown:
    typeof item.charactersToBeShown === 'number' || typeof item.charactersToBeShown === 'string'
      ? String(item.charactersToBeShown)
      : '',
  fullVersion: item.fullVersion ?? false,
  showPublishDate: item.showPublishDate ?? true,
  contentBlocks:
    item.contentBlocks && item.contentBlocks.length > 0
      ? item.contentBlocks.map((block) => ({
          title: block.title ?? '',
          intro: block.intro ?? '',
          body: block.body ?? '',
          mediaContents: (block.mediaContents ?? []).map((media) => ({
            captionText: media.captionText ?? '',
            copyright: media.copyright ?? '',
            contentType: media.contentType ?? 'image',
            height: media.height !== undefined ? String(media.height) : '',
            width: media.width !== undefined ? String(media.width) : '',
            sourceUrl: {
              url: media.sourceUrl?.url ?? '',
              description: media.sourceUrl?.description ?? '',
            },
          })),
        }))
      : [
          {
            title: '',
            intro: item.payload.teaser ?? '',
            body: item.payload.body ?? '',
            mediaContents: item.payload.imageUrl ? [{ ...defaultMediaContent(), sourceUrl: { url: item.payload.imageUrl } }] : [],
          },
        ],
  sourceUrl: {
    url: item.sourceUrl?.url ?? item.payload.externalUrl ?? '',
    description: item.sourceUrl?.description ?? '',
  },
  address: {
    street: item.address?.street ?? '',
    zip: item.address?.zip ?? '',
    city: item.address?.city ?? '',
  },
  pointOfInterestId: item.pointOfInterestId ?? '',
});

const compactWebUrl = (value: NewsWebUrl): NewsWebUrl | undefined => {
  const url = compactString(value.url);
  if (!url) {
    return undefined;
  }

  const description = compactString(value.description);
  return description ? { url, description } : { url };
};

export const mapNewsDetailFormValuesToMutation = (
  values: NewsDetailFormValues,
  mode: 'create' | 'edit'
): NewsFormInput => ({
  title: values.title.trim(),
  publishedAt: values.publishedAt,
  ...(compactString(values.author) ? { author: compactString(values.author) } : {}),
  ...(compactString(values.keywords) ? { keywords: compactString(values.keywords) } : {}),
  ...(compactString(values.externalId) ? { externalId: compactString(values.externalId) } : {}),
  ...(values.fullVersion ? { fullVersion: values.fullVersion } : {}),
  ...(values.charactersToBeShown.trim().length > 0 ? { charactersToBeShown: Number(values.charactersToBeShown) } : {}),
  ...(compactString(values.newsType) ? { newsType: compactString(values.newsType) } : {}),
  ...(compactString(values.publicationDate) ? { publicationDate: compactString(values.publicationDate) } : {}),
  ...(values.showPublishDate !== undefined ? { showPublishDate: values.showPublishDate } : {}),
  ...(compactString(values.categoryName) ? { categoryName: compactString(values.categoryName) } : {}),
  ...(values.categoriesText.trim().length > 0
    ? {
        categories: values.categoriesText
          .split('\n')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((name) => ({ name })),
      }
    : {}),
  ...(compactWebUrl(values.sourceUrl) ? { sourceUrl: compactWebUrl(values.sourceUrl) } : {}),
  ...((compactString(values.address.street) || compactString(values.address.zip) || compactString(values.address.city))
    ? {
        address: {
          ...(compactString(values.address.street) ? { street: compactString(values.address.street) } : {}),
          ...(compactString(values.address.zip) ? { zip: compactString(values.address.zip) } : {}),
          ...(compactString(values.address.city) ? { city: compactString(values.address.city) } : {}),
        },
      }
    : {}),
  contentBlocks: values.contentBlocks.map((block) => ({
    ...(compactString(block.title) ? { title: compactString(block.title) } : {}),
    ...(compactString(block.intro) ? { intro: compactString(block.intro) } : {}),
    ...(compactString(block.body) ? { body: block.body.trim() } : {}),
    ...(block.mediaContents.length > 0
      ? {
          mediaContents: block.mediaContents
            .map((media) => ({
              ...(compactString(media.captionText) ? { captionText: compactString(media.captionText) } : {}),
              ...(compactString(media.copyright) ? { copyright: compactString(media.copyright) } : {}),
              ...(compactString(media.contentType) ? { contentType: compactString(media.contentType) } : {}),
              ...(compactString(media.height) ? { height: Number(media.height) } : {}),
              ...(compactString(media.width) ? { width: Number(media.width) } : {}),
              ...(compactWebUrl(media.sourceUrl) ? { sourceUrl: compactWebUrl(media.sourceUrl) } : {}),
            }))
            .filter((media) => Object.keys(media).length > 0),
        }
      : {}),
  })),
  ...(compactString(values.pointOfInterestId) ? { pointOfInterestId: compactString(values.pointOfInterestId) } : {}),
  ...(mode === 'create' && values.pushNotification ? { pushNotification: true } : {}),
});

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
    ['categoryName'],
    ['categoriesText'],
    ['externalId'],
    ['newsType'],
    ['charactersToBeShown'],
    ['fullVersion'],
  ].some((path) => hasDirtyPath(dirtyFields, path)),
  content: [
    ['teaserImageAssetId'],
    ['headerImageAssetId'],
    ['contentBlocks'],
    ['sourceUrl'],
    ['address'],
    ['pointOfInterestId'],
  ].some((path) => hasDirtyPath(dirtyFields, path)),
  release: [
    ['publishedAt'],
    ['publicationDate'],
    ['showPublishDate'],
    ['pushNotification'],
  ].some((path) => hasDirtyPath(dirtyFields, path)),
  history: false,
});

export const buildNewsDetailCharacterCounts = (values: Pick<NewsDetailFormValues, 'title' | 'contentBlocks'>) => ({
  title: values.title.length,
  intros: values.contentBlocks.map((block) => block.intro.length),
  bodies: values.contentBlocks.map((block) => getVisibleTextLength(block.body)),
});
