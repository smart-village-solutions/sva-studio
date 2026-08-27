// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { sanitizeRichTextEditorHtml } from './rich-text-html-sanitizer.js';

describe('sanitizeRichTextEditorHtml', () => {
  it('keeps supported rich text while removing active markup', () => {
    expect(
      sanitizeRichTextEditorHtml(
        '<h2 onclick="alert(1)">Titel</h2><script>alert(1)</script>' +
          '<pre><code>const value = 1;</code></pre><p><s>Alt</s></p>' +
          '<a href="javascript:alert(1)">Unsicher</a>'
      )
    ).toBe(
      '<h2>Titel</h2><pre><code>const value = 1;</code></pre><p><s>Alt</s></p><a>Unsicher</a>'
    );
  });

  it('normalizes links and ordered-list start values', () => {
    expect(
      sanitizeRichTextEditorHtml(
        '<a href="https://example.org" target="_blank" rel="opener">Extern</a>' +
          '<a href="mailto:test@example.org">Mail</a>' +
          '<ol start="3"><li>Drei</li></ol><ol start="alert(1)"><li>Eins</li></ol>'
      )
    ).toBe(
      '<a href="https://example.org" target="_blank" rel="noopener noreferrer">Extern</a>' +
        '<a href="mailto:test@example.org">Mail</a>' +
        '<ol start="3"><li>Drei</li></ol><ol><li>Eins</li></ol>'
    );
  });
});
