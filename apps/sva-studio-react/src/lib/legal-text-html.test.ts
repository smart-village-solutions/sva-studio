import { describe, expect, it } from 'vitest';

import { sanitizeLegalTextHtml } from './legal-text-html';

describe('sanitizeLegalTextHtml', () => {
  it('removes scripts and keeps allowed markup', () => {
    expect(sanitizeLegalTextHtml('<p>Hello</p><script>alert(1)</script><strong>World</strong>')).toBe(
      '<p>Hello</p><strong>World</strong>'
    );
  });

  it('normalizes blank target links with safe rel attributes', () => {
    expect(sanitizeLegalTextHtml('<a href="https://example.org" target="_blank">Link</a>')).toBe(
      '<a href="https://example.org" target="_blank" rel="noopener noreferrer">Link</a>'
    );
  });

  it('removes disallowed href schemes', () => {
    expect(sanitizeLegalTextHtml('<a href="javascript:alert(1)">Unsafe</a>')).toBe('<a>Unsafe</a>');
  });
});
