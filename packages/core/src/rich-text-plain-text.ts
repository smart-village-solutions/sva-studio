import { convert } from 'html-to-text';

import { sanitizeRichTextHtml } from './rich-text-html.js';

const trimLineEnd = (line: string): string => {
  let end = line.length;
  while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t')) end--;
  return line.slice(0, end);
};

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
    .split('\n')
    .map(trimLineEnd)
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
