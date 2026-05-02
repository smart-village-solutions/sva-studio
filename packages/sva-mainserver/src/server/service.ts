import { randomInt } from 'node:crypto';

import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import { readSvaMainserverCredentialsWithStatus } from '@sva/auth-runtime/server';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { z } from 'zod';

import {
  svaMainserverMutationRootTypenameDocument,
  svaMainserverQueryRootTypenameDocument,
  type SvaMainserverMutationRootTypenameMutation,
  type SvaMainserverQueryRootTypenameQuery,
} from '../generated/diagnostics.js';
import {
  svaMainserverCreateNewsDocument,
  svaMainserverDestroyNewsDocument,
  svaMainserverNewsDetailDocument,
  svaMainserverNewsListDocument,
  type SvaMainserverCreateNewsMutation,
  type SvaMainserverDestroyNewsMutation,
  type SvaMainserverNewsDetailQuery,
  type SvaMainserverNewsItemFragment,
  type SvaMainserverNewsListQuery,
} from '../generated/news.js';
import {
  svaMainserverCreateEventDocument,
  svaMainserverCreatePoiDocument,
  svaMainserverDestroyRecordDocument,
  svaMainserverEventDetailDocument,
  type SvaMainserverCreateEventMutation,
  type SvaMainserverCreatePoiMutation,
  type SvaMainserverDestroyRecordMutation,
  type SvaMainserverEventDetailQuery,
  type SvaMainserverEventFragment,
  type SvaMainserverEventListQuery,
  svaMainserverEventListDocument,
  svaMainserverPoiDetailDocument,
  type SvaMainserverPoiDetailQuery,
  type SvaMainserverPoiFragment,
  type SvaMainserverPoiListQuery,
  svaMainserverPoiListDocument,
} from '../generated/events-poi.js';
import type {
  SvaMainserverConnectionInput,
  SvaMainserverConnectionStatus,
  SvaMainserverErrorCode,
  SvaMainserverInstanceConfig,
  SvaMainserverListQuery,
  SvaMainserverListResult,
  SvaMainserverAccessibilityInformation,
  SvaMainserverAddress,
  SvaMainserverAnnouncementSummary,
  SvaMainserverCategory,
  SvaMainserverContact,
  SvaMainserverContentBlock,
  SvaMainserverDataProvider,
  SvaMainserverDate,
  SvaMainserverEventInput,
  SvaMainserverEventItem,
  SvaMainserverLocation,
  SvaMainserverMediaContent,
  SvaMainserverNewsInput,
  SvaMainserverNewsItem,
  SvaMainserverNewsPayload,
  SvaMainserverOperatingCompany,
  SvaMainserverOpeningHour,
  SvaMainserverPoiInput,
  SvaMainserverPoiItem,
  SvaMainserverPrice,
  SvaMainserverRepeatDuration,
  SvaMainserverSetting,
  SvaMainserverWebUrl,
} from '../types.js';
import { loadSvaMainserverInstanceConfig } from './config-store.js';
import { SvaMainserverError } from './errors.js';

type CredentialValue = {
  readonly apiKey: string;
  readonly apiSecret: string;
};

type TimedCacheEntry<TValue> = {
  value: TValue;
  expiresAtMs: number;
  lastUsedAtMs: number;
};

type GraphqlResponse<TResult> = {
  readonly data?: TResult;
  readonly errors?: readonly {
    readonly message?: string;
  }[];
};

type ServiceHop = 'db' | 'keycloak' | 'oauth2' | 'graphql';

type UpstreamRequestInput = {
  readonly url: string;
  readonly init: RequestInit;
  readonly input: SvaMainserverConnectionInput;
  readonly operationName: string;
  readonly hop: Extract<ServiceHop, 'oauth2' | 'graphql'>;
};

export type SvaMainserverServiceOptions = {
  readonly loadInstanceConfig?: (instanceId: string) => Promise<SvaMainserverInstanceConfig>;
  readonly readCredentials?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
  }) => Promise<CredentialValue | null>;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly credentialCacheTtlMs?: number;
  readonly tokenSkewMs?: number;
  readonly upstreamTimeoutMs?: number;
  readonly credentialCacheMaxSize?: number;
  readonly tokenCacheMaxSize?: number;
  readonly retryBaseDelayMs?: number;
  readonly randomIntImpl?: (min: number, max: number) => number;
};

const logger = createSdkLogger({ component: 'sva-mainserver', level: 'debug' });
const tracer = trace.getTracer('sva.mainserver');
const meter = metrics.getMeter('sva.mainserver');
const hopDurationHistogram = meter.createHistogram('sva_mainserver_hop_duration_ms', {
  description: 'Latenz pro Mainserver-Hop in Millisekunden.',
  unit: 'ms',
});
const hopRequestCounter = meter.createCounter('sva_mainserver_hop_total', {
  description: 'Anzahl der Mainserver-Hops nach Typ und Ergebnis.',
});

const DEFAULT_CREDENTIAL_CACHE_TTL_MS = 60_000;
const DEFAULT_TOKEN_SKEW_MS = 60_000;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;
const DEFAULT_CACHE_MAX_SIZE = 256;
const DEFAULT_RETRY_BASE_DELAY_MS = 150;
const RETRYABLE_STATUS_CODES = new Set([503]);
const ALLOWED_MAINSERVER_PAGE_SIZES = [25, 50, 100] as const;
const MAX_MAINSERVER_PAGE_SIZE = 100;
const MAX_MAINSERVER_VISIBLE_OFFSET = 10_000;
const MAX_MAINSERVER_UPSTREAM_SCAN_RECORDS = MAX_MAINSERVER_VISIBLE_OFFSET + MAX_MAINSERVER_PAGE_SIZE;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().finite().positive(),
});

const graphqlResponseSchema = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});
const newsPayloadSchema = z.object({
  teaser: z.string().optional(),
  body: z.string().optional(),
  imageUrl: z.string().optional(),
  externalUrl: z.string().optional(),
  category: z.string().optional(),
});

const webUrlSchema = z.object({
  id: z.string().nullish(),
  url: z.string().nullish(),
  description: z.string().nullish(),
});

const geoLocationSchema = z.object({
  latitude: z.union([z.number(), z.string()]).nullish(),
  longitude: z.union([z.number(), z.string()]).nullish(),
});

const addressSchema = z.object({
  id: z.string().nullish(),
  addition: z.string().nullish(),
  street: z.string().nullish(),
  zip: z.string().nullish(),
  city: z.string().nullish(),
  kind: z.string().nullish(),
  geoLocation: geoLocationSchema.nullish(),
});

type CategoryLike = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly iconName?: string | null;
  readonly position?: number | null;
  readonly tagList?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly children?: readonly CategoryLike[] | null;
};

const categorySchema: z.ZodType<CategoryLike> = z.lazy(() =>
  z.object({
    id: z.string().nullish(),
    name: z.string().nullish(),
    iconName: z.string().nullish(),
    position: z.number().nullish(),
    tagList: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
    children: z.array(categorySchema).nullish(),
  })
);

const mediaContentSchema = z.object({
  id: z.string().nullish(),
  captionText: z.string().nullish(),
  copyright: z.string().nullish(),
  height: z.number().nullish(),
  width: z.number().nullish(),
  contentType: z.string().nullish(),
  sourceUrl: webUrlSchema.nullish(),
});

const contentBlockSchema = z.object({
  id: z.string().nullish(),
  title: z.string().nullish(),
  intro: z.string().nullish(),
  body: z.string().nullish(),
  mediaContents: z.array(mediaContentSchema).nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});

const dataProviderSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  dataType: z.string().nullish(),
  description: z.string().nullish(),
  notice: z.string().nullish(),
  logo: webUrlSchema.nullish(),
  address: addressSchema.nullish(),
});

const settingSchema = z.object({
  alwaysRecreateOnImport: z.string().nullish(),
  displayOnlySummary: z.string().nullish(),
  onlySummaryLinkText: z.string().nullish(),
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

const dateSchema = z.object({
  id: z.string().nullish(),
  weekday: z.string().nullish(),
  dateStart: z.string().nullish(),
  dateEnd: z.string().nullish(),
  timeStart: z.string().nullish(),
  timeEnd: z.string().nullish(),
  timeDescription: z.string().nullish(),
  useOnlyTimeDescription: z.string().nullish(),
});

const contactSchema = z.object({
  id: z.string().nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  phone: z.string().nullish(),
  fax: z.string().nullish(),
  email: z.string().nullish(),
  webUrls: z.array(webUrlSchema).nullish(),
});

const locationSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  department: z.string().nullish(),
  district: z.string().nullish(),
  regionName: z.string().nullish(),
  state: z.string().nullish(),
  geoLocation: geoLocationSchema.nullish(),
});

const operatingCompanySchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  address: addressSchema.nullish(),
  contact: contactSchema.nullish(),
});

const priceSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  amount: z.number().nullish(),
  groupPrice: z.boolean().nullish(),
  ageFrom: z.number().nullish(),
  ageTo: z.number().nullish(),
  minAdultCount: z.number().nullish(),
  maxAdultCount: z.number().nullish(),
  minChildrenCount: z.number().nullish(),
  maxChildrenCount: z.number().nullish(),
  description: z.string().nullish(),
  category: z.string().nullish(),
});

const accessibilityInformationSchema = z.object({
  id: z.string().nullish(),
  description: z.string().nullish(),
  types: z.string().nullish(),
  urls: z.array(webUrlSchema).nullish(),
});

const repeatDurationSchema = z.object({
  id: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  everyYear: z.boolean().nullish(),
});

const openingHourSchema = z.object({
  id: z.string().nullish(),
  weekday: z.string().nullish(),
  dateFrom: z.string().nullish(),
  dateTo: z.string().nullish(),
  timeFrom: z.string().nullish(),
  timeTo: z.string().nullish(),
  sortNumber: z.number().nullish(),
  open: z.boolean().nullish(),
  useYear: z.boolean().nullish(),
  description: z.string().nullish(),
});

const certificateSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
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

const eventItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullish(),
  description: z.string().nullish(),
  externalId: z.string().nullish(),
  keywords: z.string().nullish(),
  parentId: z.number().nullish(),
  dates: z.array(dateSchema).nullish(),
  listDate: z.string().nullish(),
  sortDate: z.string().nullish(),
  repeat: z.boolean().nullish(),
  repeatDuration: repeatDurationSchema.nullish(),
  recurring: z.boolean().nullish(),
  recurringType: z.number().nullish(),
  recurringInterval: z.number().nullish(),
  recurringWeekdays: z.array(z.number()).nullish(),
  category: categorySchema.nullish(),
  categories: z.array(categorySchema).nullish(),
  addresses: z.array(addressSchema).nullish(),
  location: locationSchema.nullish(),
  contacts: z.array(contactSchema).nullish(),
  urls: z.array(webUrlSchema).nullish(),
  mediaContents: z.array(mediaContentSchema).nullish(),
  organizer: operatingCompanySchema.nullish(),
  priceInformations: z.array(priceSchema).nullish(),
  accessibilityInformation: accessibilityInformationSchema.nullish(),
  tagList: z.array(z.string()).nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  visible: z.boolean().nullish(),
});

const poiItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullish(),
  description: z.string().nullish(),
  mobileDescription: z.string().nullish(),
  externalId: z.string().nullish(),
  keywords: z.string().nullish(),
  active: z.boolean().nullish(),
  payload: z.unknown(),
  category: categorySchema.nullish(),
  categories: z.array(categorySchema).nullish(),
  addresses: z.array(addressSchema).nullish(),
  contact: contactSchema.nullish(),
  priceInformations: z.array(priceSchema).nullish(),
  openingHours: z.array(openingHourSchema).nullish(),
  operatingCompany: operatingCompanySchema.nullish(),
  webUrls: z.array(webUrlSchema).nullish(),
  mediaContents: z.array(mediaContentSchema).nullish(),
  location: locationSchema.nullish(),
  certificates: z.array(certificateSchema).nullish(),
  accessibilityInformation: accessibilityInformationSchema.nullish(),
  tagList: z.array(z.string()).nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  visible: z.boolean().nullish(),
});

const toSvaMainserverError = (input: {
  code: SvaMainserverErrorCode;
  message: string;
  statusCode?: number;
}): SvaMainserverError => new SvaMainserverError(input);

const isAbortErrorLike = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'AbortError' || error.name === 'TimeoutError';
};

const normalizeUnexpectedError = (error: unknown): SvaMainserverError => {
  if (error instanceof SvaMainserverError) {
    return error;
  }

  return toSvaMainserverError({
    code: 'network_error',
    message: error instanceof Error ? error.message : 'Unbekannter Mainserver-Fehler.',
    statusCode: 503,
  });
};

const buildLogContext = (
  input: Pick<SvaMainserverConnectionInput, 'instanceId'>,
  extra: Record<string, unknown> = {}
): Record<string, unknown> => {
  const context = getWorkspaceContext();

  return {
    workspace_id: input.instanceId,
    instance_id: input.instanceId,
    request_id: context.requestId,
    trace_id: context.traceId,
    ...extra,
  };
};

const pruneCache = <TValue>(
  cache: Map<string, TimedCacheEntry<TValue>>,
  nowMs: number,
  maxSize: number
): void => {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAtMs <= nowMs) {
      cache.delete(key);
    }
  }

  if (cache.size <= maxSize) {
    return;
  }

  const oldestEntries = [...cache.entries()].sort((left, right) => left[1].lastUsedAtMs - right[1].lastUsedAtMs);
  for (const [key] of oldestEntries.slice(0, cache.size - maxSize)) {
    cache.delete(key);
  }
};

const readCacheValue = <TValue>(
  cache: Map<string, TimedCacheEntry<TValue>>,
  key: string,
  nowMs: number,
  maxSize: number
): TValue | null => {
  pruneCache(cache, nowMs, maxSize);

  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAtMs <= nowMs) {
    cache.delete(key);
    return null;
  }

  entry.lastUsedAtMs = nowMs;
  return entry.value;
};

const writeCacheValue = <TValue>(
  cache: Map<string, TimedCacheEntry<TValue>>,
  key: string,
  value: TValue,
  expiresAtMs: number,
  nowMs: number,
  maxSize: number
): void => {
  cache.set(key, {
    value,
    expiresAtMs,
    lastUsedAtMs: nowMs,
  });
  pruneCache(cache, nowMs, maxSize);
};

type SvaMainserverListInput = SvaMainserverConnectionInput & SvaMainserverListQuery;

const toListResult = <TItem>(
  input: SvaMainserverListInput,
  data: readonly TItem[],
  hasNextPage: boolean
): SvaMainserverListResult<TItem> => ({
  data,
  pagination: {
    page: input.page,
    pageSize: input.pageSize,
    hasNextPage,
  },
});

const normalizeListInput = (input: SvaMainserverListInput): SvaMainserverListInput => {
  const requestedPageSize = Math.trunc(input.pageSize) || 0;
  const pageSize = ALLOWED_MAINSERVER_PAGE_SIZES.includes(requestedPageSize as (typeof ALLOWED_MAINSERVER_PAGE_SIZES)[number])
    ? requestedPageSize
    : 25;
  const maxPage = Math.floor(MAX_MAINSERVER_VISIBLE_OFFSET / pageSize) + 1;
  const page = Math.min(Math.max(1, Math.trunc(input.page) || 1), maxPage);

  return {
    ...input,
    page,
    pageSize,
  };
};

const buildForwardHeaders = (): Record<string, string> => {
  const context = getWorkspaceContext();
  return {
    ...(context.requestId ? { 'X-Request-Id': context.requestId } : {}),
    ...(context.traceId ? { 'X-Trace-Id': context.traceId } : {}),
  };
};

const parseJsonBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch (error) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message:
        error instanceof Error
          ? error.message
          : 'Die Antwort des SVA-Mainservers konnte nicht als JSON gelesen werden.',
      statusCode: 502,
    });
  }
};

const shouldRetryError = (error: unknown): boolean =>
  isAbortErrorLike(error) || (error instanceof Error && error.name === 'TypeError');

const resolveNetworkErrorMessage = (input: {
  error: unknown;
  timeoutMessage: string;
  defaultMessage: string;
}): string => {
  if (isAbortErrorLike(input.error)) {
    return input.timeoutMessage;
  }
  if (input.error instanceof Error) {
    return input.error.message;
  }
  return input.defaultMessage;
};

const resolveTokenStatusErrorCode = (status: number): SvaMainserverErrorCode => {
  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 403) {
    return 'forbidden';
  }
  return 'token_request_failed';
};

const resolveGraphqlStatusErrorCode = (status: number): SvaMainserverErrorCode => {
  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 403) {
    return 'forbidden';
  }
  return 'network_error';
};

const parseGraphqlPayload = <TResult>(payload: unknown): TResult => {
  const payloadResult = graphqlResponseSchema.safeParse(payload);
  if (!payloadResult.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige GraphQL-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  const result = payloadResult.data as GraphqlResponse<TResult>;
  if (result.errors && result.errors.length > 0) {
    throw toSvaMainserverError({
      code: 'graphql_error',
      message: `GraphQL-Antwort des SVA-Mainservers enthielt ${result.errors.length} Fehler.`,
      statusCode: 502,
    });
  }
  if (result.data === undefined) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'GraphQL-Antwort des SVA-Mainservers enthielt keine Daten.',
      statusCode: 502,
    });
  }

  return result.data;
};

const assertPublishedAt = (publishedAt: string): void => {
  if (publishedAt.trim().length === 0) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Veröffentlichungsdatum ist für Mainserver-News erforderlich.',
      statusCode: 400,
    });
  }
};

const parseNewsPayload = (payload: unknown): SvaMainserverNewsPayload => {
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

const defined = <TValue>(value: TValue | null | undefined): value is TValue => value !== null && value !== undefined;

const optionalString = (value: string | null | undefined): string | undefined =>
  value && value.length > 0 ? value : undefined;

const optionalNumber = (value: number | null | undefined): number | undefined => (defined(value) ? value : undefined);

const parseCharactersToBeShown = (value: string | null | undefined): number | undefined => {
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const mapWebUrl = (value: z.infer<typeof webUrlSchema> | null | undefined): SvaMainserverWebUrl | undefined => {
  if (!value?.url) {
    return undefined;
  }
  return {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    url: value.url,
    ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
  };
};

const parseGeoCoordinate = (value: number | string | null | undefined): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const mapAddress = (value: z.infer<typeof addressSchema> | null | undefined): SvaMainserverAddress | undefined => {
  if (!value) {
    return undefined;
  }
  const geoLocation = value.geoLocation
    ? {
        ...(defined(parseGeoCoordinate(value.geoLocation.latitude))
          ? { latitude: parseGeoCoordinate(value.geoLocation.latitude) }
          : {}),
        ...(defined(parseGeoCoordinate(value.geoLocation.longitude))
          ? { longitude: parseGeoCoordinate(value.geoLocation.longitude) }
          : {}),
      }
    : undefined;
  const address = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.addition) ? { addition: optionalString(value.addition) } : {}),
    ...(optionalString(value.street) ? { street: optionalString(value.street) } : {}),
    ...(optionalString(value.zip) ? { zip: optionalString(value.zip) } : {}),
    ...(optionalString(value.city) ? { city: optionalString(value.city) } : {}),
    ...(optionalString(value.kind) ? { kind: optionalString(value.kind) } : {}),
    ...(geoLocation && (defined(geoLocation.latitude) || defined(geoLocation.longitude)) ? { geoLocation } : {}),
  };
  return Object.keys(address).length > 0 ? address : undefined;
};

const mapCategory = (value: CategoryLike): SvaMainserverCategory | null => {
  if (!value.name) {
    return null;
  }
  return {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    name: value.name,
    ...(optionalString(value.iconName) ? { iconName: optionalString(value.iconName) } : {}),
    ...(optionalNumber(value.position) !== undefined ? { position: value.position as number } : {}),
    ...(optionalString(value.tagList) ? { tagList: optionalString(value.tagList) } : {}),
    ...(optionalString(value.createdAt) ? { createdAt: optionalString(value.createdAt) } : {}),
    ...(optionalString(value.updatedAt) ? { updatedAt: optionalString(value.updatedAt) } : {}),
    children: (value.children ?? []).map(mapCategory).filter(defined),
  };
};

const mapMediaContent = (value: z.infer<typeof mediaContentSchema>): SvaMainserverMediaContent => ({
  ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
  ...(optionalString(value.captionText) ? { captionText: optionalString(value.captionText) } : {}),
  ...(optionalString(value.copyright) ? { copyright: optionalString(value.copyright) } : {}),
  ...(optionalNumber(value.height) !== undefined ? { height: value.height as number } : {}),
  ...(optionalNumber(value.width) !== undefined ? { width: value.width as number } : {}),
  ...(optionalString(value.contentType) ? { contentType: optionalString(value.contentType) } : {}),
  ...(mapWebUrl(value.sourceUrl) ? { sourceUrl: mapWebUrl(value.sourceUrl) } : {}),
});

const buildLegacyContentBlock = (payload: SvaMainserverNewsPayload): SvaMainserverContentBlock | null => {
  if (!payload.body && !payload.teaser) {
    return null;
  }
  return {
    ...(payload.teaser ? { intro: payload.teaser } : {}),
    ...(payload.body ? { body: payload.body } : {}),
    mediaContents: payload.imageUrl
      ? [
          {
            contentType: 'image',
            sourceUrl: {
              url: payload.imageUrl,
            },
          },
        ]
      : [],
  };
};

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

const mapAnnouncement = (
  value: z.infer<typeof announcementSchema>
): SvaMainserverAnnouncementSummary => ({
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

const mapNewsItem = (item: SvaMainserverNewsItemFragment | null | undefined): SvaMainserverNewsItem => {
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

const mapOptionalNewsItem = (item: SvaMainserverNewsItemFragment | null | undefined): SvaMainserverNewsItem => {
  if (!item) {
    throw toSvaMainserverError({
      code: 'not_found',
      message: 'News-Eintrag wurde nicht gefunden.',
      statusCode: 404,
    });
  }

  return mapNewsItem(item);
};

const mapDate = (value: z.infer<typeof dateSchema>): SvaMainserverDate => ({
  ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
  ...(optionalString(value.weekday) ? { weekday: optionalString(value.weekday) } : {}),
  ...(optionalString(value.dateStart) ? { dateStart: optionalString(value.dateStart) } : {}),
  ...(optionalString(value.dateEnd) ? { dateEnd: optionalString(value.dateEnd) } : {}),
  ...(optionalString(value.timeStart) ? { timeStart: optionalString(value.timeStart) } : {}),
  ...(optionalString(value.timeEnd) ? { timeEnd: optionalString(value.timeEnd) } : {}),
  ...(optionalString(value.timeDescription) ? { timeDescription: optionalString(value.timeDescription) } : {}),
  ...(optionalString(value.useOnlyTimeDescription)
    ? { useOnlyTimeDescription: optionalString(value.useOnlyTimeDescription) }
    : {}),
});

const mapContact = (value: z.infer<typeof contactSchema> | null | undefined): SvaMainserverContact | undefined => {
  if (!value) {
    return undefined;
  }
  const contact = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.firstName) ? { firstName: optionalString(value.firstName) } : {}),
    ...(optionalString(value.lastName) ? { lastName: optionalString(value.lastName) } : {}),
    ...(optionalString(value.phone) ? { phone: optionalString(value.phone) } : {}),
    ...(optionalString(value.fax) ? { fax: optionalString(value.fax) } : {}),
    ...(optionalString(value.email) ? { email: optionalString(value.email) } : {}),
    webUrls: (value.webUrls ?? []).map(mapWebUrl).filter(defined),
  };
  return Object.keys(contact).length > 1 || contact.webUrls.length > 0 ? contact : undefined;
};

const mapLocation = (value: z.infer<typeof locationSchema> | null | undefined): SvaMainserverLocation | undefined => {
  if (!value) {
    return undefined;
  }
  const geoLocation = value.geoLocation
    ? {
        ...(defined(parseGeoCoordinate(value.geoLocation.latitude))
          ? { latitude: parseGeoCoordinate(value.geoLocation.latitude) }
          : {}),
        ...(defined(parseGeoCoordinate(value.geoLocation.longitude))
          ? { longitude: parseGeoCoordinate(value.geoLocation.longitude) }
          : {}),
      }
    : undefined;
  const location = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.name) ? { name: optionalString(value.name) } : {}),
    ...(optionalString(value.department) ? { department: optionalString(value.department) } : {}),
    ...(optionalString(value.district) ? { district: optionalString(value.district) } : {}),
    ...(optionalString(value.regionName) ? { regionName: optionalString(value.regionName) } : {}),
    ...(optionalString(value.state) ? { state: optionalString(value.state) } : {}),
    ...(geoLocation && (defined(geoLocation.latitude) || defined(geoLocation.longitude)) ? { geoLocation } : {}),
  };
  return Object.keys(location).length > 0 ? location : undefined;
};

const mapOperatingCompany = (
  value: z.infer<typeof operatingCompanySchema> | null | undefined
): SvaMainserverOperatingCompany | undefined => {
  if (!value) {
    return undefined;
  }
  const company = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.name) ? { name: optionalString(value.name) } : {}),
    ...(mapAddress(value.address) ? { address: mapAddress(value.address) } : {}),
    ...(mapContact(value.contact) ? { contact: mapContact(value.contact) } : {}),
  };
  return Object.keys(company).length > 0 ? company : undefined;
};

const mapPrice = (value: z.infer<typeof priceSchema>): SvaMainserverPrice => ({
  ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
  ...(optionalString(value.name) ? { name: optionalString(value.name) } : {}),
  ...(optionalNumber(value.amount) !== undefined ? { amount: value.amount as number } : {}),
  ...(defined(value.groupPrice) ? { groupPrice: value.groupPrice } : {}),
  ...(optionalNumber(value.ageFrom) !== undefined ? { ageFrom: value.ageFrom as number } : {}),
  ...(optionalNumber(value.ageTo) !== undefined ? { ageTo: value.ageTo as number } : {}),
  ...(optionalNumber(value.minAdultCount) !== undefined ? { minAdultCount: value.minAdultCount as number } : {}),
  ...(optionalNumber(value.maxAdultCount) !== undefined ? { maxAdultCount: value.maxAdultCount as number } : {}),
  ...(optionalNumber(value.minChildrenCount) !== undefined ? { minChildrenCount: value.minChildrenCount as number } : {}),
  ...(optionalNumber(value.maxChildrenCount) !== undefined ? { maxChildrenCount: value.maxChildrenCount as number } : {}),
  ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
  ...(optionalString(value.category) ? { category: optionalString(value.category) } : {}),
});

const mapAccessibilityInformation = (
  value: z.infer<typeof accessibilityInformationSchema> | null | undefined
): SvaMainserverAccessibilityInformation | undefined => {
  if (!value) {
    return undefined;
  }
  const information = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
    ...(optionalString(value.types) ? { types: optionalString(value.types) } : {}),
    urls: (value.urls ?? []).map(mapWebUrl).filter(defined),
  };
  return Object.keys(information).length > 1 || information.urls.length > 0 ? information : undefined;
};

const mapRepeatDuration = (
  value: z.infer<typeof repeatDurationSchema> | null | undefined
): SvaMainserverRepeatDuration | undefined => {
  if (!value) {
    return undefined;
  }
  const repeatDuration = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.startDate) ? { startDate: optionalString(value.startDate) } : {}),
    ...(optionalString(value.endDate) ? { endDate: optionalString(value.endDate) } : {}),
    ...(defined(value.everyYear) ? { everyYear: value.everyYear } : {}),
  };
  return Object.keys(repeatDuration).length > 0 ? repeatDuration : undefined;
};

const mapOpeningHour = (value: z.infer<typeof openingHourSchema>): SvaMainserverOpeningHour => ({
  ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
  ...(optionalString(value.weekday) ? { weekday: optionalString(value.weekday) } : {}),
  ...(optionalString(value.dateFrom) ? { dateFrom: optionalString(value.dateFrom) } : {}),
  ...(optionalString(value.dateTo) ? { dateTo: optionalString(value.dateTo) } : {}),
  ...(optionalString(value.timeFrom) ? { timeFrom: optionalString(value.timeFrom) } : {}),
  ...(optionalString(value.timeTo) ? { timeTo: optionalString(value.timeTo) } : {}),
  ...(optionalNumber(value.sortNumber) !== undefined ? { sortNumber: value.sortNumber as number } : {}),
  ...(defined(value.open) ? { open: value.open } : {}),
  ...(defined(value.useYear) ? { useYear: value.useYear } : {}),
  ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
});

const mapEventItem = (item: SvaMainserverEventFragment | null | undefined): SvaMainserverEventItem => {
  const parsed = eventItemSchema.safeParse(item);
  if (!parsed.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige Event-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  const categories = (parsed.data.categories ?? []).map(mapCategory).filter(defined);
  const category = mapCategory(parsed.data.category ?? {});
  const createdAt = parsed.data.createdAt ?? parsed.data.listDate ?? new Date(0).toISOString();

  return {
    id: parsed.data.id,
    title: parsed.data.title ?? '',
    contentType: 'events.event-record',
    status: 'published',
    ...(optionalString(parsed.data.description) ? { description: optionalString(parsed.data.description) } : {}),
    ...(optionalString(parsed.data.externalId) ? { externalId: optionalString(parsed.data.externalId) } : {}),
    ...(optionalString(parsed.data.keywords) ? { keywords: optionalString(parsed.data.keywords) } : {}),
    ...(optionalNumber(parsed.data.parentId) !== undefined ? { parentId: parsed.data.parentId as number } : {}),
    dates: (parsed.data.dates ?? []).map(mapDate),
    ...(optionalString(parsed.data.listDate) ? { listDate: optionalString(parsed.data.listDate) } : {}),
    ...(optionalString(parsed.data.sortDate) ? { sortDate: optionalString(parsed.data.sortDate) } : {}),
    ...(defined(parsed.data.repeat) ? { repeat: parsed.data.repeat } : {}),
    ...(mapRepeatDuration(parsed.data.repeatDuration) ? { repeatDuration: mapRepeatDuration(parsed.data.repeatDuration) } : {}),
    ...(defined(parsed.data.recurring) ? { recurring: parsed.data.recurring } : {}),
    ...(optionalNumber(parsed.data.recurringType) !== undefined ? { recurringType: parsed.data.recurringType as number } : {}),
    ...(optionalNumber(parsed.data.recurringInterval) !== undefined
      ? { recurringInterval: parsed.data.recurringInterval as number }
      : {}),
    recurringWeekdays: parsed.data.recurringWeekdays ?? [],
    ...(category ? { categoryName: category.name } : {}),
    categories,
    addresses: (parsed.data.addresses ?? []).map(mapAddress).filter(defined),
    ...(mapLocation(parsed.data.location) ? { location: mapLocation(parsed.data.location) } : {}),
    contacts: (parsed.data.contacts ?? []).map(mapContact).filter(defined),
    urls: (parsed.data.urls ?? []).map(mapWebUrl).filter(defined),
    mediaContents: (parsed.data.mediaContents ?? []).map(mapMediaContent),
    ...(mapOperatingCompany(parsed.data.organizer) ? { organizer: mapOperatingCompany(parsed.data.organizer) } : {}),
    priceInformations: (parsed.data.priceInformations ?? []).map(mapPrice),
    ...(mapAccessibilityInformation(parsed.data.accessibilityInformation)
      ? { accessibilityInformation: mapAccessibilityInformation(parsed.data.accessibilityInformation) }
      : {}),
    tags: parsed.data.tagList ?? [],
    visible: parsed.data.visible !== false,
    createdAt,
    updatedAt: parsed.data.updatedAt ?? createdAt,
  };
};

const mapOptionalEventItem = (item: SvaMainserverEventFragment | null | undefined): SvaMainserverEventItem => {
  if (!item) {
    throw toSvaMainserverError({ code: 'not_found', message: 'Event wurde nicht gefunden.', statusCode: 404 });
  }
  return mapEventItem(item);
};

const mapPoiItem = (item: SvaMainserverPoiFragment | null | undefined): SvaMainserverPoiItem => {
  const parsed = poiItemSchema.safeParse(item);
  if (!parsed.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige POI-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  const categories = (parsed.data.categories ?? []).map(mapCategory).filter(defined);
  const category = mapCategory(parsed.data.category ?? {});
  const createdAt = parsed.data.createdAt ?? new Date(0).toISOString();

  return {
    id: parsed.data.id,
    name: parsed.data.name ?? '',
    contentType: 'poi.point-of-interest',
    status: 'published',
    ...(optionalString(parsed.data.description) ? { description: optionalString(parsed.data.description) } : {}),
    ...(optionalString(parsed.data.mobileDescription)
      ? { mobileDescription: optionalString(parsed.data.mobileDescription) }
      : {}),
    ...(optionalString(parsed.data.externalId) ? { externalId: optionalString(parsed.data.externalId) } : {}),
    ...(optionalString(parsed.data.keywords) ? { keywords: optionalString(parsed.data.keywords) } : {}),
    active: parsed.data.active !== false,
    ...(category ? { categoryName: category.name } : {}),
    ...(parsed.data.payload !== undefined && parsed.data.payload !== null ? { payload: parsed.data.payload } : {}),
    categories,
    addresses: (parsed.data.addresses ?? []).map(mapAddress).filter(defined),
    ...(mapContact(parsed.data.contact) ? { contact: mapContact(parsed.data.contact) } : {}),
    priceInformations: (parsed.data.priceInformations ?? []).map(mapPrice),
    openingHours: (parsed.data.openingHours ?? []).map(mapOpeningHour),
    ...(mapOperatingCompany(parsed.data.operatingCompany)
      ? { operatingCompany: mapOperatingCompany(parsed.data.operatingCompany) }
      : {}),
    webUrls: (parsed.data.webUrls ?? []).map(mapWebUrl).filter(defined),
    mediaContents: (parsed.data.mediaContents ?? []).map(mapMediaContent),
    ...(mapLocation(parsed.data.location) ? { location: mapLocation(parsed.data.location) } : {}),
    certificates: (parsed.data.certificates ?? [])
      .filter((certificate) => certificate.name)
      .map((certificate) => ({
        ...(optionalString(certificate.id) ? { id: optionalString(certificate.id) } : {}),
        name: certificate.name as string,
      })),
    ...(mapAccessibilityInformation(parsed.data.accessibilityInformation)
      ? { accessibilityInformation: mapAccessibilityInformation(parsed.data.accessibilityInformation) }
      : {}),
    tags: parsed.data.tagList ?? [],
    visible: parsed.data.visible !== false,
    createdAt,
    updatedAt: parsed.data.updatedAt ?? createdAt,
  };
};

const mapOptionalPoiItem = (item: SvaMainserverPoiFragment | null | undefined): SvaMainserverPoiItem => {
  if (!item) {
    throw toSvaMainserverError({ code: 'not_found', message: 'POI wurde nicht gefunden.', statusCode: 404 });
  }
  return mapPoiItem(item);
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const unwrapSettledResult = <TValue>(
  result: PromiseSettledResult<TValue>
): { ok: true; value: TValue } | { ok: false; error: SvaMainserverError } =>
  result.status === 'fulfilled'
    ? { ok: true, value: result.value }
    : { ok: false, error: normalizeUnexpectedError(result.reason) };

const withObservedHop = async <TValue>(
  input: {
    readonly hop: ServiceHop;
    readonly operationName: string;
    readonly connection: SvaMainserverConnectionInput;
  },
  work: () => Promise<TValue>
): Promise<TValue> => {
  const startMs = Date.now();

  return tracer.startActiveSpan(`sva_mainserver.${input.hop}`, async (span) => {
    span.setAttributes({
      'sva_mainserver.hop': input.hop,
      'sva_mainserver.operation': input.operationName,
      workspace_id: input.connection.instanceId,
      instance_id: input.connection.instanceId,
    });

    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      hopDurationHistogram.record(Date.now() - startMs, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'success',
      });
      hopRequestCounter.add(1, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'success',
      });
      return result;
    } catch (error) {
      const normalizedError = normalizeUnexpectedError(error);
      span.recordException(normalizedError);
      span.setStatus({ code: SpanStatusCode.ERROR, message: normalizedError.message });
      hopDurationHistogram.record(Date.now() - startMs, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'error',
        error_code: normalizedError.code,
      });
      hopRequestCounter.add(1, {
        hop: input.hop,
        operation: input.operationName,
        outcome: 'error',
        error_code: normalizedError.code,
      });
      throw normalizedError;
    } finally {
      span.end();
    }
  });
};

export const createSvaMainserverService = (options: SvaMainserverServiceOptions = {}) => {
  const loadInstanceConfig = options.loadInstanceConfig ?? loadSvaMainserverInstanceConfig;
  const readCredentials =
    options.readCredentials ??
    (async (input: { instanceId: string; keycloakSubject: string }) => {
      const result = await readSvaMainserverCredentialsWithStatus(input.keycloakSubject, input.instanceId);
      if (result.status === 'ok') {
        return result.credentials;
      }

      if (result.status === 'identity_provider_unavailable') {
        throw toSvaMainserverError({
          code: 'identity_provider_unavailable',
          message: 'Identity-Provider für Mainserver-Credentials ist nicht verfügbar.',
          statusCode: 503,
        });
      }

      return null;
    });
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const credentialCacheTtlMs = options.credentialCacheTtlMs ?? DEFAULT_CREDENTIAL_CACHE_TTL_MS;
  const tokenSkewMs = options.tokenSkewMs ?? DEFAULT_TOKEN_SKEW_MS;
  const upstreamTimeoutMs = options.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
  const credentialCacheMaxSize = options.credentialCacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
  const tokenCacheMaxSize = options.tokenCacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  const randomIntImpl = options.randomIntImpl ?? randomInt;

  const credentialCache = new Map<string, TimedCacheEntry<CredentialValue>>();
  const tokenCache = new Map<string, TimedCacheEntry<string>>();
  const credentialLoads = new Map<string, Promise<CredentialValue>>();
  const tokenLoads = new Map<string, Promise<string>>();

  const loadValidatedInstanceConfig = async (
    input: SvaMainserverConnectionInput,
    operationName: string
  ): Promise<SvaMainserverInstanceConfig> =>
    withObservedHop(
      {
        hop: 'db',
        operationName,
        connection: input,
      },
      async () => loadInstanceConfig(input.instanceId)
    );

  const fetchWithRetry = async ({ url, init, input, operationName, hop }: UpstreamRequestInput): Promise<Response> => {
    const executeRequest = async (): Promise<Response> =>
      fetchImpl(url, {
        ...init,
        redirect: 'manual',
        signal: init.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(upstreamTimeoutMs)])
          : AbortSignal.timeout(upstreamTimeoutMs),
      });

    try {
      const firstResponse = await executeRequest();
      if (!RETRYABLE_STATUS_CODES.has(firstResponse.status)) {
        return firstResponse;
      }

      await firstResponse.body?.cancel();
      const delayMs = retryBaseDelayMs + randomIntImpl(0, 100);
      logger.warn('SVA Mainserver upstream returned transient status, retrying once', {
        ...buildLogContext(input, {
          operation: operationName,
          hop,
          http_status: firstResponse.status,
          retry_delay_ms: delayMs,
        }),
      });
      await sleep(delayMs);
      return executeRequest();
    } catch (error) {
      if (!shouldRetryError(error)) {
        throw error;
      }

      const delayMs = retryBaseDelayMs + randomIntImpl(0, 100);
      logger.warn('SVA Mainserver upstream request failed transiently, retrying once', {
        ...buildLogContext(input, {
          operation: operationName,
          hop,
          retry_delay_ms: delayMs,
          error_message: error instanceof Error ? error.message : String(error),
        }),
      });
      await sleep(delayMs);
      return executeRequest();
    }
  };

  const loadCredentials = async (input: SvaMainserverConnectionInput): Promise<CredentialValue> => {
    const cacheKey = input.keycloakSubject;
    const nowMs = now();
    const cached = readCacheValue(credentialCache, cacheKey, nowMs, credentialCacheMaxSize);
    if (cached) {
      logger.debug('SVA Mainserver credential cache hit', {
        ...buildLogContext(input, {
          operation: 'load_credentials',
          cache: 'hit',
        }),
      });
      return cached;
    }

    logger.debug('SVA Mainserver credential cache miss', {
      ...buildLogContext(input, {
        operation: 'load_credentials',
        cache: 'miss',
      }),
    });

    const inflight = credentialLoads.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const loadPromise = withObservedHop(
      {
        hop: 'keycloak',
        operationName: 'load_credentials',
        connection: input,
      },
      async () => {
        let credentials: CredentialValue | null;
        try {
          credentials = await readCredentials({
            instanceId: input.instanceId,
            keycloakSubject: input.keycloakSubject,
          });
        } catch (error) {
          const normalizedError =
            error instanceof SvaMainserverError
              ? error
              : toSvaMainserverError({
                  code: 'identity_provider_unavailable',
                  message: 'Identity-Provider für Mainserver-Credentials ist nicht verfügbar.',
                  statusCode: 503,
                });

          logger.warn('SVA Mainserver identity provider is unavailable', {
            ...buildLogContext(input, {
              operation: 'load_credentials',
              error_code: normalizedError.code,
            }),
          });
          throw normalizedError;
        }

        if (!credentials) {
          logger.warn('SVA Mainserver credentials are missing in Keycloak attributes', {
            ...buildLogContext(input, {
              operation: 'load_credentials',
              error_code: 'missing_credentials',
            }),
          });
          throw toSvaMainserverError({
            code: 'missing_credentials',
            message: 'API-Key oder API-Secret für den SVA-Mainserver fehlen.',
            statusCode: 400,
          });
        }

        const value = credentials;
        const cacheWriteNowMs = now();
        writeCacheValue(
          credentialCache,
          cacheKey,
          value,
          cacheWriteNowMs + credentialCacheTtlMs,
          cacheWriteNowMs,
          credentialCacheMaxSize
        );
        logger.info('SVA Mainserver credentials loaded', {
          ...buildLogContext(input, {
            operation: 'load_credentials',
            cache: 'store',
          }),
        });
        return value;
      }
    );

    credentialLoads.set(cacheKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      credentialLoads.delete(cacheKey);
    }
  };

  const loadAccessToken = async (
    input: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<string> => {
    const credentials = await loadCredentials(input);
    const tokenCacheKey =
      `${input.instanceId}:${input.keycloakSubject}:${credentials.apiKey}:` +
      `${config.oauthTokenUrl}:${config.graphqlBaseUrl}`;
    const nowMs = now();
    const cached = readCacheValue(tokenCache, tokenCacheKey, nowMs, tokenCacheMaxSize);
    const cacheEntry = tokenCache.get(tokenCacheKey);
    if (cached && cacheEntry && cacheEntry.expiresAtMs > nowMs + tokenSkewMs) {
      logger.debug('SVA Mainserver token cache hit', {
        ...buildLogContext(input, {
          operation: 'load_access_token',
          cache: 'hit',
        }),
      });
      return cached;
    }

    logger.debug('SVA Mainserver token cache miss', {
      ...buildLogContext(input, {
        operation: 'load_access_token',
        cache: 'miss',
      }),
    });

    const inflight = tokenLoads.get(tokenCacheKey);
    if (inflight) {
      return inflight;
    }

    const loadPromise = withObservedHop(
      {
        hop: 'oauth2',
        operationName: 'load_access_token',
        connection: input,
      },
      async () => {
        const body = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: credentials.apiKey,
          client_secret: credentials.apiSecret,
        });

        let response: Response;
        try {
          response = await fetchWithRetry({
            url: config.oauthTokenUrl,
            input,
            operationName: 'load_access_token',
            hop: 'oauth2',
            init: {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                ...buildForwardHeaders(),
              },
              body,
            },
          });
        } catch (error) {
          logger.warn('SVA Mainserver token request failed', {
            ...buildLogContext(input, {
              operation: 'load_access_token',
              error_code: 'network_error',
              error_message: error instanceof Error ? error.message : String(error),
            }),
          });
          throw toSvaMainserverError({
            code: 'network_error',
            message: resolveNetworkErrorMessage({
              error,
              timeoutMessage: 'Zeitüberschreitung beim Tokenabruf vom SVA-Mainserver.',
              defaultMessage: 'Netzwerkfehler beim Tokenabruf.',
            }),
            statusCode: 503,
          });
        }

        if (!response.ok) {
          const errorCode = resolveTokenStatusErrorCode(response.status);
          logger.warn('SVA Mainserver token request returned an error status', {
            ...buildLogContext(input, {
              operation: 'load_access_token',
              error_code: errorCode,
              http_status: response.status,
            }),
          });
          throw toSvaMainserverError({
            code: errorCode,
            message: `Tokenabruf fehlgeschlagen (${response.status}).`,
            statusCode: response.status,
          });
        }

        const payloadResult = tokenResponseSchema.safeParse(await parseJsonBody(response));
        if (!payloadResult.success) {
          logger.warn('SVA Mainserver token response failed schema validation', {
            ...buildLogContext(input, {
              operation: 'load_access_token',
              error_code: 'invalid_response',
            }),
          });
          throw toSvaMainserverError({
            code: 'invalid_response',
            message: 'Ungültige Token-Antwort des SVA-Mainservers.',
            statusCode: 502,
          });
        }

        const cacheWriteNowMs = now();
        const expiresAtMs = cacheWriteNowMs + payloadResult.data.expires_in * 1000;
        writeCacheValue(
          tokenCache,
          tokenCacheKey,
          payloadResult.data.access_token,
          expiresAtMs,
          cacheWriteNowMs,
          tokenCacheMaxSize
        );
        logger.info('SVA Mainserver access token loaded', {
          ...buildLogContext(input, {
            operation: 'load_access_token',
            cache: 'store',
            expires_at_ms: expiresAtMs,
          }),
        });
        return payloadResult.data.access_token;
      }
    );

    tokenLoads.set(tokenCacheKey, loadPromise);
    try {
      return await loadPromise;
    } finally {
      tokenLoads.delete(tokenCacheKey);
    }
  };

  const executeGraphqlWithConfig = async <TResult>(
    input: SvaMainserverConnectionInput & {
      readonly document: string;
      readonly operationName: string;
      readonly variables?: Record<string, unknown>;
    },
    config: SvaMainserverInstanceConfig
  ): Promise<TResult> => {
    const accessToken = await loadAccessToken(input, config);

    return withObservedHop(
      {
        hop: 'graphql',
        operationName: input.operationName,
        connection: input,
      },
      async () => {
        let response: Response;
        try {
          response = await fetchWithRetry({
            url: config.graphqlBaseUrl,
            input,
            operationName: input.operationName,
            hop: 'graphql',
            init: {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                ...buildForwardHeaders(),
              },
              body: JSON.stringify({
                operationName: input.operationName,
                query: input.document,
                ...(input.variables ? { variables: input.variables } : {}),
              }),
            },
          });
        } catch (error) {
          logger.warn('SVA Mainserver GraphQL request failed', {
            ...buildLogContext(input, {
              operation: input.operationName,
              error_code: 'network_error',
              error_message: error instanceof Error ? error.message : String(error),
            }),
          });
          throw toSvaMainserverError({
            code: 'network_error',
            message: resolveNetworkErrorMessage({
              error,
              timeoutMessage: 'Zeitüberschreitung beim GraphQL-Aufruf des SVA-Mainservers.',
              defaultMessage: 'Netzwerkfehler beim GraphQL-Aufruf.',
            }),
            statusCode: 503,
          });
        }

        if (!response.ok) {
          const errorCode = resolveGraphqlStatusErrorCode(response.status);
          logger.warn('SVA Mainserver GraphQL request returned an error status', {
            ...buildLogContext(input, {
              operation: input.operationName,
              error_code: errorCode,
              http_status: response.status,
            }),
          });
          throw toSvaMainserverError({
            code: errorCode,
            message: `GraphQL-Aufruf fehlgeschlagen (${response.status}).`,
            statusCode: response.status,
          });
        }

        let payload: TResult;
        try {
          payload = parseGraphqlPayload<TResult>(await parseJsonBody(response));
        } catch (error) {
          const normalizedError = normalizeUnexpectedError(error);
          logger.warn('SVA Mainserver GraphQL response validation failed', {
            ...buildLogContext(input, {
              operation: input.operationName,
              error_code: normalizedError.code,
            }),
          });
          throw normalizedError;
        }

        logger.info('SVA Mainserver GraphQL operation succeeded', {
          ...buildLogContext(input, {
            operation: input.operationName,
          }),
        });
        return payload;
      }
    );
  };

  const getQueryRootTypenameWithConfig = async (
    input: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverQueryRootTypenameQuery> =>
    executeGraphqlWithConfig<SvaMainserverQueryRootTypenameQuery>(
      {
        ...input,
        document: svaMainserverQueryRootTypenameDocument,
        operationName: 'SvaMainserverQueryRootTypename',
      },
      config
    );

  const getMutationRootTypenameWithConfig = async (
    input: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverMutationRootTypenameMutation> =>
    executeGraphqlWithConfig<SvaMainserverMutationRootTypenameMutation>(
      {
        ...input,
        document: svaMainserverMutationRootTypenameDocument,
        operationName: 'SvaMainserverMutationRootTypename',
      },
      config
    );

  const listVisibleRecordsWithConfig = async <TQueryResult, TUpstreamItem, TItem>(
    input: SvaMainserverListInput,
    config: SvaMainserverInstanceConfig,
    options: {
      readonly document: string;
      readonly operationName: string;
      readonly order: string;
      readonly readItems: (response: TQueryResult) => readonly TUpstreamItem[];
      readonly isVisible: (item: TUpstreamItem) => boolean;
      readonly mapItem: (item: TUpstreamItem) => TItem;
    }
  ): Promise<SvaMainserverListResult<TItem>> => {
    const normalizedInput = normalizeListInput(input);
    const startIndex = (normalizedInput.page - 1) * normalizedInput.pageSize;
    const targetVisibleCount = normalizedInput.pageSize + 1;
    const batchSize = Math.min(MAX_MAINSERVER_PAGE_SIZE, normalizedInput.pageSize + 1);
    const collectedVisibleItems: TItem[] = [];
    let visibleIndex = 0;
    let skip = 0;
    let exhausted = false;
    let hasNextPage = false;

    while (collectedVisibleItems.length < targetVisibleCount && exhausted === false && hasNextPage === false) {
      if (skip > MAX_MAINSERVER_UPSTREAM_SCAN_RECORDS) {
        throw toSvaMainserverError({
          code: 'invalid_response',
          message: 'Mainserver-Pagination erfordert zu viele Upstream-Datensätze für sichtbare Ergebnisse.',
          statusCode: 502,
        });
      }

      const response = await executeGraphqlWithConfig<TQueryResult>(
        {
          ...normalizedInput,
          document: options.document,
          operationName: options.operationName,
          variables: { limit: batchSize, skip, order: options.order },
        },
        config
      );

      const upstreamItems = options.readItems(response);
      exhausted = upstreamItems.length < batchSize;
      skip += upstreamItems.length;

      for (const item of upstreamItems) {
        if (options.isVisible(item) === false) {
          continue;
        }

        if (visibleIndex >= startIndex) {
          collectedVisibleItems.push(options.mapItem(item));
          if (collectedVisibleItems.length >= targetVisibleCount) {
            hasNextPage = true;
            break;
          }
        }

        visibleIndex += 1;
        if (visibleIndex >= startIndex + targetVisibleCount) {
          hasNextPage = true;
          break;
        }
      }

      if (upstreamItems.length === 0) {
        break;
      }
    }

    return toListResult(
      normalizedInput,
      collectedVisibleItems.slice(0, normalizedInput.pageSize),
      hasNextPage
    );
  };

  const listNewsWithConfig = async (
    input: SvaMainserverListInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverListResult<SvaMainserverNewsItem>> =>
    listVisibleRecordsWithConfig<SvaMainserverNewsListQuery, SvaMainserverNewsItemFragment, SvaMainserverNewsItem>(
      input,
      config,
      {
        document: svaMainserverNewsListDocument,
        operationName: 'SvaMainserverNewsList',
        order: 'publishedAt_DESC',
        readItems: (response) => response.newsItems ?? [],
        isVisible: (item) => item.visible !== false,
        mapItem: mapNewsItem,
      }
    );

  const getNewsWithConfig = async (
    input: SvaMainserverConnectionInput & { readonly newsId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverNewsItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverNewsDetailQuery>(
      {
        ...input,
        document: svaMainserverNewsDetailDocument,
        operationName: 'SvaMainserverNewsDetail',
        variables: { id: input.newsId },
      },
      config
    );

    return mapOptionalNewsItem(response.newsItem);
  };

  const writeNewsWithConfig = async (
    input: SvaMainserverConnectionInput & {
      readonly news: SvaMainserverNewsInput;
      readonly newsId?: string;
      readonly forceCreate?: boolean;
    },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverNewsItem> => {
    assertPublishedAt(input.news.publishedAt);
    const response = await executeGraphqlWithConfig<SvaMainserverCreateNewsMutation>(
      {
        ...input,
        document: svaMainserverCreateNewsDocument,
        operationName: 'SvaMainserverCreateNews',
        variables: {
          ...(input.newsId ? { id: input.newsId } : {}),
          ...(input.forceCreate === undefined ? {} : { forceCreate: input.forceCreate }),
          title: input.news.title,
          ...(input.newsId ? {} : { pushNotification: input.news.pushNotification ?? false }),
          ...(input.news.author ? { author: input.news.author } : {}),
          ...(input.news.keywords ? { keywords: input.news.keywords } : {}),
          ...(input.news.externalId ? { externalId: input.news.externalId } : {}),
          ...(input.news.fullVersion === undefined ? {} : { fullVersion: input.news.fullVersion }),
          ...(input.news.charactersToBeShown === undefined
            ? {}
            : { charactersToBeShown: input.news.charactersToBeShown }),
          ...(input.news.newsType ? { newsType: input.news.newsType } : {}),
          publishedAt: input.news.publishedAt,
          publicationDate: input.news.publicationDate ?? input.news.publishedAt,
          ...(input.news.showPublishDate === undefined ? {} : { showPublishDate: input.news.showPublishDate }),
          ...(input.news.categoryName ? { categoryName: input.news.categoryName } : {}),
          ...(input.news.categories ? { categories: input.news.categories } : {}),
          ...(input.news.sourceUrl ? { sourceUrl: input.news.sourceUrl } : {}),
          ...(input.news.address ? { address: input.news.address } : {}),
          ...(input.news.contentBlocks ? { contentBlocks: input.news.contentBlocks } : {}),
          ...(input.news.pointOfInterestId ? { pointOfInterestId: input.news.pointOfInterestId } : {}),
        },
      },
      config
    );

    return mapOptionalNewsItem(response.createNewsItem);
  };

  const destroyNewsWithConfig = async (
    input: SvaMainserverConnectionInput & { readonly newsId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<{ readonly id: string }> => {
    const response = await executeGraphqlWithConfig<SvaMainserverDestroyNewsMutation>(
      {
        ...input,
        document: svaMainserverDestroyNewsDocument,
        operationName: 'SvaMainserverDestroyNews',
        variables: { id: input.newsId, recordType: 'NewsItem' },
      },
      config
    );

    if (!response.destroyRecord || (response.destroyRecord.statusCode ?? 200) >= 400) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte den News-Eintrag nicht löschen.',
        statusCode: 502,
      });
    }

    return { id: input.newsId };
  };

  const listEventsWithConfig = async (
    input: SvaMainserverListInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverListResult<SvaMainserverEventItem>> =>
    listVisibleRecordsWithConfig<SvaMainserverEventListQuery, SvaMainserverEventFragment, SvaMainserverEventItem>(
      input,
      config,
      {
        document: svaMainserverEventListDocument,
        operationName: 'SvaMainserverEventList',
        order: 'updatedAt_DESC',
        readItems: (response) => response.eventRecords ?? [],
        isVisible: (item) => item.visible !== false,
        mapItem: mapEventItem,
      }
    );

  const getEventWithConfig = async (
    input: SvaMainserverConnectionInput & { readonly eventId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverEventItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverEventDetailQuery>(
      {
        ...input,
        document: svaMainserverEventDetailDocument,
        operationName: 'SvaMainserverEventDetail',
        variables: { id: input.eventId },
      },
      config
    );

    return mapOptionalEventItem(response.eventRecord);
  };

  const writeEventWithConfig = async (
    input: SvaMainserverConnectionInput & {
      readonly event: SvaMainserverEventInput;
      readonly eventId?: string;
      readonly forceCreate?: boolean;
    },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverEventItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverCreateEventMutation>(
      {
        ...input,
        document: svaMainserverCreateEventDocument,
        operationName: 'SvaMainserverCreateEvent',
        variables: {
          ...(input.eventId ? { id: input.eventId } : {}),
          ...(input.forceCreate === undefined ? {} : { forceCreate: input.forceCreate }),
          title: input.event.title,
          ...(input.eventId ? {} : { pushNotification: input.event.pushNotification ?? false }),
          ...(input.event.parentId === undefined ? {} : { parentId: input.event.parentId }),
          ...(input.event.keywords ? { keywords: input.event.keywords } : {}),
          ...(input.event.description ? { description: input.event.description } : {}),
          ...(input.event.externalId ? { externalId: input.event.externalId } : {}),
          ...(input.event.dates ? { dates: input.event.dates } : {}),
          ...(input.event.repeat === undefined ? {} : { repeat: input.event.repeat }),
          ...(input.event.repeatDuration ? { repeatDuration: input.event.repeatDuration } : {}),
          ...(input.event.categoryName ? { categoryName: input.event.categoryName } : {}),
          ...(input.event.categories ? { categories: input.event.categories } : {}),
          ...(input.event.addresses ? { addresses: input.event.addresses } : {}),
          ...(input.event.location ? { location: input.event.location } : {}),
          ...(input.event.contacts ? { contacts: input.event.contacts } : {}),
          ...(input.event.urls ? { urls: input.event.urls } : {}),
          ...(input.event.mediaContents ? { mediaContents: input.event.mediaContents } : {}),
          ...(input.event.organizer ? { organizer: input.event.organizer } : {}),
          ...(input.event.priceInformations ? { priceInformations: input.event.priceInformations } : {}),
          ...(input.event.accessibilityInformation
            ? { accessibilityInformation: input.event.accessibilityInformation }
            : {}),
          ...(input.event.tags ? { tags: input.event.tags } : {}),
          ...(input.event.recurring ? { recurring: input.event.recurring } : {}),
          ...(input.event.recurringWeekdays ? { recurringWeekdays: input.event.recurringWeekdays } : {}),
          ...(input.event.recurringType ? { recurringType: input.event.recurringType } : {}),
          ...(input.event.recurringInterval ? { recurringInterval: input.event.recurringInterval } : {}),
          ...(input.event.pointOfInterestId ? { pointOfInterestId: input.event.pointOfInterestId } : {}),
        },
      },
      config
    );

    return mapOptionalEventItem(response.createEventRecord);
  };

  const destroyRecordWithConfig = async (
    input: SvaMainserverConnectionInput & { readonly recordId: string; readonly recordType: string; readonly label: string },
    config: SvaMainserverInstanceConfig
  ): Promise<{ readonly id: string }> => {
    const response = await executeGraphqlWithConfig<SvaMainserverDestroyRecordMutation>(
      {
        ...input,
        document: svaMainserverDestroyRecordDocument,
        operationName: 'SvaMainserverDestroyRecord',
        variables: { id: input.recordId, recordType: input.recordType },
      },
      config
    );

    if (!response.destroyRecord || (response.destroyRecord.statusCode ?? 200) >= 400) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: `SVA-Mainserver konnte ${input.label} nicht löschen.`,
        statusCode: 502,
      });
    }

    return { id: input.recordId };
  };

  const listPoiWithConfig = async (
    input: SvaMainserverListInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverListResult<SvaMainserverPoiItem>> =>
    listVisibleRecordsWithConfig<SvaMainserverPoiListQuery, SvaMainserverPoiFragment, SvaMainserverPoiItem>(
      input,
      config,
      {
        document: svaMainserverPoiListDocument,
        operationName: 'SvaMainserverPoiList',
        order: 'updatedAt_DESC',
        readItems: (response) => response.pointsOfInterest ?? [],
        isVisible: (item) => item.visible !== false,
        mapItem: mapPoiItem,
      }
    );

  const getPoiWithConfig = async (
    input: SvaMainserverConnectionInput & { readonly poiId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverPoiItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverPoiDetailQuery>(
      {
        ...input,
        document: svaMainserverPoiDetailDocument,
        operationName: 'SvaMainserverPoiDetail',
        variables: { id: input.poiId },
      },
      config
    );

    return mapOptionalPoiItem(response.pointOfInterest);
  };

  const writePoiWithConfig = async (
    input: SvaMainserverConnectionInput & {
      readonly poi: SvaMainserverPoiInput;
      readonly poiId?: string;
      readonly forceCreate?: boolean;
    },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverPoiItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverCreatePoiMutation>(
      {
        ...input,
        document: svaMainserverCreatePoiDocument,
        operationName: 'SvaMainserverCreatePoi',
        variables: {
          ...(input.poiId ? { id: input.poiId } : {}),
          ...(input.forceCreate === undefined ? {} : { forceCreate: input.forceCreate }),
          name: input.poi.name,
          ...(input.poi.externalId ? { externalId: input.poi.externalId } : {}),
          ...(input.poi.description ? { description: input.poi.description } : {}),
          ...(input.poi.keywords ? { keywords: input.poi.keywords } : {}),
          ...(input.poi.mobileDescription ? { mobileDescription: input.poi.mobileDescription } : {}),
          ...(input.poi.active === undefined ? {} : { active: input.poi.active }),
          ...(input.poi.categoryName ? { categoryName: input.poi.categoryName } : {}),
          ...(input.poi.payload === undefined ? {} : { payload: input.poi.payload }),
          ...(input.poi.categories ? { categories: input.poi.categories } : {}),
          ...(input.poi.addresses ? { addresses: input.poi.addresses } : {}),
          ...(input.poi.contact ? { contact: input.poi.contact } : {}),
          ...(input.poi.priceInformations ? { priceInformations: input.poi.priceInformations } : {}),
          ...(input.poi.openingHours ? { openingHours: input.poi.openingHours } : {}),
          ...(input.poi.operatingCompany ? { operatingCompany: input.poi.operatingCompany } : {}),
          ...(input.poi.webUrls ? { webUrls: input.poi.webUrls } : {}),
          ...(input.poi.mediaContents ? { mediaContents: input.poi.mediaContents } : {}),
          ...(input.poi.location ? { location: input.poi.location } : {}),
          ...(input.poi.certificates ? { certificates: input.poi.certificates } : {}),
          ...(input.poi.accessibilityInformation
            ? { accessibilityInformation: input.poi.accessibilityInformation }
            : {}),
          ...(input.poi.tags ? { tags: input.poi.tags } : {}),
        },
      },
      config
    );

    return mapOptionalPoiItem(response.createPointOfInterest);
  };

  const getQueryRootTypename = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverQueryRootTypenameQuery> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return getQueryRootTypenameWithConfig(input, config);
  };

  const getMutationRootTypename = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverMutationRootTypenameMutation> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return getMutationRootTypenameWithConfig(input, config);
  };

  const listNews = async (input: SvaMainserverListInput): Promise<SvaMainserverListResult<SvaMainserverNewsItem>> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return listNewsWithConfig(input, config);
  };

  const getNews = async (
    input: SvaMainserverConnectionInput & { readonly newsId: string }
  ): Promise<SvaMainserverNewsItem> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return getNewsWithConfig(input, config);
  };

  const createNews = async (
    input: SvaMainserverConnectionInput & { readonly news: SvaMainserverNewsInput }
  ): Promise<SvaMainserverNewsItem> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return writeNewsWithConfig(input, config);
  };

  const updateNews = async (
    input: SvaMainserverConnectionInput & { readonly newsId: string; readonly news: SvaMainserverNewsInput }
  ): Promise<SvaMainserverNewsItem> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return writeNewsWithConfig({ ...input, forceCreate: false }, config);
  };

  const deleteNews = async (
    input: SvaMainserverConnectionInput & { readonly newsId: string }
  ): Promise<{ readonly id: string }> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return destroyNewsWithConfig(input, config);
  };

  const listEvents = async (
    input: SvaMainserverListInput
  ): Promise<SvaMainserverListResult<SvaMainserverEventItem>> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return listEventsWithConfig(input, config);
  };

  const getEvent = async (
    input: SvaMainserverConnectionInput & { readonly eventId: string }
  ): Promise<SvaMainserverEventItem> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return getEventWithConfig(input, config);
  };

  const createEvent = async (
    input: SvaMainserverConnectionInput & { readonly event: SvaMainserverEventInput }
  ): Promise<SvaMainserverEventItem> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return writeEventWithConfig(input, config);
  };

  const updateEvent = async (
    input: SvaMainserverConnectionInput & { readonly eventId: string; readonly event: SvaMainserverEventInput }
  ): Promise<SvaMainserverEventItem> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return writeEventWithConfig({ ...input, forceCreate: false }, config);
  };

  const deleteEvent = async (
    input: SvaMainserverConnectionInput & { readonly eventId: string }
  ): Promise<{ readonly id: string }> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return destroyRecordWithConfig(
      { ...input, recordId: input.eventId, recordType: 'EventRecord', label: 'das Event' },
      config
    );
  };

  const listPoi = async (input: SvaMainserverListInput): Promise<SvaMainserverListResult<SvaMainserverPoiItem>> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return listPoiWithConfig(input, config);
  };

  const getPoi = async (
    input: SvaMainserverConnectionInput & { readonly poiId: string }
  ): Promise<SvaMainserverPoiItem> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return getPoiWithConfig(input, config);
  };

  const createPoi = async (
    input: SvaMainserverConnectionInput & { readonly poi: SvaMainserverPoiInput }
  ): Promise<SvaMainserverPoiItem> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return writePoiWithConfig(input, config);
  };

  const updatePoi = async (
    input: SvaMainserverConnectionInput & { readonly poiId: string; readonly poi: SvaMainserverPoiInput }
  ): Promise<SvaMainserverPoiItem> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return writePoiWithConfig({ ...input, forceCreate: false }, config);
  };

  const deletePoi = async (
    input: SvaMainserverConnectionInput & { readonly poiId: string }
  ): Promise<{ readonly id: string }> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    return destroyRecordWithConfig(
      { ...input, recordId: input.poiId, recordType: 'PointOfInterest', label: 'den POI' },
      config
    );
  };

  const getConnectionStatus = async (
    input: SvaMainserverConnectionInput
  ): Promise<SvaMainserverConnectionStatus> => {
    try {
      const config = await loadValidatedInstanceConfig(input, 'connection_check');
      const [queryRootResult, mutationRootResult] = await Promise.allSettled([
        getQueryRootTypenameWithConfig(input, config),
        getMutationRootTypenameWithConfig(input, config),
      ]);
      const queryRoot = unwrapSettledResult(queryRootResult);
      const mutationRoot = unwrapSettledResult(mutationRootResult);

      if (!queryRoot.ok) {
        throw queryRoot.error;
      }
      if (!mutationRoot.ok) {
        throw mutationRoot.error;
      }

      logger.info('SVA Mainserver connection check succeeded', {
        ...buildLogContext(input, {
          operation: 'connection_check',
        }),
      });

      return {
        status: 'connected',
        checkedAt: new Date(now()).toISOString(),
        config,
        queryRootTypename: queryRoot.value.__typename,
        mutationRootTypename: mutationRoot.value.__typename,
      };
    } catch (error) {
      const normalizedError = normalizeUnexpectedError(error);

      logger.warn('SVA Mainserver connection check failed', {
        ...buildLogContext(input, {
          operation: 'connection_check',
          error_code: normalizedError.code,
          error_message: normalizedError.message,
        }),
      });

      return {
        status: 'error',
        checkedAt: new Date(now()).toISOString(),
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
      };
    }
  };

  return {
    createEvent,
    createNews,
    createPoi,
    deleteEvent,
    deleteNews,
    deletePoi,
    getConnectionStatus,
    getEvent,
    getMutationRootTypename,
    getNews,
    getPoi,
    getQueryRootTypename,
    listEvents,
    listNews,
    listPoi,
    updateEvent,
    updateNews,
    updatePoi,
  };
};

let defaultService: ReturnType<typeof createSvaMainserverService> | null = null;

const getDefaultService = () => {
  defaultService ??= createSvaMainserverService();
  return defaultService;
};

export const resetSvaMainserverServiceState = (): void => {
  defaultService = null;
};

export const getSvaMainserverConnectionStatus = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getConnectionStatus(input);

export const getSvaMainserverQueryRootTypename = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getQueryRootTypename(input);

export const getSvaMainserverMutationRootTypename = (input: SvaMainserverConnectionInput) =>
  getDefaultService().getMutationRootTypename(input);

export const listSvaMainserverNews = (input: SvaMainserverConnectionInput & SvaMainserverListQuery) =>
  getDefaultService().listNews(input);

export const getSvaMainserverNews = (input: SvaMainserverConnectionInput & { readonly newsId: string }) =>
  getDefaultService().getNews(input);

export const createSvaMainserverNews = (
  input: SvaMainserverConnectionInput & { readonly news: SvaMainserverNewsInput }
) => getDefaultService().createNews(input);

export const updateSvaMainserverNews = (
  input: SvaMainserverConnectionInput & { readonly newsId: string; readonly news: SvaMainserverNewsInput }
) => getDefaultService().updateNews(input);

export const deleteSvaMainserverNews = (input: SvaMainserverConnectionInput & { readonly newsId: string }) =>
  getDefaultService().deleteNews(input);

export const listSvaMainserverEvents = (input: SvaMainserverConnectionInput & SvaMainserverListQuery) =>
  getDefaultService().listEvents(input);

export const getSvaMainserverEvent = (input: SvaMainserverConnectionInput & { readonly eventId: string }) =>
  getDefaultService().getEvent(input);

export const createSvaMainserverEvent = (
  input: SvaMainserverConnectionInput & { readonly event: SvaMainserverEventInput }
) => getDefaultService().createEvent(input);

export const updateSvaMainserverEvent = (
  input: SvaMainserverConnectionInput & { readonly eventId: string; readonly event: SvaMainserverEventInput }
) => getDefaultService().updateEvent(input);

export const deleteSvaMainserverEvent = (input: SvaMainserverConnectionInput & { readonly eventId: string }) =>
  getDefaultService().deleteEvent(input);

export const listSvaMainserverPoi = (input: SvaMainserverConnectionInput & SvaMainserverListQuery) =>
  getDefaultService().listPoi(input);

export const getSvaMainserverPoi = (input: SvaMainserverConnectionInput & { readonly poiId: string }) =>
  getDefaultService().getPoi(input);

export const createSvaMainserverPoi = (
  input: SvaMainserverConnectionInput & { readonly poi: SvaMainserverPoiInput }
) => getDefaultService().createPoi(input);

export const updateSvaMainserverPoi = (
  input: SvaMainserverConnectionInput & { readonly poiId: string; readonly poi: SvaMainserverPoiInput }
) => getDefaultService().updatePoi(input);

export const deleteSvaMainserverPoi = (input: SvaMainserverConnectionInput & { readonly poiId: string }) =>
  getDefaultService().deletePoi(input);
