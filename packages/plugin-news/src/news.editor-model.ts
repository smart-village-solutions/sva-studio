import type {
  NewsContentBlockFormValue,
  NewsContentItem,
  NewsDetailEditorialFormValues,
  NewsDetailFormValues,
  NewsEditorialStatus,
  NewsFormInput,
  NewsLegacyCompatibilitySnapshot,
  NewsMediaContentFormValue,
  NewsMediaContent,
  NewsSavePlan,
  NewsWebUrl,
} from './news.types.js';

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

const mapNewsItemMediaContent = (media: NewsMediaContent): NewsMediaContentFormValue => ({
  captionText: media.captionText ?? '',
  copyright: media.copyright ?? '',
  contentType: media.contentType ?? 'image',
  height: media.height !== undefined ? String(media.height) : '',
  width: media.width !== undefined ? String(media.width) : '',
  sourceUrl: {
    url: media.sourceUrl?.url ?? '',
    description: media.sourceUrl?.description ?? '',
  },
});

const mapNewsItemContentBlock = (
  block: NonNullable<NewsContentItem['contentBlocks']>[number]
): NewsContentBlockFormValue => ({
  title: block.title ?? '',
  intro: block.intro ?? '',
  body: block.body ?? '',
  mediaContents: (block.mediaContents ?? []).map(mapNewsItemMediaContent),
});

const defaultFallbackContentBlock = (item: NewsContentItem): NewsContentBlockFormValue => ({
  title: '',
  intro: item.payload.teaser ?? '',
  body: item.payload.body ?? '',
  mediaContents: item.payload.imageUrl
    ? [
        {
          ...defaultMediaContent(),
          sourceUrl: {
            url: item.payload.imageUrl,
            description: '',
          },
        },
      ]
    : [],
});

const mapNewsItemContentBlocks = (item: NewsContentItem): NewsContentBlockFormValue[] => {
  if (item.contentBlocks && item.contentBlocks.length > 0) {
    return item.contentBlocks.map(mapNewsItemContentBlock);
  }

  return [defaultFallbackContentBlock(item)];
};

const mapNewsItemCategories = (item: NewsContentItem): string[] => {
  if (item.categories && item.categories.length > 0) {
    return item.categories.map((category) => category.name);
  }

  return item.payload.category ? [item.payload.category] : [];
};

const hasMeaningfulString = (value?: string | null): value is string => Boolean(value && value.trim().length > 0);

const getMeaningfulCharactersToBeShown = (value?: number | string) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
      return undefined;
    }

    const parsedValue = Number(trimmedValue);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
  }

  return undefined;
};

const getMeaningfulAddress = (address?: NewsLegacyCompatibilitySnapshot['address']) => {
  if (!address) {
    return undefined;
  }

  const street = hasMeaningfulString(address.street) ? address.street : undefined;
  const zip = hasMeaningfulString(address.zip) ? address.zip : undefined;
  const city = hasMeaningfulString(address.city) ? address.city : undefined;

  return street || zip || city ? { ...(street ? { street } : {}), ...(zip ? { zip } : {}), ...(city ? { city } : {}) } : undefined;
};

const createLegacySnapshot = (item: NewsContentItem): NewsLegacyCompatibilitySnapshot => ({
  visible: item.visible,
  keywords: item.keywords,
  externalId: item.externalId,
  fullVersion: item.fullVersion,
  charactersToBeShown: item.charactersToBeShown,
  newsType: item.newsType,
  publishedAt: item.publishedAt,
  publicationDate: item.publicationDate,
  showPublishDate: item.showPublishDate,
  address: item.address
    ? {
        street: item.address.street,
        zip: item.address.zip,
        city: item.address.city,
      }
    : undefined,
  pointOfInterestId: item.pointOfInterestId,
  pushNotificationsSentAt: item.pushNotificationsSentAt,
  teaserImageAssetId: null,
  headerImageAssetId: null,
  legacyContentBlocks: mapNewsItemContentBlocks(item),
});

const buildFirstContentBlock = (
  values: Pick<NewsDetailFormValues, 'title' | 'contentTeaser' | 'contentBody' | 'contentMedia'>
): NewsFormInput['contentBlocks'] => [
  {
    title: values.title,
    intro: values.contentTeaser,
    body: values.contentBody,
    mediaContents: values.contentMedia,
  },
];

export const deriveNewsEditorialStatus = (
  input: Pick<NewsContentItem, 'visible' | 'publishedAt'>,
  nowIso: string
): NewsEditorialStatus => {
  if (input.visible === false) {
    return 'draft';
  }

  return new Date(input.publishedAt).getTime() > new Date(nowIso).getTime() ? 'scheduled' : 'published';
};

export const createNewsEditorFormValues = (item: NewsContentItem): NewsDetailEditorialFormValues => {
  const contentBlocks = mapNewsItemContentBlocks(item);
  const firstBlock = contentBlocks[0];
  const editorialStatus = deriveNewsEditorialStatus(item, new Date().toISOString());

  return {
    title: item.title.trim().length > 0 ? item.title : firstBlock?.title ?? '',
    author: item.author ?? '',
    categories: mapNewsItemCategories(item),
    contentTeaser: firstBlock?.intro ?? '',
    contentBody: firstBlock?.body ?? '',
    contentMedia: firstBlock?.mediaContents ?? [],
    sourceUrl: {
      url: item.sourceUrl?.url ?? item.payload.externalUrl ?? '',
      description: item.sourceUrl?.description ?? '',
    },
    sourceUrlDescription: item.sourceUrl?.description ?? '',
    pushNotificationEnabled: false,
    publicationMode: editorialStatus === 'draft' ? 'draft' : editorialStatus === 'scheduled' ? 'scheduled' : 'immediate',
    scheduledPublicationAt: editorialStatus === 'scheduled' ? item.publishedAt : '',
    __legacySnapshot: createLegacySnapshot(item),
    __compatibilityTouched: {},
  };
};

export const buildNewsSavePayload = (
  values: NewsDetailEditorialFormValues,
  existingSnapshot: NewsLegacyCompatibilitySnapshot | null,
  nowIso: string
): NewsSavePlan => {
  const existingPublishedAt = hasMeaningfulString(existingSnapshot?.publishedAt) ? existingSnapshot.publishedAt : undefined;
  const wasDraft = existingSnapshot?.visible === false;
  const wasScheduled =
    existingSnapshot?.visible !== false &&
    existingPublishedAt !== undefined &&
    new Date(existingPublishedAt).getTime() > new Date(nowIso).getTime();
  const publishedAt =
    values.publicationMode === 'scheduled'
      ? values.scheduledPublicationAt
      : values.publicationMode === 'immediate'
        ? wasDraft || wasScheduled
          ? nowIso
          : existingPublishedAt ?? nowIso
        : existingPublishedAt ?? nowIso;
  const effectivePublicationTimestamp = values.publicationMode === 'draft' ? existingPublishedAt ?? nowIso : publishedAt;
  const visible = values.publicationMode !== 'draft';
  const sourceUrlDescription = values.sourceUrlDescription || values.sourceUrl.description || '';
  const charactersToBeShown = getMeaningfulCharactersToBeShown(existingSnapshot?.charactersToBeShown);
  const address = getMeaningfulAddress(existingSnapshot?.address);
  const publicationDate =
    values.__compatibilityTouched?.publicationDate && hasMeaningfulString(existingSnapshot?.publicationDate)
      ? existingSnapshot.publicationDate
      : values.__compatibilityTouched?.publishedAt && hasMeaningfulString(existingSnapshot?.publicationDate)
      ? existingSnapshot.publicationDate
      : effectivePublicationTimestamp;

  return {
    visible,
    editorialStatus: deriveNewsEditorialStatus({ visible, publishedAt }, nowIso),
    mutation: {
      ...(hasMeaningfulString(existingSnapshot?.externalId) ? { externalId: existingSnapshot.externalId } : {}),
      ...(hasMeaningfulString(existingSnapshot?.keywords) ? { keywords: existingSnapshot.keywords } : {}),
      ...(existingSnapshot?.fullVersion !== undefined ? { fullVersion: existingSnapshot.fullVersion } : {}),
      ...(charactersToBeShown !== undefined ? { charactersToBeShown } : {}),
      ...(hasMeaningfulString(existingSnapshot?.newsType) ? { newsType: existingSnapshot.newsType } : {}),
      ...(existingSnapshot?.showPublishDate !== undefined ? { showPublishDate: existingSnapshot.showPublishDate } : {}),
      ...(address ? { address } : {}),
      ...(hasMeaningfulString(existingSnapshot?.pointOfInterestId) ? { pointOfInterestId: existingSnapshot.pointOfInterestId } : {}),
      title: values.title,
      author: values.author,
      categories: values.categories.map((name) => ({ name })),
      publishedAt: effectivePublicationTimestamp,
      publicationDate,
      sourceUrl: {
        url: values.sourceUrl.url,
        description: sourceUrlDescription,
      },
      contentBlocks: buildFirstContentBlock(values),
      ...(existingSnapshot?.pushNotificationsSentAt ? {} : { pushNotification: values.pushNotificationEnabled }),
    },
  };
};
