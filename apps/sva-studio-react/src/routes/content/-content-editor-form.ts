import { GENERIC_CONTENT_TYPE, type IamContentStatus } from '@sva/core';
import { z } from 'zod';

import { t } from '../../i18n';
import { parseOptionalEditorDateTime, toDatetimeLocalValue } from '../../lib/editor-date-time';

export type ContentFormState = {
  title: string;
  contentType: string;
  status: IamContentStatus;
  publishedAt: string;
  payloadText: string;
};

export const emptyFormState = (): ContentFormState => ({
  title: '',
  contentType: GENERIC_CONTENT_TYPE,
  status: 'draft',
  publishedAt: '',
  payloadText: '{}',
});

export const buildFormState = (content: {
  title: string;
  contentType: string;
  status: IamContentStatus;
  publishedAt?: string;
  payload: unknown;
}): ContentFormState => ({
  title: content.title,
  contentType: content.contentType,
  status: content.status,
  publishedAt: toDatetimeLocalValue(content.publishedAt),
  payloadText: JSON.stringify(content.payload, null, 2),
});

export const parseContentPayload = (
  payloadText: string
): { ok: true; payload: unknown } | { ok: false; message: string } => {
  try {
    return { ok: true, payload: JSON.parse(payloadText) };
  } catch {
    return { ok: false, message: t('content.validation.payloadJsonInvalid') };
  }
};

const contentStatusSchema = z.enum(['draft', 'in_review', 'approved', 'published', 'archived']);

export const createContentFormSchema = (originalPublishedAt?: string) =>
  z
    .object({
      title: z.string().trim().min(1, t('content.validation.titleRequired')),
      contentType: z.string(),
      status: contentStatusSchema,
      publishedAt: z.string(),
      payloadText: z.string(),
    })
    .superRefine((values, context) => {
      const parsedPayload = parseContentPayload(values.payloadText);
      if (!parsedPayload.ok) {
        context.addIssue({
          code: 'custom',
          path: ['payloadText'],
          message: parsedPayload.message,
        });
      }

      const publishedAt = parseOptionalEditorDateTime(values.publishedAt, originalPublishedAt);
      if (publishedAt.kind === 'invalid') {
        context.addIssue({
          code: 'custom',
          path: ['publishedAt'],
          message: t('content.validation.publishedAtInvalid'),
        });
      }

      if (values.status === 'published' && publishedAt.kind === 'empty') {
        context.addIssue({
          code: 'custom',
          path: ['publishedAt'],
          message: t('content.validation.publishedAtRequired'),
        });
      }
    });
