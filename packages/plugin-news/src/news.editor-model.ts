import type {
  NewsContentBlockFormValue,
  NewsContentItem,
  NewsDetailFormValues,
  NewsEditorialStatus,
  NewsFormInput,
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

export const createNewsEditorFormValues = (item: NewsContentItem): NewsDetailFormValues => {
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
    keywords: item.keywords ?? '',
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
    pushNotification: false,
    teaserImageAssetId: null,
    headerImageAssetId: null,
    contentBlocks,
    address: {
      street: item.address?.street ?? '',
      zip: item.address?.zip ?? '',
      city: item.address?.city ?? '',
    },
    pointOfInterestId: item.pointOfInterestId ?? '',
  };
};

export const buildNewsSavePayload = (
  values: NewsDetailFormValues,
  existingItem: NewsContentItem | null,
  nowIso: string
): NewsSavePlan => {
  const publishedAt = values.publicationMode === 'scheduled' ? values.scheduledPublicationAt : nowIso;
  const visible = values.publicationMode !== 'draft';
  const sourceUrlDescription = values.sourceUrlDescription || values.sourceUrl.description || '';

  return {
    visible,
    editorialStatus: deriveNewsEditorialStatus({ visible, publishedAt }, nowIso),
    mutation: {
      ...(existingItem?.externalId !== undefined ? { externalId: existingItem.externalId } : {}),
      ...(existingItem?.keywords !== undefined ? { keywords: existingItem.keywords } : {}),
      ...(existingItem?.fullVersion !== undefined ? { fullVersion: existingItem.fullVersion } : {}),
      ...(existingItem?.charactersToBeShown !== undefined
        ? { charactersToBeShown: Number(existingItem.charactersToBeShown) }
        : {}),
      ...(existingItem?.newsType !== undefined ? { newsType: existingItem.newsType } : {}),
      ...(existingItem?.showPublishDate !== undefined ? { showPublishDate: existingItem.showPublishDate } : {}),
      ...(existingItem?.address ? { address: existingItem.address } : {}),
      ...(existingItem?.pointOfInterestId !== undefined ? { pointOfInterestId: existingItem.pointOfInterestId } : {}),
      title: values.title,
      author: values.author,
      categories: values.categories.map((name) => ({ name })),
      publishedAt: values.publicationMode === 'draft' ? nowIso : publishedAt,
      publicationDate: values.publicationMode === 'draft' ? nowIso : publishedAt,
      sourceUrl: {
        url: values.sourceUrl.url,
        description: sourceUrlDescription,
      },
      contentBlocks: buildFirstContentBlock(values),
      ...(existingItem?.pushNotificationsSentAt ? {} : { pushNotification: values.pushNotificationEnabled }),
    },
  };
};
