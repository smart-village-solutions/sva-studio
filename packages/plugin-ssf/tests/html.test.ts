import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { sanitizeSsfHtmlV1 } from '../src/runtime.js';

describe('sanitizeSsfHtmlV1', () => {
  it('keeps semantic content and external HTTP images without author-controlled CSS hooks', () => {
    const result = sanitizeSsfHtmlV1(
      '<section id="intro" class="intro" style="position: fixed"><h2>Hallo</h2><img src="https://example.org/a.png" alt="A"></section>'
    );

    expect(result).toContain('<section><h2>Hallo</h2>');
    expect(result).not.toMatch(/\s(?:class|id|style)=/u);
    expect(result).toContain('<img src="https://example.org/a.png" alt="A" />');
  });

  it('removes executable elements, event handlers and dangerous schemes', () => {
    const result = sanitizeSsfHtmlV1(
      '<script>alert(1)</script><p onclick="alert(2)">Text</p><a href="javascript:alert(3)">Link</a><img src="data:image/png;base64,x" onerror="alert(4)">'
    );

    expect(result).toBe('<p>Text</p><a>Link</a><img />');
  });

  it('prevents tabnabbing for links that open a new browsing context', () => {
    const result = sanitizeSsfHtmlV1(
      '<a href="https://example.org" target="_blank" rel="external">Extern</a>'
    );

    expect(result).toBe(
      '<a href="https://example.org" target="_blank" rel="external noopener noreferrer">Extern</a>'
    );
  });

  it('never retains injected script containers, event handlers or javascript URLs', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (payload) => {
        const result = sanitizeSsfHtmlV1(
          `<script>${payload}</script><img src="javascript:${payload}" onerror="${payload}"><p>${payload}</p>`
        ).toLowerCase();
        expect(result).not.toContain('<script');
        expect(result).not.toMatch(/<[^>]*\sonerror\s*=/u);
        expect(result).not.toMatch(/<[^>]*\s(?:href|src)=["']javascript:/u);
      }),
      { numRuns: 100 }
    );
  });
});
