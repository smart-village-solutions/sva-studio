import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { decodeBucketMediaId, encodeBucketMediaId } from './-media-ui.shared.js';

const mediaUiSharedSourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  './-media-ui.shared.tsx'
);

describe('bucket media id encoding', () => {
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
  });
});
