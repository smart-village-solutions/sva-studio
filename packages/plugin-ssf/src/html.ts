import sanitizeHtml from 'sanitize-html';

import { SSF_RUNTIME_LIMITS } from './constants.js';
import { ssfHtmlSchema } from './contracts.js';

const ALLOWED_TAGS = [
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'b',
  'blockquote',
  'br',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'dfn',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'samp',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
] as const;

export class SsfHtmlValidationError extends Error {
  readonly code = 'runtime_configuration_unavailable';

  constructor(message: string) {
    super(message);
    this.name = 'SsfHtmlValidationError';
  }
}

export const sanitizeSsfHtmlV1 = (html: string): string => {
  const sourceResult = ssfHtmlSchema.safeParse(html);
  if (!sourceResult.success) {
    throw new SsfHtmlValidationError(
      `SSF HTML exceeds ${SSF_RUNTIME_LIMITS.htmlUtf8Bytes} UTF-8 bytes before sanitization.`
    );
  }

  const sanitized = sanitizeHtml(html, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: {
      '*': ['dir', 'lang', 'title'],
      a: ['href', 'name', 'rel', 'target'],
      col: ['span', 'width'],
      img: ['alt', 'height', 'loading', 'src', 'title', 'width'],
      ol: ['start', 'type'],
      td: ['colspan', 'headers', 'rowspan'],
      th: ['abbr', 'colspan', 'headers', 'rowspan', 'scope'],
      time: ['datetime'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
    allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
    transformTags: {
      a: (tagName, attributes) => {
        if (attributes.target !== '_blank') return { tagName, attribs: attributes };

        const relValues = new Set((attributes.rel ?? '').split(/\s+/u).filter(Boolean));
        relValues.add('noopener');
        relValues.add('noreferrer');
        return {
          tagName,
          attribs: { ...attributes, rel: [...relValues].join(' ') },
        };
      },
    },
  });

  const outputResult = ssfHtmlSchema.safeParse(sanitized);
  if (!outputResult.success) {
    throw new SsfHtmlValidationError(
      `SSF HTML exceeds ${SSF_RUNTIME_LIMITS.htmlUtf8Bytes} UTF-8 bytes after sanitization.`
    );
  }

  return sanitized;
};
