import { convert } from 'html-to-text';

import { sanitizeRichTextHtml } from './rich-text-html.js';

export const convertRichTextHtmlToPlainText = (
  value: string,
  options: Readonly<{ includeLinkUrls?: boolean; unorderedListItemPrefix?: string }> = {}
): string =>
  convert(sanitizeRichTextHtml(value), {
    wordwrap: false,
    selectors: [
      {
        selector: 'a',
        options: { ignoreHref: options.includeLinkUrls === false },
      },
      { selector: 'img', format: 'skip' },
      { selector: 'ul', options: { itemPrefix: options.unorderedListItemPrefix ?? '- ' } },
    ],
  })
    .replace(/\r\n?/gu, '\n')
    .replace(/[ \t]+$/gmu, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
