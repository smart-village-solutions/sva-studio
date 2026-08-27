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

  it('keeps the code and strike markup enabled by StarterKit', () => {
    expect(sanitizeRichTextHtml('<pre><code>const value = 1;</code></pre><p><s>Alt</s></p>')).toBe(
      '<pre><code>const value = 1;</code></pre><p><s>Alt</s></p>'
    );
  });

  it('keeps numeric ordered-list start values and removes invalid values', () => {
    expect(
      sanitizeRichTextHtml('<ol start="3"><li>Drei</li></ol><ol start="alert(1)"><li>Eins</li></ol>')
    ).toBe('<ol start="3"><li>Drei</li></ol><ol><li>Eins</li></ol>');
  });
});
