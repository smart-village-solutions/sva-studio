import { zodResolver } from '@hookform/resolvers/zod';
import { isPersistableManualContentMediaUrl } from '@sva/studio-ui-react';
import { z } from 'zod';
import type { NewsDetailEditorialFormValues, NewsMediaContentFormValue } from './news.types.js';

const isValidDateString = (value: string): boolean =>
  Number.isNaN(new Date(value).getTime()) === false;

const isValidLocalDateTimeString = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(value);
  if (!match) {
    return false;
  }

  const [, yearString, monthString, dayString, hourString, minuteString] = match;
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);
  const hour = Number(hourString);
  const minute = Number(minuteString);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
  );
};

const isHttpsUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
};

const mediaContentSchema = z.object({
  captionText: z.string(),
  copyright: z.string(),
  contentType: z.string(),
  height: z.string(),
  width: z.string(),
  sourceUrl: z.object({
    url: z.string(),
    description: z.string().optional().default(''),
  }),
});

const legacySnapshotSchema = z
  .object({
    visible: z.boolean().optional(),
    keywords: z.string().optional(),
    externalId: z.string().optional(),
    fullVersion: z.boolean().optional(),
    charactersToBeShown: z.union([z.number(), z.string()]).optional(),
    newsType: z.string().optional(),
    publishedAt: z.string().optional(),
    publicationDate: z.string().optional(),
    showPublishDate: z.boolean().optional(),
    address: z
      .object({
        street: z.string().optional(),
        zip: z.string().optional(),
        city: z.string().optional(),
      })
      .optional(),
    pointOfInterestId: z.string().optional(),
    pushNotificationsSentAt: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
    legacyContentBlocks: z
      .array(
        z.object({
          title: z.string(),
          intro: z.string(),
          body: z.string(),
          mediaContents: z.array(mediaContentSchema),
        })
      )
      .optional(),
  })
  .optional();

const hasInvalidMediaUrls = (mediaContents: readonly NewsMediaContentFormValue[]) =>
  mediaContents.some((media) => {
    const url = media.sourceUrl.url.trim();
    return url.length > 0 && !isPersistableManualContentMediaUrl(url);
  });

const readCompatibilityString = (
  values: Record<string, unknown>,
  key: string
): string | undefined => {
  const value = values[key];
  return typeof value === 'string' ? value : undefined;
};

export const isStrictlyValidCompatibilityDate = (value: string): boolean => {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(value)) {
    return isValidLocalDateTimeString(value);
  }

  return isValidDateString(value);
};

export const newsDetailFormSchema = z
  .object({
    title: z.string().trim().min(1, 'title'),
    author: z.string(),
    categories: z.array(z.string().trim().min(1, 'categories').max(128, 'categories')),
    contentIntro: z.string(),
    contentBody: z.string(),
    contentMedia: z.array(mediaContentSchema),
    sourceUrl: z.object({
      url: z.string(),
      description: z.string(),
    }),
    sourceUrlDescription: z.string(),
    pushNotificationEnabled: z.boolean(),
    wasteLocationKeys: z
      .array(z.object({ street: z.string(), zip: z.string(), city: z.string() }))
      .default([]),
    publicationMode: z.enum(['draft', 'immediate', 'scheduled']),
    scheduledPublicationAt: z.string(),
    __legacySnapshot: legacySnapshotSchema,
  })
  .passthrough()
  .superRefine((values, ctx) => {
    if (values.sourceUrl.url.trim().length > 0 && isHttpsUrl(values.sourceUrl.url) === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceUrl', 'url'],
        message: 'sourceUrl',
      });
    }

    if (hasInvalidMediaUrls(values.contentMedia)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contentMedia'],
        message: 'mediaContents',
      });
    }

    if (
      values.publicationMode === 'scheduled' &&
      isValidDateString(values.scheduledPublicationAt) === false
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledPublicationAt'],
        message: 'scheduledPublicationAt',
      });
    }

    const compatibilityPublishedAt = readCompatibilityString(
      values as Record<string, unknown>,
      'publishedAt'
    );
    if (
      compatibilityPublishedAt &&
      compatibilityPublishedAt.trim().length > 0 &&
      isStrictlyValidCompatibilityDate(compatibilityPublishedAt) === false
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publishedAt'],
        message: 'publishedAt',
      });
    }

    const compatibilityPublicationDate = readCompatibilityString(
      values as Record<string, unknown>,
      'publicationDate'
    );
    if (
      compatibilityPublicationDate &&
      compatibilityPublicationDate.trim().length > 0 &&
      isStrictlyValidCompatibilityDate(compatibilityPublicationDate) === false
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publicationDate'],
        message: 'publicationDate',
      });
    }

    const compatibilityCharactersToBeShown = readCompatibilityString(
      values as Record<string, unknown>,
      'charactersToBeShown'
    );
    if (
      compatibilityCharactersToBeShown &&
      (/^\d+$/u.test(compatibilityCharactersToBeShown) === false ||
        Number(compatibilityCharactersToBeShown) < 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['charactersToBeShown'],
        message: 'charactersToBeShown',
      });
    }
  });

export const newsDetailFormResolver = zodResolver(newsDetailFormSchema as never);

export const syncPublicationModeFromPublishedAt = (
  values: NewsDetailEditorialFormValues,
  nextValue: string
) => {
  const trimmedValue = nextValue.trim();

  if (trimmedValue.length === 0) {
    values.publicationMode = 'draft';
    values.scheduledPublicationAt = '';
    return;
  }

  if (isStrictlyValidCompatibilityDate(trimmedValue) === false) {
    values.publicationMode = 'draft';
    values.scheduledPublicationAt = '';
    return;
  }

  values.publicationMode = 'scheduled';
  values.scheduledPublicationAt = trimmedValue;
};
