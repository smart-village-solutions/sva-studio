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
import type {
  SvaMainserverConnectionInput,
  SvaMainserverConnectionStatus,
  SvaMainserverErrorCode,
  SvaMainserverInstanceConfig,
  SvaMainserverAddress,
  SvaMainserverAnnouncementSummary,
  SvaMainserverCategory,
  SvaMainserverContentBlock,
  SvaMainserverDataProvider,
  SvaMainserverMediaContent,
  SvaMainserverNewsInput,
  SvaMainserverNewsItem,
  SvaMainserverNewsPayload,
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

  const listNewsWithConfig = async (
    input: SvaMainserverConnectionInput,
    config: SvaMainserverInstanceConfig
  ): Promise<readonly SvaMainserverNewsItem[]> => {
    const response = await executeGraphqlWithConfig<SvaMainserverNewsListQuery>(
      {
        ...input,
        document: svaMainserverNewsListDocument,
        operationName: 'SvaMainserverNewsList',
        variables: { limit: 100, skip: 0, order: 'publishedAt_DESC' },
      },
      config
    );

    return (response.newsItems ?? []).filter((item) => item.visible !== false).map(mapNewsItem);
  };

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

  const listNews = async (input: SvaMainserverConnectionInput): Promise<readonly SvaMainserverNewsItem[]> => {
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
    createNews,
    deleteNews,
    getConnectionStatus,
    getMutationRootTypename,
    getNews,
    getQueryRootTypename,
    listNews,
    updateNews,
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

export const listSvaMainserverNews = (input: SvaMainserverConnectionInput) => getDefaultService().listNews(input);

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
