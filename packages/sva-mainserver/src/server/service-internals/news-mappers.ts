import { z } from 'zod';

import type {
  SvaMainserverAnnouncementSummary,
  SvaMainserverContentBlock,
  SvaMainserverDataProvider,
  SvaMainserverNewsItem,
  SvaMainserverNewsPayload,
  SvaMainserverSetting,
} from '../../types.js';
import type { SvaMainserverNewsItemFragment } from '../../generated/news.js';

import {
  addressSchema,
  buildLegacyContentBlock,
  categorySchema,
  contentBlockSchema,
  dataProviderSchema,
  mapAddress,
  mapCategory,
  mapMediaContent,
  mapWebUrl,
  parseCharactersToBeShown,
  webUrlSchema,
  settingSchema,
} from './mappers-shared.js';
import { defined, optionalString, toSvaMainserverError } from './shared.js';

const newsPayloadSchema = z.object({
  teaser: z.string().optional(),
  body: z.string().optional(),
  imageUrl: z.string().optional(),
  externalUrl: z.string().optional(),
  category: z.string().optional(),
});

const announcementSchema = z.object({
  id: z.string().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  dateStart: z.string().nullish(),
  dateEnd: z.string().nullish(),
  timeStart: z.string().nullish(),
  timeEnd: z.string().nullish(),
  likeCount: z.number().nullish(),
  likedByMe: z.boolean().nullish(),
});

const newsItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullish(),
  author: z.string().nullish(),
  keywords: z.string().nullish(),
  externalId: z.string().nullish(),
  fullVersion: z.boolean().nullish(),
  charactersToBeShown: z.string().nullish(),
  newsType: z.string().nullish(),
  payload: z.unknown(),
  publishedAt: z.string().nullish(),
  publicationDate: z.string().nullish(),
  showPublishDate: z.boolean().nullish(),
  sourceUrl: webUrlSchema.nullish(),
  address: addressSchema.nullish(),
  categories: z.array(categorySchema).nullish(),
  contentBlocks: z.array(contentBlockSchema).nullish(),
  dataProvider: dataProviderSchema.nullish(),
  settings: settingSchema.nullish(),
  announcements: z.array(announcementSchema).nullish(),
  likeCount: z.number().nullish(),
  likedByMe: z.boolean().nullish(),
  pushNotificationsSentAt: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  visible: z.boolean().nullish(),
});

const mapAnnouncement = (value: z.infer<typeof announcementSchema>): SvaMainserverAnnouncementSummary => ({
  ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
  ...(optionalString(value.title) ? { title: optionalString(value.title) } : {}),
  ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
  ...(optionalString(value.dateStart) ? { dateStart: optionalString(value.dateStart) } : {}),
  ...(optionalString(value.dateEnd) ? { dateEnd: optionalString(value.dateEnd) } : {}),
  ...(optionalString(value.timeStart) ? { timeStart: optionalString(value.timeStart) } : {}),
  ...(optionalString(value.timeEnd) ? { timeEnd: optionalString(value.timeEnd) } : {}),
  likeCount: value.likeCount ?? 0,
  likedByMe: value.likedByMe ?? false,
});

const mapContentBlocks = (
  values: readonly z.infer<typeof contentBlockSchema>[] | null | undefined,
  payload: SvaMainserverNewsPayload
): readonly SvaMainserverContentBlock[] => {
  const mapped = (values ?? []).map((value) => ({
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.title) ? { title: optionalString(value.title) } : {}),
    ...(optionalString(value.intro) ? { intro: optionalString(value.intro) } : {}),
    ...(optionalString(value.body) ? { body: optionalString(value.body) } : {}),
    mediaContents: (value.mediaContents ?? []).map(mapMediaContent),
    ...(optionalString(value.createdAt) ? { createdAt: optionalString(value.createdAt) } : {}),
    ...(optionalString(value.updatedAt) ? { updatedAt: optionalString(value.updatedAt) } : {}),
  }));
  const legacyBlock = mapped.length === 0 ? buildLegacyContentBlock(payload) : null;
  return legacyBlock ? [legacyBlock] : mapped;
};

const mapDataProvider = (
  value: z.infer<typeof dataProviderSchema> | null | undefined
): SvaMainserverDataProvider | undefined => {
  if (!value) {
    return undefined;
  }
  const dataProvider = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.name) ? { name: optionalString(value.name) } : {}),
    ...(optionalString(value.dataType) ? { dataType: optionalString(value.dataType) } : {}),
    ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
    ...(optionalString(value.notice) ? { notice: optionalString(value.notice) } : {}),
    ...(mapWebUrl(value.logo) ? { logo: mapWebUrl(value.logo) } : {}),
    ...(mapAddress(value.address) ? { address: mapAddress(value.address) } : {}),
  };
  return Object.keys(dataProvider).length > 0 ? dataProvider : undefined;
};

const mapSettings = (value: z.infer<typeof settingSchema> | null | undefined): SvaMainserverSetting | undefined => {
  if (!value) {
    return undefined;
  }
  const settings = {
    ...(optionalString(value.alwaysRecreateOnImport)
      ? { alwaysRecreateOnImport: optionalString(value.alwaysRecreateOnImport) }
      : {}),
    ...(optionalString(value.displayOnlySummary) ? { displayOnlySummary: optionalString(value.displayOnlySummary) } : {}),
    ...(optionalString(value.onlySummaryLinkText) ? { onlySummaryLinkText: optionalString(value.onlySummaryLinkText) } : {}),
  };
  return Object.keys(settings).length > 0 ? settings : undefined;
};

export const parseNewsPayload = (payload: unknown): SvaMainserverNewsPayload => {
  const rawPayload =
    typeof payload === 'string'
      ? (() => {
          try {
            return JSON.parse(payload) as unknown;
          } catch {
            return payload;
          }
        })()
      : payload;
  const parsed = newsPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return { teaser: '', body: '' };
  }
  return parsed.data;
};

export const mapNewsItem = (item: SvaMainserverNewsItemFragment | null | undefined): SvaMainserverNewsItem => {
  const parsed = newsItemSchema.safeParse(item);
  if (!parsed.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige News-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  const publishedAt = parsed.data.publishedAt ?? parsed.data.publicationDate;
  if (!publishedAt) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Mainserver-News ohne Veröffentlichungsdatum erhalten.',
      statusCode: 502,
    });
  }

  const payload = parseNewsPayload(parsed.data.payload);
  const categories = (parsed.data.categories ?? []).map(mapCategory).filter(defined);

  return {
    id: parsed.data.id,
    title: parsed.data.title ?? '',
    contentType: 'news.article',
    payload,
    status: 'published',
    author: parsed.data.author ?? '',
    ...(optionalString(parsed.data.keywords) ? { keywords: optionalString(parsed.data.keywords) } : {}),
    ...(optionalString(parsed.data.externalId) ? { externalId: optionalString(parsed.data.externalId) } : {}),
    ...(defined(parsed.data.fullVersion) ? { fullVersion: parsed.data.fullVersion } : {}),
    ...(defined(parseCharactersToBeShown(parsed.data.charactersToBeShown))
      ? { charactersToBeShown: parseCharactersToBeShown(parsed.data.charactersToBeShown) }
      : {}),
    ...(optionalString(parsed.data.newsType) ? { newsType: optionalString(parsed.data.newsType) } : {}),
    ...(optionalString(parsed.data.publicationDate) ? { publicationDate: optionalString(parsed.data.publicationDate) } : {}),
    ...(defined(parsed.data.showPublishDate) ? { showPublishDate: parsed.data.showPublishDate } : {}),
    ...(payload.category ? { categoryName: payload.category } : {}),
    categories,
    ...(mapWebUrl(parsed.data.sourceUrl) ? { sourceUrl: mapWebUrl(parsed.data.sourceUrl) } : {}),
    ...(mapAddress(parsed.data.address) ? { address: mapAddress(parsed.data.address) } : {}),
    contentBlocks: mapContentBlocks(parsed.data.contentBlocks, payload),
    ...(mapDataProvider(parsed.data.dataProvider) ? { dataProvider: mapDataProvider(parsed.data.dataProvider) } : {}),
    ...(mapSettings(parsed.data.settings) ? { settings: mapSettings(parsed.data.settings) } : {}),
    announcements: (parsed.data.announcements ?? []).map(mapAnnouncement),
    likeCount: parsed.data.likeCount ?? 0,
    likedByMe: parsed.data.likedByMe ?? false,
    ...(optionalString(parsed.data.pushNotificationsSentAt)
      ? { pushNotificationsSentAt: optionalString(parsed.data.pushNotificationsSentAt) }
      : {}),
    visible: parsed.data.visible !== false,
    createdAt: parsed.data.createdAt ?? publishedAt,
    updatedAt: parsed.data.updatedAt ?? parsed.data.createdAt ?? publishedAt,
    publishedAt,
  };
};

export const mapOptionalNewsItem = (item: SvaMainserverNewsItemFragment | null | undefined): SvaMainserverNewsItem => {
  if (!item) {
    throw toSvaMainserverError({
      code: 'not_found',
      message: 'News-Eintrag wurde nicht gefunden.',
      statusCode: 404,
    });
  }

  return mapNewsItem(item);
};
