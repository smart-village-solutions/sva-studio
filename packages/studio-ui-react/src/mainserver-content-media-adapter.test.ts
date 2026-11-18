import { describe, expect, it } from 'vitest';
import {
  contentMediaUsagesToMainserver,
  mainserverContentMediaToUsages,
} from './mainserver-content-media-adapter.js';

describe('mainserver content media adapter', () => {
  it('preserves dimensions and unknown fields across a roundtrip', () => {
    const source = [
      {
        captionText: 'Bild',
        copyright: 'Stadt',
        contentType: 'image',
        width: 640,
        height: '480',
        custom: { retained: true },
        sourceUrl: {
          url: 'https://cdn.example.test/image.jpg',
          description: 'Alt',
          customSource: 'kept',
        },
      },
    ];
    const result = contentMediaUsagesToMainserver(mainserverContentMediaToUsages(source));
    expect(result).toEqual(source);
  });

  it.each([{ x: 0.2, y: 0.8 }, null])(
    'passes focus metadata without changing the image URL or other payload values: %j',
    (focusPoint) => {
      const [usage] = mainserverContentMediaToUsages([
        { payload: { retained: true }, sourceUrl: { url: 'https://cdn.example.test/image.jpg' } },
      ]);
      expect(contentMediaUsagesToMainserver([{ ...usage!, focusPoint }])[0]).toMatchObject({
        payload: { retained: true, focusPoint },
        sourceUrl: { url: 'https://cdn.example.test/image.jpg' },
      });
    }
  );

  it('aligns the gallery role and asset id by order', () => {
    const [usage] = mainserverContentMediaToUsages(
      [{ sourceUrl: { url: 'https://cdn.example.test/image.jpg' } }],
      [{ assetId: 'asset-1', status: 'synced' }]
    );
    expect(usage).toMatchObject({
      assetId: 'asset-1',
      role: 'gallery_item',
      sortOrder: 0,
      referenceStatus: 'synced',
    });
  });

  it('uses safe defaults for sparse media and preserves supported scalar dimensions only', () => {
    const [usage] = mainserverContentMediaToUsages([{}], [{ status: 'missing' }], 'hero');
    expect(usage).toMatchObject({
      persistentUrl: '',
      altText: '',
      caption: '',
      credit: '',
      role: 'hero',
      referenceStatus: 'missing',
    });
    expect(
      contentMediaUsagesToMainserver([
        {
          ...usage!,
          additionalData: { original: null, contentType: 12, width: null, height: false },
        },
      ])
    ).toEqual([
      {
        captionText: '',
        copyright: '',
        contentType: undefined,
        width: undefined,
        height: undefined,
        sourceUrl: { url: '', description: '' },
      },
    ]);
  });
});
