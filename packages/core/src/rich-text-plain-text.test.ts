import { describe, expect, it } from 'vitest';

import { convertRichTextHtmlToPlainText } from './rich-text-plain-text.js';

describe('convertRichTextHtmlToPlainText', () => {
  it('preserves semantic text structure and safe link targets', () => {
    expect(
      convertRichTextHtmlToPlainText(
        '<p>Bitte <strong>bereitstellen</strong>.</p><ul><li>Am Vorabend</li><li>Ab 6 Uhr</li></ul><p><a href="https://example.org/info">Weitere Hinweise</a></p>'
      )
    ).toBe(
      [
        'Bitte bereitstellen.',
        '',
        '- Am Vorabend',
        '- Ab 6 Uhr',
        '',
        'Weitere Hinweise [https://example.org/info]',
      ].join('\n')
    );
  });

  it('removes executable content and unsafe link targets', () => {
    expect(
      convertRichTextHtmlToPlainText(
        '<p onclick="alert(1)">Sicher</p><a href="javascript:alert(2)">Link</a><script>alert(3)</script>'
      )
    ).toBe('Sicher\n\nLink');
  });

  it('can omit link targets for compact output channels', () => {
    expect(
      convertRichTextHtmlToPlainText('<a href="https://example.org/info">Weitere Hinweise</a>', {
        includeLinkUrls: false,
      })
    ).toBe('Weitere Hinweise');
  });
});
