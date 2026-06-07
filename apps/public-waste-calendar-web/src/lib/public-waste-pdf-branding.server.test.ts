import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadPublicWastePdfBrandingImage } from './public-waste-pdf-branding.server.js';

describe('public waste pdf branding image loader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a remote svg into raw rgb image data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#0f62fe"/></svg>',
          {
            status: 200,
            headers: {
              'content-type': 'image/svg+xml',
            },
          }
        )
      )
    );

    const result = await loadPublicWastePdfBrandingImage('https://cdn.example/logo.svg');

    expect(result).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(result?.rgbData.length).toBe((result?.width ?? 0) * (result?.height ?? 0) * 3);
  });

  it('returns undefined when the asset cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(loadPublicWastePdfBrandingImage('https://cdn.example/missing.svg')).resolves.toBeUndefined();
  });
});
