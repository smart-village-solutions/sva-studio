import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { buildNewsSavePayload, createNewsEditorFormValues } from './news.editor-model.js';
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

const hasInvalidMediaUrls = (mediaContents: readonly NewsMediaContentFormValue[]) =>
  mediaContents.some((media) => {
    const url = media.sourceUrl.url.trim();
    return url.length > 0 && isHttpsUrl(url) === false;
  });

const usesSimplifiedEditorialModel = (values: NewsDetailFormValues) =>
  values.contentBody.trim().length > 0 ||
  values.contentTeaser.trim().length > 0 ||
  values.contentMedia.length > 0 ||
  values.sourceUrlDescription.trim().length > 0 ||
  values.publicationMode !== 'draft' ||
  values.scheduledPublicationAt.trim().length > 0;

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
    keywords: z.string(),
    publishedAt: z.string(),
    publicationDate: z.string(),
    externalId: z.string(),
    newsType: z.string(),
    charactersToBeShown: z.string(),
    fullVersion: z.boolean(),
    showPublishDate: z.boolean(),
    pushNotification: z.boolean(),
    teaserImageAssetId: z.string().nullable(),
    headerImageAssetId: z.string().nullable(),
    contentBlocks: z.array(contentBlockSchema),
    address: z.object({
      street: z.string(),
      zip: z.string(),
      city: z.string(),
    }),
    pointOfInterestId: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.sourceUrl.url.trim().length > 0 && isHttpsUrl(values.sourceUrl.url) === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceUrl', 'url'],
        message: 'sourceUrl',
      });
    }

    if (
      values.charactersToBeShown.trim().length > 0 &&
      (/^\d+$/u.test(values.charactersToBeShown) === false || Number(values.charactersToBeShown) < 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['charactersToBeShown'],
        message: 'charactersToBeShown',
      });
    }

    if (hasInvalidMediaUrls(values.contentMedia)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentMedia'],
        message: 'mediaContents',
      });
    }

    if (
      values.contentBlocks.some((block) => block.body.length > 50_000) ||
      values.contentBlocks.some((block) => hasInvalidMediaUrls(block.mediaContents))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentBlocks'],
        message: 'contentBlocks',
      });
    }

    if (usesSimplifiedEditorialModel(values)) {
      if (values.author.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['author'],
          message: 'author',
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
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['contentBody'],
          message: 'contentBody',
        });
      }

      return;
    }

    if (values.publishedAt.trim().length === 0 || isValidDateString(values.publishedAt) === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publishedAt'],
        message: 'publishedAt',
      });
    }

    if (values.publicationDate.trim().length > 0 && isValidDateString(values.publicationDate) === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publicationDate'],
        message: 'publicationDate',
      });
    }

    if (values.contentBlocks.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentBlocks'],
        message: 'contentBlocks',
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

export const newsDetailFormResolver = zodResolver(newsDetailFormSchema as never);

export const createDefaultNewsDetailFormValues = (author = ''): NewsDetailFormValues => ({
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
  keywords: '',
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
  address: {
    street: '',
    zip: '',
    city: '',
  },
  pointOfInterestId: '',
});

export const mapNewsItemToDetailFormValues = (item: NewsContentItem): NewsDetailFormValues => createNewsEditorFormValues(item);

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

const buildAddressMutation = (
  address: NewsDetailFormValues['address']
): Pick<NewsFormInput, 'address'> | undefined => {
  const street = compactString(address.street);
  const zip = compactString(address.zip);
  const city = compactString(address.city);

  if (!street && !zip && !city) {
    return undefined;
  }

  return {
    address: {
      ...(street ? { street } : {}),
      ...(zip ? { zip } : {}),
      ...(city ? { city } : {}),
    },
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

const buildContentBlockMutation = (block: NewsContentBlockFormValue) => {
  const title = compactString(block.title);
  const intro = compactString(block.intro);
  const body = compactString(block.body);
  const mediaContents = block.mediaContents
    .map(buildMediaContentMutation)
    .filter((media) => Object.keys(media).length > 0);

  return {
    ...(title ? { title } : {}),
    ...(intro ? { intro } : {}),
    ...(body ? { body: block.body.trim() } : {}),
    ...(mediaContents.length > 0 ? { mediaContents } : {}),
  };
};

const buildSimplifiedContentBlockMutation = (values: NewsDetailFormValues) => ({
  title: values.title.trim(),
  intro: values.contentTeaser,
  body: values.contentBody.trim(),
  mediaContents: values.contentMedia
    .map(buildMediaContentMutation)
    .filter((media) => Object.keys(media).length > 0),
});

const buildContentBlocksMutation = (values: NewsDetailFormValues) => {
  if (values.contentBlocks.length > 0) {
    return values.contentBlocks.map(buildContentBlockMutation);
  }

  return [buildSimplifiedContentBlockMutation(values)];
};

const derivePublishedAt = (values: NewsDetailFormValues): string => {
  const explicitPublishedAt = compactString(values.publishedAt);
  if (explicitPublishedAt) {
    return explicitPublishedAt;
  }

  if (values.publicationMode === 'scheduled') {
    return values.scheduledPublicationAt;
  }

  return new Date().toISOString();
};

const shouldUseSimplifiedSavePlan = (values: NewsDetailFormValues) => {
  if (values.publishedAt.trim().length > 0) {
    return false;
  }

  return values.contentBlocks.every((block) =>
    block.title.trim().length === 0 &&
    block.intro.trim().length === 0 &&
    block.body.trim().length === 0 &&
    block.mediaContents.length === 0
  );
};

export const mapNewsDetailFormValuesToMutation = (
  values: NewsDetailFormValues,
  mode: 'create' | 'edit'
): NewsFormInput => {
  const sourceUrl = compactWebUrl(values.sourceUrl.url, values.sourceUrlDescription || values.sourceUrl.description);
  const publishedAt = derivePublishedAt(values);
  const publicationDate =
    compactString(values.publicationDate) ??
    (values.publicationMode === 'scheduled' ? compactString(values.scheduledPublicationAt) : undefined);
  const contentBlocks = buildContentBlocksMutation(values);

  const legacyMutation: NewsFormInput = {
    title: values.title.trim(),
    publishedAt,
    ...(compactString(values.author) ? { author: compactString(values.author) } : {}),
    ...(compactString(values.keywords) ? { keywords: compactString(values.keywords) } : {}),
    ...(compactString(values.externalId) ? { externalId: compactString(values.externalId) } : {}),
    ...(mode === 'edit' || values.fullVersion ? { fullVersion: values.fullVersion } : {}),
    ...(values.charactersToBeShown.trim().length > 0 ? { charactersToBeShown: Number(values.charactersToBeShown) } : {}),
    ...(compactString(values.newsType) ? { newsType: compactString(values.newsType) } : {}),
    ...(publicationDate ? { publicationDate } : {}),
    ...(values.showPublishDate !== undefined ? { showPublishDate: values.showPublishDate } : {}),
    ...(buildCategoryMutation(values.categories) ?? {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(buildAddressMutation(values.address) ?? {}),
    contentBlocks,
    ...(compactString(values.pointOfInterestId) ? { pointOfInterestId: compactString(values.pointOfInterestId) } : {}),
    ...(mode === 'create' && (values.pushNotification || values.pushNotificationEnabled) ? { pushNotification: true } : {}),
  };

  if (shouldUseSimplifiedSavePlan(values) === false) {
    return legacyMutation;
  }

  return buildNewsSavePayload(
    {
      ...values,
      sourceUrl: {
        url: values.sourceUrl.url,
        description: values.sourceUrlDescription || values.sourceUrl.description,
      },
    },
    {
      id: 'existing-news',
      title: values.title,
      contentType: 'news',
      payload: {
        teaser: values.contentTeaser,
        body: values.contentBody,
      },
      status: 'published',
      author: values.author,
      keywords: compactString(values.keywords),
      externalId: compactString(values.externalId),
      fullVersion: values.fullVersion,
      charactersToBeShown: values.charactersToBeShown,
      newsType: compactString(values.newsType),
      publicationDate,
      publishedAt,
      showPublishDate: values.showPublishDate,
      categories: values.categories.map((name) => ({ name })),
      sourceUrl,
      ...(buildAddressMutation(values.address) ?? {}),
      contentBlocks: values.contentBlocks,
      pointOfInterestId: compactString(values.pointOfInterestId),
      pushNotificationsSentAt: mode === 'edit' && values.pushNotificationEnabled === false ? 'already-sent' : undefined,
      visible: values.publicationMode !== 'draft',
      createdAt: publishedAt,
      updatedAt: publishedAt,
    },
    new Date().toISOString()
  ).mutation;
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
