import type {
  NewsContentBlockFormValue,
  NewsContentItem,
  NewsDetailFormValues,
  NewsWebUrl,
} from './news.types.js';

export type MutableLegacyCompatibilitySnapshot = {
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
  payload?: NewsContentItem['payload'];
  legacyContentBlocks?: NewsContentBlockFormValue[];
};

export type CompatibilityFormValues = NewsDetailFormValues & {
  keywords?: string;
  publishedAt?: string;
  publicationDate?: string;
  externalId?: string;
  newsType?: string;
  charactersToBeShown?: string;
  fullVersion?: boolean;
  showPublishDate?: boolean;
  pushNotification?: boolean;
  contentBlocks?: NewsContentBlockFormValue[];
  address?: {
    street?: string;
    zip?: string;
    city?: string;
  };
  pointOfInterestId?: string;
};

export const emptyWebUrl = (): NewsWebUrl => ({
  url: '',
  description: '',
});

export const createEmptyLegacySnapshot = (): MutableLegacyCompatibilitySnapshot => ({});

export const createEmptyCompatibilityTouched = () => ({});

export const defaultContentBlock = (): NewsContentBlockFormValue => ({
  title: '',
  intro: '',
  body: '',
  mediaContents: [],
});
