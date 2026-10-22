import { describe, expect, it } from 'vitest';
import {
  createMediaEditingDocument,
  getMediaEditingResources,
  parseMediaEditingDocument,
} from './media.editing.js';

describe('portable media editing documents', () => {
  it('preserves independent objects, filters and geometry without transient source handles', () => {
    const document = createMediaEditingDocument({
      imgSrc: 'blob:temporary',
      originalSource: {},
      presentOriginalSources: {},
      annotations: {
        label: { name: 'Text', text: 'https://example.org is text', x: 30, rotation: 12 },
      },
      annotationIds: ['label'],
      filter: 'Sepia',
      adjustments: { rotation: 90, isFlippedX: true },
    });
    expect(parseMediaEditingDocument(JSON.parse(JSON.stringify(document)))).toEqual(document);
    expect(document.state).not.toHaveProperty('imgSrc');
    expect(document.state.annotations).toEqual({
      label: { name: 'Text', text: 'https://example.org is text', x: 30, rotation: 12 },
    });
  });

  it.each([
    'https://tracker.example/image.png',
    'blob:lost',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=',
  ])('rejects non-portable or active resources: %s', (image) => {
    expect(() =>
      createMediaEditingDocument({ annotations: { a: { name: 'Image', image } } })
    ).toThrow('invalid_media_editor_document');
  });

  it('keeps bounded inline raster resources available for server scanning', () => {
    const image = 'data:image/png;base64,aGVsbG8=';
    const document = createMediaEditingDocument({
      annotations: { a: { image }, b: { image } },
      annotationIds: ['a', 'b'],
    });
    expect(getMediaEditingResources(document)).toEqual([image]);
    expect(() => createMediaEditingDocument({ annotations: { a: { image: {} } } })).toThrow();
  });

  it('rejects incompatible envelopes, unbounded values and unsupported root fields', () => {
    const document = createMediaEditingDocument({});
    expect(() => parseMediaEditingDocument({ ...document, editorVersion: 'next' })).toThrow();
    expect(() => createMediaEditingDocument({ annotations: { a: { x: Infinity } } })).toThrow();
    expect(() => createMediaEditingDocument({ unknown: true })).toThrow();
    expect(() =>
      createMediaEditingDocument({
        annotations: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [i, {}])),
      })
    ).toThrow();
    expect(() =>
      createMediaEditingDocument({ annotations: JSON.parse('{"__proto__": {"polluted":true}}') })
    ).toThrow();
  });
});
