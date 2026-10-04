import type { SvaMainserverListResult } from './types.js';

export type SvaMainserverProjectionContentType =
  | 'news.article'
  | 'events.event-record'
  | 'poi.point-of-interest'
  | 'generic-items.generic-item'
  | 'faq.faq'
  | 'cockpit-cards.cockpit-card'
  | 'projects.project'
  | 'surveys.survey';

export type SvaMainserverGenericItemProjectionContentType =
  'generic-items.generic-item' | 'faq.faq' | 'cockpit-cards.cockpit-card' | 'projects.project';

const svaMainserverGenericItemProjectionContentTypes = new Set<string>([
  'generic-items.generic-item',
  'faq.faq',
  'cockpit-cards.cockpit-card',
  'projects.project',
]);

export const isSvaMainserverGenericItemProjectionContentType = (
  value: string
): value is SvaMainserverGenericItemProjectionContentType =>
  svaMainserverGenericItemProjectionContentTypes.has(value);

export type SvaMainserverGenericTypeOwnership = Readonly<
  Record<string, SvaMainserverGenericItemProjectionContentType>
>;

export type SvaMainserverProjectionListItem = Readonly<{
  id: string;
  contentType: SvaMainserverProjectionContentType;
  title: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  visible?: boolean;
  active?: boolean;
  status?: string;
  languageCode?: string;
  dataProvider?: Readonly<{ id?: string; name?: string }>;
}>;

export type SvaMainserverProjectionListResult =
  SvaMainserverListResult<SvaMainserverProjectionListItem> &
    Readonly<{ skippedInvalidCount: number }>;

export type SvaMainserverWasteLocationKey = {
  readonly street: string;
  readonly zip: string;
  readonly city: string;
};

export type SvaMainserverNewsPayload = Readonly<Record<string, unknown>> & {
  readonly imageUrl?: string;
  readonly externalUrl?: string;
  readonly category?: string;
  readonly wasteLocationKeys?: readonly SvaMainserverWasteLocationKey[];
};

export type SvaMainserverWebUrl = {
  readonly id?: string;
  readonly url: string;
  readonly description?: string;
};

export type SvaMainserverWebUrlInput = {
  readonly url: string;
  readonly description?: string;
};

export type SvaMainserverGeoLocation = {
  readonly latitude?: number;
  readonly longitude?: number;
};

export type SvaMainserverAddress = {
  readonly id?: string;
  readonly addition?: string;
  readonly street?: string;
  readonly zip?: string;
  readonly city?: string;
  readonly kind?: string;
  readonly geoLocation?: SvaMainserverGeoLocation;
};

export type SvaMainserverAddressInput = Omit<SvaMainserverAddress, 'id'> & {
  readonly id?: number;
};
