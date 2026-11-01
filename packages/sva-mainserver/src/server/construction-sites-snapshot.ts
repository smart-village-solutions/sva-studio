import { z } from 'zod';
import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';
import type {
  ConstructionSiteInput,
  ConstructionSiteRecord,
} from './construction-sites-contract.js';
import { constructionSiteWriteFields } from '../generated/construction-sites.js';
import {
  raw,
  records,
  voucherSnapshotHash as hash,
  voucherWriteSnapshot as snapshot,
  type RawRecord,
  type WriteShape,
} from './vouchers-snapshot.js';
import { mapGenericItemDetail } from './service-internals/generic-item-mappers.js';
import type { SvaMainserverGenericItemFragment } from '../generated/generic-items.js';

const string = (value: unknown) => (typeof value === 'string' ? value : '');
const list = (value: unknown): RawRecord[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is RawRecord =>
          item !== null && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
const object = (value: unknown): RawRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as RawRecord) : {};
const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};
const payloadOf = (value: RawRecord) => (value.payload == null ? {} : raw(value.payload));
function assertSnapshotTypes(value: unknown, shape: WriteShape): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item) => assertSnapshotTypes(item, shape));
    return;
  }
  const record = raw(value);
  for (const [key, field] of Object.entries(shape)) {
    const current = record[key];
    if (typeof field === 'object') {
      assertSnapshotTypes(current, field);
      continue;
    }
    if (current == null) continue;
    if (key === 'payload') {
      raw(current);
      continue;
    }
    const numeric = [
      'height',
      'width',
      'amount',
      'ageFrom',
      'ageTo',
      'minAdultCount',
      'maxAdultCount',
      'minChildrenCount',
      'maxChildrenCount',
      'sortNumber',
      'latitude',
      'longitude',
    ].includes(key);
    const boolean = ['open', 'useYear', 'groupPrice'].includes(key);
    const valid = numeric
      ? number(current) !== null
      : boolean
        ? typeof current === 'boolean'
        : key === 'useOnlyTimeDescription'
          ? ['true', 'false', true, false].includes(current as string | boolean)
          : typeof current === 'string';
    if (!valid) throw new Error('construction_site_incomplete');
  }
}
export function constructionSiteFingerprint(value: RawRecord): string {
  return hash(value);
}

function assertNoConstructionSiteDependents(value: RawRecord): void {
  if (
    !('ancestry' in value) ||
    !('memberId' in value) ||
    value.ancestry ||
    value.memberId ||
    value.pointOfInterest ||
    value.quota ||
    value.discountType
  )
    throw new Error('construction_site_dependents_unsupported');
  for (const key of ['genericItems', 'genericItemMessages', 'pushNotifications'])
    if (records(value[key]).length) throw new Error('construction_site_dependents_unsupported');
}

export function assertConstructionSiteWritable(value: RawRecord): void {
  if (value.genericType !== 'ConstructionSite') throw new Error('construction_site_not_found');
  snapshot(value, constructionSiteWriteFields);
  assertSnapshotTypes(value, constructionSiteWriteFields);
  for (const [key, field] of Object.entries(constructionSiteWriteFields))
    if (typeof field === 'object' && !Array.isArray(value[key]))
      throw new Error('construction_site_incomplete');
  assertNoConstructionSiteDependents(value);
  const detail = mapGenericItemDetail(value as SvaMainserverGenericItemFragment);
  if (detail.deviations.length) throw new Error('construction_site_incomplete');
  const payload = payloadOf(value);
  if (
    ['cause', 'direction'].some((key) => payload[key] != null && typeof payload[key] !== 'string')
  )
    throw new Error('construction_site_incomplete');
  if (
    payload.restrictions != null &&
    !z.array(z.object({ description: z.string() }).passthrough()).safeParse(payload.restrictions)
      .success
  )
    throw new Error('construction_site_incomplete');
}

export function constructionSiteRead(value: RawRecord): ConstructionSiteRecord {
  const identity = z
    .object({
      id: z.string().min(1),
      genericType: z.literal('ConstructionSite'),
      title: z.string().nullish(),
      visible: z.boolean(),
      dataProvider: z.object({ id: z.string().min(1), name: z.string().nullish() }),
    })
    .parse(value);
  const payload = object(value.payload);
  let writeBlockedReason: string | undefined;
  try {
    assertConstructionSiteWritable(value);
  } catch (error) {
    writeBlockedReason =
      error instanceof Error && error.message === 'construction_site_dependents_unsupported'
        ? error.message
        : 'construction_site_incomplete';
  }
  const dates = list(value.dates).map((date, sourceIndex) => ({
    sourceIndex,
    dateStart: string(date.dateStart),
    dateEnd: string(date.dateEnd),
  }));
  return {
    id: identity.id,
    genericType: identity.genericType,
    title: identity.title ?? '',
    visible: identity.visible,
    updatedAt: string(value.updatedAt),
    contentFingerprint: constructionSiteFingerprint(value),
    writeBlockedReason,
    dataProvider: {
      id: identity.dataProvider.id,
      ...(identity.dataProvider.name ? { name: identity.dataProvider.name } : {}),
    },
    input: {
      title: identity.title ?? '',
      visible: identity.visible,
      cause: string(payload.cause),
      direction: string(payload.direction),
      restrictions: list(payload.restrictions).map((item, sourceIndex) => ({
        sourceIndex,
        description: string(item.description),
      })),
      contentBlocks: list(value.contentBlocks).map((item, sourceIndex) => ({
        sourceIndex,
        body: string(item.body),
      })),
      dates: dates.length ? dates : [{ dateStart: '', dateEnd: '' }],
      locations: list(value.locations).map((item, sourceIndex) => ({
        sourceIndex,
        name: string(item.name),
        latitude: number(object(item.geoLocation).latitude),
        longitude: number(object(item.geoLocation).longitude),
      })),
      categories: list(value.categories).map((item) => ({ name: string(item.name) })),
      mediaContents: list(value.mediaContents).map((item, sourceIndex) => ({
        sourceIndex,
        contentType: string(
          item.contentType
        ) as ConstructionSiteInput['mediaContents'][number]['contentType'],
        hostMediaAssetId:
          typeof object(item.payload).studioMediaAssetId === 'string'
            ? (object(item.payload).studioMediaAssetId as string)
            : undefined,
        sourceUrl: {
          url: string(object(item.sourceUrl).url),
          description: string(object(item.sourceUrl).description),
        },
        captionText: string(item.captionText),
        copyright: string(item.copyright),
      })),
    },
  };
}

function original(values: unknown, index: number | undefined): RawRecord {
  if (index === undefined) return {};
  const items = records(values);
  if (!items[index]) throw new Error('construction_site_content_conflict');
  return items[index];
}
const indexed = (values: unknown, input: { sourceIndex?: number }) =>
  original(values, input.sourceIndex);

function buildConstructionSitePayload(
  input: ConstructionSiteInput,
  payload: RawRecord,
  before: ConstructionSiteInput | undefined
): RawRecord {
  return {
    ...payload,
    ...(input.direction === before?.direction ? {} : { direction: input.direction }),
    ...(input.cause === before?.cause ? {} : { cause: input.cause }),
    ...(before && hash(input.restrictions) === hash(before.restrictions)
      ? {}
      : {
          restrictions: input.restrictions
            .filter((item) => item.sourceIndex !== undefined || item.description.trim())
            .map((item) => ({
              ...original(payload.restrictions ?? [], item.sourceIndex),
              description: item.description,
            })),
        }),
  };
}

export function buildConstructionSiteWrite(
  input: ConstructionSiteInput,
  existing?: RawRecord
): RawRecord {
  if (existing) assertConstructionSiteWritable(existing);
  const base = existing ? raw(snapshot(existing, constructionSiteWriteFields)) : {};
  const payload = existing ? payloadOf(existing) : {};
  const before = existing ? constructionSiteRead(existing).input : undefined;
  const unchanged = (key: keyof ConstructionSiteInput) =>
    before && hash(input[key]) === hash(before[key]);
  return {
    ...base,
    title: input.title,
    genericType: 'ConstructionSite',
    visible: input.visible,
    payload: buildConstructionSitePayload(input, payload, before),
    categories: input.categories,
    contentBlocks: unchanged('contentBlocks')
      ? base.contentBlocks
      : input.contentBlocks.map((item) => {
          const previous = indexed(base.contentBlocks ?? [], item);
          return {
            ...previous,
            body: previous.body === item.body ? item.body : sanitizeRichTextHtml(item.body),
          };
        }),
    dates: unchanged('dates')
      ? base.dates
      : input.dates.map((item) => ({
          ...indexed(base.dates ?? [], item),
          dateStart: item.dateStart || null,
          dateEnd: item.dateEnd || null,
        })),
    locations: unchanged('locations')
      ? base.locations
      : input.locations.map((item) => ({
          ...indexed(base.locations ?? [], item),
          name: item.name,
          geoLocation:
            item.latitude === null ? null : { latitude: item.latitude, longitude: item.longitude },
        })),
    mediaContents: unchanged('mediaContents')
      ? base.mediaContents
      : input.mediaContents.map(({ sourceIndex, hostMediaAssetId, ...item }) => {
          const previous = original(base.mediaContents ?? [], sourceIndex);
          return {
            ...previous,
            ...item,
            sourceUrl: { ...object(previous.sourceUrl), ...item.sourceUrl },
            payload: { ...object(previous.payload), studioMediaAssetId: hostMediaAssetId ?? null },
          };
        }),
  };
}
