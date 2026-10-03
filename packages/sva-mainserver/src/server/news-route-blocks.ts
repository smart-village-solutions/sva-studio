import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';
import type { SvaMainserverNewsInput } from '../types.js';
import { errorJson, isRecord, readNumber, readString } from './content-route-core.js';
import { parseMediaUrl } from './content-route-parsers.js';

const parseContentBlockMediaContents = (
  value: unknown
):
  | Array<
      NonNullable<
        NonNullable<SvaMainserverNewsInput['contentBlocks']>[number]['mediaContents']
      >[number]
    >
  | Response => {
  const mediaContents: Array<
    NonNullable<
      NonNullable<SvaMainserverNewsInput['contentBlocks']>[number]['mediaContents']
    >[number]
  > = [];

  if (value === undefined || value === null) {
    return mediaContents;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'MediaContent muss als Liste gesendet werden.');
  }

  for (const media of value) {
    if (!isRecord(media)) {
      return errorJson(400, 'invalid_request', 'MediaContent-Einträge müssen Objekte sein.');
    }
    const sourceUrl = parseMediaUrl(media.sourceUrl);
    if (sourceUrl instanceof Response) {
      return sourceUrl;
    }
    mediaContents.push({
      ...(readString(media.captionText) ? { captionText: readString(media.captionText) } : {}),
      ...(readString(media.copyright) ? { copyright: readString(media.copyright) } : {}),
      ...(readString(media.contentType) ? { contentType: readString(media.contentType) } : {}),
      ...(readNumber(media.height) !== undefined ? { height: readNumber(media.height) } : {}),
      ...(readNumber(media.width) !== undefined ? { width: readNumber(media.width) } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
    });
  }

  return mediaContents;
};

const validateContentBlockText = (block: Record<string, unknown>): Response | null => {
  if (
    (block.title !== undefined && block.title !== null && typeof block.title !== 'string') ||
    (block.intro !== undefined && block.intro !== null && typeof block.intro !== 'string') ||
    (block.body !== undefined && block.body !== null && typeof block.body !== 'string')
  ) {
    return errorJson(
      400,
      'invalid_request',
      'Titel, Einleitung und Inhalt eines ContentBlocks müssen Strings sein.'
    );
  }
  return null;
};

export const parseContentBlocks = (
  value: unknown
): SvaMainserverNewsInput['contentBlocks'] | undefined | Response => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'ContentBlocks müssen als Liste gesendet werden.');
  }

  const blocks: Array<NonNullable<SvaMainserverNewsInput['contentBlocks']>[number]> = [];
  for (const block of value) {
    if (!isRecord(block)) {
      return errorJson(400, 'invalid_request', 'ContentBlocks müssen Objekte sein.');
    }
    const textError = validateContentBlockText(block);
    if (textError) return textError;
    const mediaContents = parseContentBlockMediaContents(block.mediaContents);
    if (mediaContents instanceof Response) {
      return mediaContents;
    }
    if (typeof block.body === 'string' && block.body.trim().length > 50_000) {
      return errorJson(
        400,
        'invalid_request',
        'Inhaltsblöcke dürfen maximal 50.000 Zeichen haben.'
      );
    }
    const body = readString(block.body);
    const intro = readString(block.intro);
    const sanitizedBody = body ? sanitizeRichTextHtml(body) : undefined;
    const sanitizedIntro = intro ? sanitizeRichTextHtml(intro) : undefined;
    blocks.push({
      ...(readString(block.title) ? { title: readString(block.title) } : {}),
      ...(sanitizedIntro ? { intro: sanitizedIntro } : {}),
      ...(sanitizedBody ? { body: sanitizedBody } : {}),
      ...(mediaContents.length > 0 ? { mediaContents } : {}),
    });
  }
  return blocks;
};
