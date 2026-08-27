import sanitizeHtml from 'sanitize-html';

import { RICH_TEXT_ALLOWED_SCHEMES, RICH_TEXT_ALLOWED_TAGS } from './rich-text-html-policy.js';

export const sanitizeRichTextHtml = (value: string): string =>
  sanitizeHtml(value, {
    allowedTags: [...RICH_TEXT_ALLOWED_TAGS],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      ol: ['start'],
    },
    allowedSchemes: [...RICH_TEXT_ALLOWED_SCHEMES],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attributes) => ({
        tagName,
        attribs: {
          ...(attributes.href ? { href: attributes.href } : {}),
          ...(attributes.target === '_blank'
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {}),
        },
      }),
      ol: (tagName, attributes) => {
        const attribs: Record<string, string> = {};
        const start = attributes.start;
        if (start && /^-?\d+$/.test(start)) {
          attribs.start = start;
        }
        return { tagName, attribs };
      },
    },
  });
