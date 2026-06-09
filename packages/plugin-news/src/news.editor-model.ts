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

const createLegacySnapshot = (item: NewsContentItem): NewsLegacyCompatibilitySnapshot => ({
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
  };
};

export const buildNewsSavePayload = (
  values: NewsDetailEditorialFormValues,
  existingSnapshot: NewsLegacyCompatibilitySnapshot | null,
  nowIso: string
): NewsSavePlan => {
  const publishedAt = values.publicationMode === 'scheduled' ? values.scheduledPublicationAt : nowIso;
  const effectivePublicationTimestamp = values.publicationMode === 'draft' ? nowIso : publishedAt;
  const visible = values.publicationMode !== 'draft';
  const sourceUrlDescription = values.sourceUrlDescription || values.sourceUrl.description || '';

  return {
    visible,
    editorialStatus: deriveNewsEditorialStatus({ visible, publishedAt }, nowIso),
    mutation: {
      ...(existingSnapshot?.externalId !== undefined ? { externalId: existingSnapshot.externalId } : {}),
      ...(existingSnapshot?.keywords !== undefined ? { keywords: existingSnapshot.keywords } : {}),
      ...(existingSnapshot?.fullVersion !== undefined ? { fullVersion: existingSnapshot.fullVersion } : {}),
      ...(existingSnapshot?.charactersToBeShown !== undefined
        ? { charactersToBeShown: Number(existingSnapshot.charactersToBeShown) }
        : {}),
      ...(existingSnapshot?.newsType !== undefined ? { newsType: existingSnapshot.newsType } : {}),
      ...(existingSnapshot?.showPublishDate !== undefined ? { showPublishDate: existingSnapshot.showPublishDate } : {}),
      ...(existingSnapshot?.address ? { address: existingSnapshot.address } : {}),
      ...(existingSnapshot?.pointOfInterestId !== undefined ? { pointOfInterestId: existingSnapshot.pointOfInterestId } : {}),
      title: values.title,
      author: values.author,
      categories: values.categories.map((name) => ({ name })),
      publishedAt: effectivePublicationTimestamp,
      publicationDate: effectivePublicationTimestamp,
      sourceUrl: {
        url: values.sourceUrl.url,
        description: sourceUrlDescription,
      },
      contentBlocks: buildFirstContentBlock(values),
      ...(existingSnapshot?.pushNotificationsSentAt ? {} : { pushNotification: values.pushNotificationEnabled }),
    },
  };
};
