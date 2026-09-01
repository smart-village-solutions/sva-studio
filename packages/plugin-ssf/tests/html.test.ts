import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { sanitizeSsfHtmlV1 } from '../src/runtime.js';

describe('sanitizeSsfHtmlV1', () => {
  it('keeps semantic content, styles and external HTTP images', () => {
    const result = sanitizeSsfHtmlV1(
      '<section class="intro" style="color: red"><h2>Hallo</h2><img src="https://example.org/a.png" alt="A"></section>'
    );

    expect(result).toContain('<section class="intro" style="color:red">');
    expect(result).toContain('<img src="https://example.org/a.png" alt="A" />');
  });

  it('removes executable elements, event handlers and dangerous schemes', () => {
    const result = sanitizeSsfHtmlV1(
      '<script>alert(1)</script><p onclick="alert(2)">Text</p><a href="javascript:alert(3)">Link</a><img src="data:image/png;base64,x" onerror="alert(4)">'
    );

    expect(result).toBe('<p>Text</p><a>Link</a><img />');
  });

  it('never retains injected script containers, event handlers or javascript URLs', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (payload) => {
        const result = sanitizeSsfHtmlV1(
          `<script>${payload}</script><img src="javascript:${payload}" onerror="${payload}"><p>${payload}</p>`
        ).toLowerCase();
        expect(result).not.toContain('<script');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('javascript:');
      }),
      { numRuns: 100 }
    );
  });
});
