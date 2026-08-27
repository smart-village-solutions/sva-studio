import { describe, expect, it } from 'vitest';

import { sanitizeRichTextHtml } from './rich-text-html.js';

describe('sanitizeRichTextHtml', () => {
  it('keeps supported editorial markup and removes executable content', () => {
    expect(
      sanitizeRichTextHtml(
        '<h2>Überschrift</h2><p onclick="alert(1)">Text <strong>fett</strong></p><script>alert(1)</script>'
      )
    ).toBe('<h2>Überschrift</h2><p>Text <strong>fett</strong></p>');
  });

  it('allows safe links and removes unsafe protocols and attributes', () => {
    expect(
      sanitizeRichTextHtml(
        '<a href="https://example.com" target="_blank" onclick="alert(1)">Sicher</a>' +
          '<a href="javascript:alert(1)">Unsicher</a>'
      )
    ).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Sicher</a>' +
        '<a>Unsicher</a>'
    );
  });
});
