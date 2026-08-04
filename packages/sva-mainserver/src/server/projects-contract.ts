import { z } from 'zod';

import type {
  SvaMainserverAccessibilityInformation,
  SvaMainserverAddress,
  SvaMainserverCategory,
  SvaMainserverCategoryInput,
  SvaMainserverContact,
  SvaMainserverDate,
  SvaMainserverGenericItem,
  SvaMainserverGenericItemInput,
  SvaMainserverProject,
  SvaMainserverProjectAuthor,
  SvaMainserverProjectInput,
  SvaMainserverProjectStatus,
  SvaMainserverWebUrl,
} from '../types.js';
import { errorJson, isRecord } from './content-route-core.js';

export const PROJECTS_CONTENT_TYPE = 'projects.project' as const;
export const PROJECTS_GENERIC_TYPE = 'FeaturedProject' as const;

const requiredText = z.string().trim().min(1);
const imageSchema = z.object({
  url: requiredText,
  altText: requiredText,
  caption: z.string().trim().optional(),
  credits: z.string().trim().optional(),
  position: z.number().int().nonnegative(),
}).strict();

const authorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('organization'), id: requiredText, displayName: requiredText }).strict(),
  z.object({ type: z.literal('person'), id: requiredText, displayName: requiredText }).strict(),
]);

export const projectInputSchema = z
  .object({
    language: z.string().trim().default(''),
    title: requiredText,
    description: z.string().trim().default(''),
    fullText: z.string().trim().default(''),
    images: z.array(imageSchema),
    status: z.enum(['draft', 'published', 'archived']),
    author: authorSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.images.some((image, index) => image.position !== index)) {
      ctx.addIssue({
        code: 'custom',
        path: ['images'],
        message: 'Bildpositionen müssen lückenlos sein.',
      });
    }
  });

export const parseProjectInput = async (
  request: Request
): Promise<SvaMainserverProjectInput | Response> => {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = projectInputSchema.safeParse(body);
  return parsed.success
    ? parsed.data
    : errorJson(400, 'invalid_request', 'Projektfelder sind unvollständig oder ungültig.');
};

const payloadRecord = (payload: unknown): Record<string, unknown> =>
  isRecord(payload) ? payload : {};

const normalizeProjectFullText = (value: string): string => {
  const trimmed = value.trim();
  return /^(?:\s|<p>|<\/p>|<br\s*\/?>|&nbsp;)*$/i.test(trimmed) ? '' : trimmed;
};

const toMediaContents = (input: SvaMainserverProjectInput) =>
  input.images.map((image) => ({
    contentType: 'image',
    sourceUrl: { url: image.url.trim(), description: image.altText.trim() },
    ...(image.caption?.trim() ? { captionText: image.caption.trim() } : {}),
    ...(image.credits?.trim() ? { copyright: image.credits.trim() } : {}),
  }));

const mapWebUrlsToInput = (values: readonly SvaMainserverWebUrl[]) =>
  values.map(({ url, description }) => ({ url, ...(description ? { description } : {}) }));

const mapCategoriesToInput = (
  values: readonly SvaMainserverCategory[]
): readonly SvaMainserverCategoryInput[] =>
  values.map((category) => ({
    name: category.name,
    children: mapCategoriesToInput(category.children),
  }));

const mapContactsToInput = (values: readonly SvaMainserverContact[]) =>
  values.map(({ id: _id, webUrls, ...contact }) => ({
    ...contact,
    webUrls: mapWebUrlsToInput(webUrls),
  }));

const mapAddressesToInput = (values: readonly SvaMainserverAddress[]) =>
  values.map(({ id, ...address }) => ({
    ...address,
    ...(id && Number.isInteger(Number(id)) ? { id: Number(id) } : {}),
  }));

const mapDatesToInput = (values: readonly SvaMainserverDate[]) =>
  values.map(({ id: _id, useOnlyTimeDescription, ...date }) => ({
    ...date,
    ...(useOnlyTimeDescription === undefined
      ? {}
      : { useOnlyTimeDescription: useOnlyTimeDescription === 'true' }),
  }));

const mapAccessibilityToInput = (
  values: readonly SvaMainserverAccessibilityInformation[]
) =>
  values.map(({ id: _id, urls, ...information }) => ({
    ...information,
    urls: mapWebUrlsToInput(urls),
  }));

export const mergeProjectIntoGenericItem = (input: {
  readonly project: SvaMainserverProjectInput;
  readonly existing?: SvaMainserverGenericItem;
  readonly externalId?: string;
  readonly publishedAt?: string;
  readonly deleted?: boolean;
}): SvaMainserverGenericItemInput => {
  const existing = input.existing;
  const existingPayload = payloadRecord(existing?.payload);
  const firstBlock = existing?.contentBlocks[0];
  const remainingBlocks = existing?.contentBlocks.slice(1) ?? [];
  const fullText = normalizeProjectFullText(input.project.fullText);
  return {
    ...(existing
      ? {
          keywords: existing.keywords,
          publicationDate: existing.publicationDate,
          categories: mapCategoriesToInput(existing.categories),
          contacts: mapContactsToInput(existing.contacts),
          webUrls: mapWebUrlsToInput(existing.webUrls),
          addresses: mapAddressesToInput(existing.addresses),
          openingHours: existing.openingHours.map(({ id: _id, ...entry }) => entry),
          priceInformations: existing.priceInformations.map(({ id: _id, ...entry }) => entry),
          locations: existing.locations.map(({ id: _id, ...entry }) => entry),
          dates: mapDatesToInput(existing.dates),
          accessibilityInformations: mapAccessibilityToInput(
            existing.accessibilityInformations
          ),
        }
      : {}),
    title: input.project.title.trim(),
    genericType: PROJECTS_GENERIC_TYPE,
    teaser: input.project.description.trim(),
    visible: input.project.status === 'published',
    author: input.project.author.displayName.trim(),
    externalId: input.externalId ?? existing?.externalId,
    publishedAt: input.publishedAt ?? existing?.publishedAt,
    payload: {
      ...existingPayload,
      language: input.project.language.trim(),
      status: input.project.status,
      deleted: input.deleted ?? existingPayload.deleted === true,
    },
    contentBlocks: fullText
      ? [{ ...(firstBlock ?? {}), body: fullText }, ...remainingBlocks]
      : firstBlock && remainingBlocks.length > 0
        ? [{ ...firstBlock, body: '' }, ...remainingBlocks]
        : [],
    mediaContents: toMediaContents(input.project),
  };
};

const projectStatus = (
  item: SvaMainserverGenericItem,
  payload: Readonly<Record<string, unknown>>
): SvaMainserverProjectStatus => {
  if (payload.status === 'draft' || payload.status === 'published' || payload.status === 'archived') {
    return payload.status;
  }
  return item.visible ? 'published' : 'draft';
};

const projectAuthor = (
  item: SvaMainserverGenericItem,
  payload: Readonly<Record<string, unknown>>
): SvaMainserverProjectAuthor => {
  const author = payload.author;
  if (isRecord(author)) {
    const type = author.type;
    const id = typeof author.id === 'string' ? author.id.trim() : '';
    const displayName = typeof author.displayName === 'string' ? author.displayName.trim() : '';
    if ((type === 'organization' || type === 'person') && id && displayName) {
      return { type, id, displayName };
    }
  }
  const displayName = item.author?.trim() || item.id;
  return {
    type: 'organization' as const,
    id: `mainserver:${item.id}`,
    displayName,
  };
};

export const mapGenericItemToProject = (item: SvaMainserverGenericItem): SvaMainserverProject => {
  const payload = payloadRecord(item.payload);
  const status = projectStatus(item, payload);
  return {
    id: item.id,
    language: typeof payload.language === 'string' ? payload.language.trim() : '',
    title: item.title,
    description: item.teaser?.trim() ?? '',
    fullText: item.contentBlocks[0]?.body?.trim() ?? '',
    images: item.mediaContents.map((media, position) => ({
      url: media.sourceUrl?.url?.trim() ?? '',
      altText: media.sourceUrl?.description?.trim() ?? '',
      ...(media.captionText?.trim() ? { caption: media.captionText.trim() } : {}),
      ...(media.copyright?.trim() ? { credits: media.copyright.trim() } : {}),
      position,
    })),
    status,
    published: status === 'published',
    ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
    author: projectAuthor(item, payload),
    deleted: payload.deleted === true,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

export const validateProjectProjection = (project: SvaMainserverProject): Response | null => {
  const parsed = projectInputSchema.safeParse({
    language: project.language,
    title: project.title,
    description: project.description,
    fullText: project.fullText,
    images: project.images,
    status: project.status,
    author: project.author,
  });
  return parsed.success
    ? null
    : errorJson(502, 'invalid_response', 'Mainserver-Projekt verletzt den FeaturedProject-Vertrag.');
};
