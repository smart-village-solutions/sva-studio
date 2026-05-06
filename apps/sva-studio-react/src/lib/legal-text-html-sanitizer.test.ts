import { describe, expect, it } from 'vitest';

import { sanitizeLegalTextHtml } from './legal-text-html-sanitizer';

describe('sanitizeLegalTextHtml', () => {
  it('removes disallowed tags and preserves safe links', () => {
    expect(
      sanitizeLegalTextHtml(
        '<p>Hallo</p><script>alert(1)</script><a href="https://example.com" target="_blank">Link</a>'
      )
    ).toBe('<p>Hallo</p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>');
  });

  it('strips unsafe href values and inline event handlers', () => {
    expect(
      sanitizeLegalTextHtml(
        '<p onclick="alert(1)">Text</p><a href="javascript:alert(1)" target="_blank" rel="nofollow">Böse</a>'
      )
    ).toBe('<p>Text</p><a target="_blank" rel="noopener noreferrer">Böse</a>');
  });

  it('keeps relative links and falls back to an empty paragraph for empty content', () => {
    expect(sanitizeLegalTextHtml('<a href="/hilfe">Hilfe</a>')).toBe('<a href="/hilfe">Hilfe</a>');
    expect(sanitizeLegalTextHtml('<script>alert(1)</script>')).toBe('<p></p>');
  });
});
