import type { SvaMainserverContentBlockInput } from '../types.js';
import { errorJson, isRecord, readString } from './content-route-core.js';
import { parseMediaContents } from './content-route-parsers.js';

const hasContentBlockContent = (block: SvaMainserverContentBlockInput) =>
  Object.keys(block).length > 0;

const parseContentBlockMediaContents = (
  value: unknown
): Array<NonNullable<NonNullable<SvaMainserverContentBlockInput['mediaContents']>[number]>> | Response => {
  if (value === undefined || value === null) {
    return [];
  }

  const parsed = parseMediaContents(value);
  return parsed instanceof Response ? parsed : [...(parsed ?? [])];
};

export const parseContentBlocks = (value: unknown): readonly SvaMainserverContentBlockInput[] | undefined | Response => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', 'ContentBlocks müssen als Liste gesendet werden.');
  }

  const blocks: SvaMainserverContentBlockInput[] = [];
  for (const block of value) {
    if (!isRecord(block)) {
      return errorJson(400, 'invalid_request', 'ContentBlocks müssen Objekte sein.');
    }

    const mediaContents = parseContentBlockMediaContents(block.mediaContents);
    if (mediaContents instanceof Response) {
      return mediaContents;
    }

    const parsedBlock: SvaMainserverContentBlockInput = {
      ...(readString(block.title) ? { title: readString(block.title) } : {}),
      ...(readString(block.intro) ? { intro: readString(block.intro) } : {}),
      ...(readString(block.body) ? { body: readString(block.body) } : {}),
      ...(mediaContents.length > 0 ? { mediaContents } : {}),
    };

    if (!hasContentBlockContent(parsedBlock)) {
      return errorJson(400, 'invalid_request', 'ContentBlocks benötigen mindestens ein Feld mit Inhalt.');
    }

    blocks.push(parsedBlock);
  }

  return blocks;
};
