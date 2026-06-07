import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lookupMock = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({
  __esModule: true,
  lookup: lookupMock,
  default: {
    lookup: lookupMock,
  },
}));

import { loadPublicWastePdfBrandingImage } from './public-waste-pdf-branding.server.js';

describe('public waste pdf branding image loader', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

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

  it('rejects non-https branding assets before fetching them', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadPublicWastePdfBrandingImage('http://cdn.example/logo.svg')).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects branding hosts that resolve to private network addresses', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    lookupMock.mockResolvedValue([{ address: '10.0.0.42', family: 4 }]);

    await expect(loadPublicWastePdfBrandingImage('https://assets.internal.example/logo.svg')).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects oversized branding assets via content-length before decoding', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('too large', {
        status: 200,
        headers: {
          'content-length': String(2 * 1024 * 1024 + 1),
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadPublicWastePdfBrandingImage('https://cdn.example/logo.svg')).resolves.toBeUndefined();
  });
});
