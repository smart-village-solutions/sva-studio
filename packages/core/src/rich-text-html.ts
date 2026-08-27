import sanitizeHtml from 'sanitize-html';

const allowedTags = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
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
  'pre',
  's',
  'span',
  'strong',
  'u',
  'ul',
] as const;

export const sanitizeRichTextHtml = (value: string): string =>
  sanitizeHtml(value, {
    allowedTags: [...allowedTags],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
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
    },
  });
