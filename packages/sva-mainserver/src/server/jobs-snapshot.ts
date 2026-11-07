import { z } from 'zod';
import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';
import { jobWriteFields } from '../generated/jobs.js';
import { emptyJobContact, type JobInput, type JobRecord } from './jobs-contract.js';
import {
  raw,
  records,
  voucherSnapshotHash as hash,
  voucherWriteSnapshot as snapshot,
  type RawRecord,
  type WriteShape,
} from './vouchers-snapshot.js';
const string = (value: unknown) => (typeof value === 'string' ? value : '');
const object = (value: unknown): RawRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RawRecord) : {};
const list = (value: unknown): RawRecord[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is RawRecord =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
const numeric = (value: unknown): number | null =>
  value == null || value === '' || !['number', 'string'].includes(typeof value)
    ? null
    : Number.isFinite(Number(value))
      ? Number(value)
      : null;
const date = (value: unknown) => string(value).slice(0, 10);
const contact = (value: unknown): JobInput['contacts'][number] => {
  const item = object(value);
  return {
    ...emptyJobContact(),
    ...Object.fromEntries(
      ['firstName', 'lastName', 'email', 'phone', 'fax'].map((key) => [key, string(item[key])])
    ),
    webUrls: list(item.webUrls).map((url) => ({
      url: string(url.url),
      description: string(url.description),
    })),
  };
};
function assertTypes(value: unknown, shape: WriteShape): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (item == null) throw new Error('job_incomplete');
      assertTypes(item, shape);
    });
    return;
  }
  const item = raw(value);
  for (const [key, field] of Object.entries(shape)) {
    const current = item[key];
    if (typeof field === 'object') {
      assertTypes(current, field);
      continue;
    }
    if (current == null) continue;
    if (key === 'payload') {
      raw(current);
      continue;
    }
    const isNumber = [
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
    const valid = isNumber
      ? numeric(current) !== null
      : ['open', 'useYear', 'groupPrice'].includes(key)
        ? typeof current === 'boolean'
        : key === 'useOnlyTimeDescription'
          ? ['true', 'false', true, false].includes(current as string | boolean)
          : typeof current === 'string';
    if (!valid) throw new Error('job_incomplete');
  }
}
export const jobFingerprint = (value: RawRecord) => hash(value);
export function assertJobWritable(value: RawRecord): void {
  if (value.genericType !== 'Job') throw new Error('job_not_found');
  snapshot(value, jobWriteFields);
  assertTypes(value, jobWriteFields);
  if (
    records(value.categories).some(
      (category) => typeof category.name !== 'string' || !category.name.trim()
    )
  )
    throw new Error('job_incomplete');
  for (const [key, field] of Object.entries(jobWriteFields))
    if (typeof field === 'object' && !Array.isArray(value[key])) throw new Error('job_incomplete');
  for (const key of ['ancestry', 'memberId', 'pointOfInterest', 'quota', 'discountType'])
    if (!(key in value) || value[key]) throw new Error('job_dependents_unsupported');
  for (const key of ['genericItems', 'genericItemMessages', 'pushNotifications'])
    if (records(value[key]).length) throw new Error('job_dependents_unsupported');
  const payload = value.payload == null ? {} : raw(value.payload);
  if (payload.employmentType != null && typeof payload.employmentType !== 'string')
    throw new Error('job_incomplete');
}
export function jobRead(value: RawRecord): JobRecord {
  const identity = z
    .object({
      id: z.string().min(1),
      genericType: z.literal('Job'),
      visible: z.boolean(),
      dataProvider: z.object({ id: z.string().min(1), name: z.string().nullish() }),
    })
    .parse(value);
  let writeBlockedReason: string | undefined;
  try {
    assertJobWritable(value);
  } catch (error) {
    writeBlockedReason =
      error instanceof Error && error.message === 'job_dependents_unsupported'
        ? error.message
        : 'job_incomplete';
  }
  const dates = list(value.dates).map((item, sourceIndex) => ({
    sourceIndex,
    dateEnd: date(item.dateEnd),
  }));
  return {
    id: identity.id,
    genericType: 'Job',
    title: string(value.title),
    visible: identity.visible,
    dataProvider: {
      id: identity.dataProvider.id,
      ...(identity.dataProvider.name ? { name: identity.dataProvider.name } : {}),
    },
    updatedAt: string(value.updatedAt),
    contentFingerprint: jobFingerprint(value),
    writeBlockedReason,
    input: {
      title: string(value.title),
      externalId: string(value.externalId),
      employmentType: string(object(value.payload).employmentType),
      publicationDate: date(value.publicationDate),
      visible: identity.visible,
      dates: dates.length ? dates : [{ dateEnd: '' }],
      contentBlocks: list(value.contentBlocks).map((item, sourceIndex) => ({
        sourceIndex,
        body: string(item.body),
      })),
      contacts: list(value.contacts).map((item, sourceIndex) => ({
        ...contact(item),
        sourceIndex,
      })),
      companies: list(value.companies).map((item, sourceIndex) => {
        const address = object(item.address);
        const geo = object(address.geoLocation);
        return {
          sourceIndex,
          name: string(item.name),
          contact: contact(item.contact),
          address: {
            addition: string(address.addition),
            street: string(address.street),
            zip: string(address.zip),
            city: string(address.city),
            latitude: numeric(geo.latitude),
            longitude: numeric(geo.longitude),
          },
        };
      }),
      mediaContents: list(value.mediaContents).map((item, sourceIndex) => ({
        sourceIndex,
        contentType: string(item.contentType) as JobInput['mediaContents'][number]['contentType'],
        hostMediaAssetId:
          typeof object(item.payload).studioMediaAssetId === 'string'
            ? (object(item.payload).studioMediaAssetId as string)
            : undefined,
        sourceUrl: {
          url: string(object(item.sourceUrl).url),
          description: string(object(item.sourceUrl).description),
        },
        copyright: string(item.copyright),
        captionText: string(item.captionText),
      })),
    },
  };
}
function original(values: unknown, index?: number): RawRecord {
  if (index === undefined) return {};
  const items = records(values ?? []);
  if (!items[index]) throw new Error('job_content_conflict');
  return items[index];
}
function mergeContact(previous: unknown, input: JobInput['contacts'][number]): RawRecord {
  const before = contact(previous);
  const result = { ...object(previous) };
  for (const key of ['firstName', 'lastName', 'email', 'phone', 'fax', 'webUrls'] as const)
    if (hash(before[key]) !== hash(input[key])) result[key] = input[key];
  return result;
}
// The shared projection omits nullable groups for POI writes; Job inputs can retain explicit null.
// Keep its intentional omission of null media dimensions (Mainserver AnyPrimitive compatibility).
function retainNullGroups(source: unknown, projected: unknown): unknown {
  if (source === null) return null;
  if (Array.isArray(projected))
    return projected.map((item, index) => retainNullGroups((source as unknown[])[index], item));
  if (projected && typeof projected === 'object')
    return Object.fromEntries(
      Object.entries(projected).map(([key, value]) => [
        key,
        retainNullGroups(object(source)[key], value),
      ])
    );
  return projected;
}
function mergeCompany(
  item: JobInput['companies'][number],
  companies: unknown,
  before: JobInput['companies'] | undefined
): RawRecord {
  const previous = original(companies, item.sourceIndex);
  const previousAddress = object(previous.address);
  const baseline = before?.find(
    (company) => company.sourceIndex === item.sourceIndex && item.sourceIndex !== undefined
  );
  return {
    ...previous,
    name: baseline?.name === item.name ? previous.name : item.name,
    contact:
      baseline && hash(baseline.contact) === hash(item.contact)
        ? previous.contact
        : mergeContact(previous.contact, item.contact),
    address:
      baseline && hash(baseline.address) === hash(item.address)
        ? previous.address
        : {
            ...previousAddress,
            addition: item.address.addition,
            street: item.address.street,
            zip: item.address.zip,
            city: item.address.city,
            geoLocation:
              item.address.latitude === null
                ? null
                : {
                    ...object(previousAddress.geoLocation),
                    latitude: item.address.latitude,
                    longitude: item.address.longitude,
                  },
          },
  };
}
const hasContactData = (item: JobInput['contacts'][number]) =>
  item.sourceIndex !== undefined || JSON.stringify(item) !== JSON.stringify(emptyJobContact());

export function buildJobWrite(input: JobInput, existing?: RawRecord): RawRecord {
  if (existing) assertJobWritable(existing);
  const base = existing ? raw(retainNullGroups(existing, snapshot(existing, jobWriteFields))) : {};
  const before = existing ? jobRead(existing).input : undefined;
  const unchanged = (key: keyof JobInput) =>
    Boolean(before && hash(before[key]) === hash(input[key]));
  const payload = existing?.payload == null ? {} : raw(existing.payload);
  return {
    ...base,
    title: input.title,
    genericType: 'Job',
    visible: input.visible,
    ...(existing ? { teaser: existing.teaser, description: existing.description } : {}),
    externalId: unchanged('externalId') ? base.externalId : input.externalId || null,
    publicationDate: unchanged('publicationDate') ? base.publicationDate : input.publicationDate,
    payload: {
      ...payload,
      ...(unchanged('employmentType') ? {} : { employmentType: input.employmentType }),
    },
    contentBlocks: unchanged('contentBlocks')
      ? base.contentBlocks
      : input.contentBlocks.map((item) => {
          const previous = original(base.contentBlocks, item.sourceIndex);
          return {
            ...previous,
            body: previous.body === item.body ? item.body : sanitizeRichTextHtml(item.body),
          };
        }),
    dates: unchanged('dates')
      ? base.dates
      : input.dates.map((item) => ({
          ...original(base.dates, item.sourceIndex),
          dateEnd: item.dateEnd || null,
        })),
    contacts: unchanged('contacts')
      ? base.contacts
      : input.contacts
          .filter(hasContactData)
          .map((item) => mergeContact(original(base.contacts, item.sourceIndex), item)),
    companies: unchanged('companies')
      ? base.companies
      : input.companies
          .filter((item) => item.sourceIndex !== undefined || item.name.trim())
          .map((item) => mergeCompany(item, base.companies, before?.companies)),
    mediaContents: unchanged('mediaContents')
      ? base.mediaContents
      : input.mediaContents.map(({ sourceIndex, hostMediaAssetId, ...item }) => {
          const previous = original(base.mediaContents, sourceIndex);
          return {
            ...previous,
            ...item,
            sourceUrl: { ...object(previous.sourceUrl), ...item.sourceUrl },
            payload: { ...object(previous.payload), studioMediaAssetId: hostMediaAssetId ?? null },
          };
        }),
  };
}
