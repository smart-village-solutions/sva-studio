import { createHash } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';

const LEGAL_TEXT_SANITIZER_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'a',
    'b',
    'blockquote',
    'br',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'li',
    'ol',
    'p',
    'span',
    'strong',
    'u',
    'ul',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
};

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

export const sanitizeLegalTextHtml = (value: string): string => {
  const sanitized = collapseWhitespace(sanitizeHtml(value, LEGAL_TEXT_SANITIZER_OPTIONS));
  return sanitized.length > 0 ? sanitized : '<p></p>';
};

export const hashLegalTextHtml = (value: string): string =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
