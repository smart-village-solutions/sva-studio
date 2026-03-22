import { createHash } from 'node:crypto';

const stripScriptTags = (value: string): string =>
  value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

const stripInlineEventHandlers = (value: string): string =>
  value.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '');

const stripJavascriptUrls = (value: string): string =>
  value.replace(/(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '$1="#"');

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

export const sanitizeLegalTextHtml = (value: string): string => {
  const sanitized = collapseWhitespace(stripJavascriptUrls(stripInlineEventHandlers(stripScriptTags(value))));
  return sanitized.length > 0 ? sanitized : '<p></p>';
};

export const hashLegalTextHtml = (value: string): string =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
