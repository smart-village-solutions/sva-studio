import { describe, expect, it } from 'vitest';

import { hashLegalTextHtml, sanitizeLegalTextHtml } from './iam-legal-texts/html.js';

describe('iam legal texts html sanitization', () => {
  it('removes script blocks including closing tags with whitespace', () => {
    expect(sanitizeLegalTextHtml('<p>Intro</p><script type="text/javascript">alert(1)</script   ><p>Outro</p>')).toBe(
      '<p>Intro</p><p>Outro</p>'
    );
  });

  it('removes inline event handlers and neutralizes javascript urls', () => {
    expect(
      sanitizeLegalTextHtml(
        '<a href=" javascript:alert(1)" onclick="alert(1)" onmouseover=\'next()\' data-id="1">Link</a><img src=javascript:alert(1) onerror="boom">'
      )
    ).toBe('<a>Link</a>');
  });

  it('falls back to an empty paragraph when the content becomes empty', () => {
    expect(sanitizeLegalTextHtml('<script>alert(1)</script>')).toBe('<p></p>');
  });

  it('keeps allowed markup and http links', () => {
    expect(
      sanitizeLegalTextHtml('<p>Hallo <strong>Welt</strong> <a href="https://example.com" target="_blank" rel="noreferrer">Link</a></p>')
    ).toBe('<p>Hallo <strong>Welt</strong> <a href="https://example.com" target="_blank" rel="noreferrer">Link</a></p>');
  });

  it('hashes html content deterministically', () => {
    expect(hashLegalTextHtml('<p>Hallo</p>')).toBe('sha256:e78a4d51c4f2f4e6b38fe640173b6e104c331be298029910951fa2fd751489be');
  });
});
