import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { decodeBucketMediaId, encodeBucketMediaId } from './-media-ui.shared.js';

const mediaUiSharedSourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  './-media-ui.shared.tsx'
);

describe('bucket media id encoding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { label: 'no padding', storageKey: 'abc', encoded: 'YWJj' },
    { label: 'one padding character', storageKey: 'ab', encoded: 'YWI' },
    { label: 'two padding characters', storageKey: 'a', encoded: 'YQ' },
    { label: 'empty input', storageKey: '', encoded: '' },
    {
      label: 'Unicode input',
      storageKey: 'cms_uploads/äöü/straße und café.jpg',
      encoded: 'Y21zX3VwbG9hZHMvw6TDtsO8L3N0cmHDn2UgdW5kIGNhZsOpLmpwZw',
    },
  ])('keeps Node and the browser fallback byte-identical for $label', ({ storageKey, encoded }) => {
    const nodeMediaId = encodeBucketMediaId(storageKey);
    expect(nodeMediaId).toBe(`bucket:${encoded}`);
    expect(decodeBucketMediaId(nodeMediaId)).toBe(storageKey);

    const browserBtoa = vi.fn(globalThis.btoa.bind(globalThis));
    const browserAtob = vi.fn(globalThis.atob.bind(globalThis));
    vi.stubGlobal('Buffer', undefined);
    vi.stubGlobal('btoa', browserBtoa);
    vi.stubGlobal('atob', browserAtob);

    const browserMediaId = encodeBucketMediaId(storageKey);
    expect(browserMediaId).toBe(nodeMediaId);
    expect(decodeBucketMediaId(browserMediaId)).toBe(storageKey);
    expect(browserBtoa).toHaveBeenCalledOnce();
    expect(browserAtob).toHaveBeenCalledOnce();
  });

  it('keeps a very long mixed storage key byte-identical in the browser fallback', () => {
    const storageKey = `${'cms/._-ä/'.repeat(10_000)}final image.jpg`;
    const nodeMediaId = encodeBucketMediaId(storageKey);

    vi.stubGlobal('Buffer', undefined);

    expect(encodeBucketMediaId(storageKey)).toBe(nodeMediaId);
    expect(decodeBucketMediaId(nodeMediaId)).toBe(storageKey);
  });

  it('round-trips non-ascii storage keys', () => {
    const storageKey = 'cms_uploads/äöü/straße und café.jpg';

    const encoded = encodeBucketMediaId(storageKey);

    expect(decodeBucketMediaId(encoded)).toBe(storageKey);
  });

  it('avoids legacy char-code and regex replacement helpers in the base64url fallback', () => {
    const source = fs.readFileSync(mediaUiSharedSourcePath, 'utf8');

    expect(source).not.toContain('String.fromCharCode');
    expect(source).not.toContain('.charCodeAt(');
    expect(source).not.toContain('.replace(/\\+/g,');
    expect(source).not.toContain('.replace(/\\//g,');
    expect(source).not.toContain('.replace(/=+$/g,');
  });
});
