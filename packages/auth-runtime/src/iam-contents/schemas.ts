import type { ContentJsonValue } from '@sva/core';
import { iamContentStatuses, iamContentValidationStates } from '@sva/core';
import { z } from 'zod';

import { resolveContentPublicationInvariant } from './content-publication-invariants.js';

const isoDateTimePattern =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.\d{1,9})?(?<offset>Z|[+-](?<offsetHour>\d{2}):(?<offsetMinute>\d{2}))$/;

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const resolveDaysInMonth = (year: number, month: number): number => {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
};

const isStrictIsoDateTime = (value: string): boolean => {
  const match = isoDateTimePattern.exec(value);

  if (!match?.groups) {
    return false;
  }

  const year = Number.parseInt(match.groups.year, 10);
  const month = Number.parseInt(match.groups.month, 10);
  const day = Number.parseInt(match.groups.day, 10);
  const hour = Number.parseInt(match.groups.hour, 10);
  const minute = Number.parseInt(match.groups.minute, 10);
  const second = Number.parseInt(match.groups.second, 10);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > resolveDaysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }

  if (match.groups.offset !== 'Z') {
    const offsetHour = Number.parseInt(match.groups.offsetHour, 10);
    const offsetMinute = Number.parseInt(match.groups.offsetMinute, 10);

    if (offsetHour > 23 || offsetMinute > 59) {
      return false;
    }
  }

  return !Number.isNaN(Date.parse(value));
};

const isoDateTimeString = z
  .string()
  .trim()
  .refine((value) => isStrictIsoDateTime(value), 'Datum ist ungültig.');

const contentStatusSchema = z.enum(iamContentStatuses);
const contentValidationStateSchema = z.enum(iamContentValidationStates);
const jsonValueSchema: z.ZodType<ContentJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

const validatePublishedAtForStatus = (
  value: {
    status?: (typeof iamContentStatuses)[number];
    publishedAt?: string;
    publishFrom?: string;
    publishUntil?: string;
  },
  ctx: z.RefinementCtx
) => {
  const invariant = resolveContentPublicationInvariant(value);
  if (invariant === 'content_published_at_required') {
    ctx.addIssue({
      code: 'custom',
      path: ['publishedAt'],
      message: 'Veröffentlichungsdatum ist für veröffentlichte Inhalte erforderlich.',
    });
  }
  if (invariant === 'content_publication_window_invalid') {
    ctx.addIssue({
      code: 'custom',
      path: ['publishUntil'],
      message: 'Das Veröffentlichungsende muss nach dem Veröffentlichungsbeginn liegen.',
    });
  }
};

const hasDefinedEntries = (value: Record<string, unknown>): boolean =>
  Object.values(value).some((entry) => entry !== undefined);

export const createContentSchema = z
  .object({
    contentType: z.string().trim().min(1).max(128),
    organizationId: z.uuid().optional(),
    ownerSubjectId: z.string().trim().min(1).max(255).optional(),
    title: z.string().trim().min(1).max(255),
    payload: jsonValueSchema,
    status: contentStatusSchema.default('draft'),
    validationState: contentValidationStateSchema.default('valid'),
    publishedAt: isoDateTimeString.optional(),
    publishFrom: isoDateTimeString.optional(),
    publishUntil: isoDateTimeString.optional(),
  })
  .superRefine(validatePublishedAtForStatus);

export const updateContentSchema = z
  .object({
    organizationId: z.uuid().optional(),
    ownerSubjectId: z.string().trim().min(1).max(255).optional(),
    title: z.string().trim().min(1).max(255).optional(),
    payload: jsonValueSchema.optional(),
    status: contentStatusSchema.optional(),
    validationState: contentValidationStateSchema.optional(),
    publishedAt: isoDateTimeString.optional(),
    publishFrom: isoDateTimeString.optional(),
    publishUntil: isoDateTimeString.optional(),
  })
  .refine(hasDefinedEntries, 'Mindestens ein Feld muss gesetzt werden.')
  .superRefine(validatePublishedAtForStatus);

export type UpdateContentSchemaInput = z.infer<typeof updateContentSchema>;
