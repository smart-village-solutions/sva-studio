import { createHash } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';

const SAFE_BLANK_TARGET_REL = 'noopener noreferrer';

const normalizeAnchorAttributes = (attributes: sanitizeHtml.Attributes): sanitizeHtml.Attributes => {
  if (attributes.target !== '_blank') {
    return attributes;
  }

  return {
    ...attributes,
    rel: SAFE_BLANK_TARGET_REL,
  };
};

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
  transformTags: {
    a: (tagName, attributes) => ({
      tagName,
      attribs: normalizeAnchorAttributes(attributes),
    }),
  },
};

const collapseWhitespace = (value: string): string => {
  let collapsed = '';
  let previousWasWhitespace = true;

  for (const character of value) {
    const isWhitespace = character.trim().length === 0;
    if (isWhitespace) {
      if (!previousWasWhitespace) {
        collapsed += ' ';
        previousWasWhitespace = true;
      }
      continue;
    }

    collapsed += character;
    previousWasWhitespace = false;
  }

  return previousWasWhitespace ? collapsed.trimEnd() : collapsed;
};

export const sanitizeLegalTextHtml = (value: string): string => {
  const sanitized = collapseWhitespace(sanitizeHtml(value, LEGAL_TEXT_SANITIZER_OPTIONS));
  return sanitized.length > 0 ? sanitized : '<p></p>';
};

export const hashLegalTextHtml = (value: string): string =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
