import { buildNewsSavePayload } from './news.editor-model.js';
import { syncSnapshotFromCompatibilityValues } from './news.detail-form-snapshot.js';
import type { CompatibilityFormValues } from './news.detail-form-compatibility-types.js';
import type {
  NewsDetailFormValues,
  NewsFormInput,
  NewsMediaContentFormValue,
  NewsWebUrl,
} from './news.types.js';

const compactString = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const compactWebUrl = (url: string, description?: string): NewsWebUrl | undefined => {
  const compactedUrl = compactString(url);
  if (!compactedUrl) {
    return undefined;
  }

  const compactedDescription = compactString(description);
  return compactedDescription
    ? { url: compactedUrl, description: compactedDescription }
    : { url: compactedUrl };
};

const buildCategoryMutation = (
  categories: NewsDetailFormValues['categories']
): Pick<NewsFormInput, 'categories'> | undefined => {
  if (categories.length === 0) {
    return undefined;
  }

  return {
    categories: Array.from(new Set(categories.map((entry) => entry.trim()).filter(Boolean))).map(
      (name) => ({ name })
    ),
  };
};

const buildMediaContentMutation = (media: NewsMediaContentFormValue) => {
  const captionText = compactString(media.captionText);
  const copyright = compactString(media.copyright);
  const contentType = compactString(media.contentType);
  const height = media.height.trim().length > 0 ? Number(media.height) : undefined;
  const width = media.width.trim().length > 0 ? Number(media.width) : undefined;
  const sourceUrl = compactWebUrl(media.sourceUrl.url, media.sourceUrl.description);

  return {
    ...(captionText ? { captionText } : {}),
    ...(copyright ? { copyright } : {}),
    ...(contentType ? { contentType } : {}),
    ...(Number.isFinite(height) ? { height } : {}),
    ...(Number.isFinite(width) ? { width } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
  };
};

const buildEditorialContentBlocks = (
  values: Pick<NewsDetailFormValues, 'title' | 'contentIntro' | 'contentBody' | 'contentMedia'>
): NonNullable<NewsFormInput['contentBlocks']> => [
  {
    title: values.title.trim(),
    intro: values.contentIntro,
    body: values.contentBody.trim(),
    mediaContents: values.contentMedia
      .map(buildMediaContentMutation)
      .filter((media) => Object.keys(media).length > 0),
  },
];

const shouldIncludePushNotification = (
  mode: 'create' | 'edit',
  snapshot: NewsDetailFormValues['__legacySnapshot'] | null
) => mode === 'create' || snapshot?.pushNotificationsSentAt === undefined;

const normalizeEditorialValues = (values: NewsDetailFormValues): NewsDetailFormValues => {
  const compatibilityValues = values as CompatibilityFormValues;
  const compatibilityContentBlocks = Array.isArray(compatibilityValues.contentBlocks)
    ? compatibilityValues.contentBlocks
    : [];

  if (values.title.length === 0 && compatibilityContentBlocks[0]?.title) {
    values.title = compatibilityContentBlocks[0].title;
  }

  if (values.contentIntro.length === 0 && compatibilityContentBlocks[0]?.intro) {
    values.contentIntro = compatibilityContentBlocks[0].intro;
  }

  if (values.contentBody.length === 0 && compatibilityContentBlocks[0]?.body) {
    values.contentBody = compatibilityContentBlocks[0].body;
  }

  if (values.contentMedia.length === 0 && compatibilityContentBlocks[0]?.mediaContents) {
    values.contentMedia = compatibilityContentBlocks[0].mediaContents;
  }

  return values;
};

export const mapNewsDetailFormValuesToMutation = (
  values: NewsDetailFormValues,
  mode: 'create' | 'edit',
  canWriteWasteTargets = true
): NewsFormInput => {
  const normalizedValues = normalizeEditorialValues({ ...values });
  syncSnapshotFromCompatibilityValues(normalizedValues);
  const snapshot = normalizedValues.__legacySnapshot ?? null;
  const mutation = buildNewsSavePayload(
    normalizedValues,
    snapshot,
    new Date().toISOString(),
    canWriteWasteTargets
  ).mutation;
  const categories = buildCategoryMutation(normalizedValues.categories);
  const sourceUrl = compactWebUrl(
    normalizedValues.sourceUrl.url,
    normalizedValues.sourceUrlDescription || normalizedValues.sourceUrl.description
  );
  const contentBlocks = buildEditorialContentBlocks(normalizedValues);

  return {
    ...mutation,
    ...(categories ?? {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    contentBlocks,
    ...(normalizedValues.publicationMode === 'immediate' &&
    shouldIncludePushNotification(mode, snapshot)
      ? { pushNotification: normalizedValues.pushNotificationEnabled }
      : {}),
  };
};
