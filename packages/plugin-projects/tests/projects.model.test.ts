import { describe, expect, it } from 'vitest';

import { normalizeProjectImages, normalizeProjectInput } from '../src/projects.model.js';
import { projectFormSchema } from '../src/projects.validation.js';

describe('project model', () => {
  it('trims free language and required text without restricting language values', () => {
    expect(
      normalizeProjectInput({
        language: '  x-kommunal  ',
        title: '  Titel ',
        description: ' Kurz ',
        fullText: ' <p>Text</p> ',
        images: [],
        status: 'draft',
        author: { type: 'organization', id: ' org-1 ', displayName: ' Gemeinde ' },
      })
    ).toEqual({
      language: 'x-kommunal',
      title: 'Titel',
      description: 'Kurz',
      fullText: '<p>Text</p>',
      images: [],
      status: 'draft',
      author: { type: 'organization', id: 'org-1', displayName: 'Gemeinde' },
    });
  });

  it('normalizes image positions and optional metadata', () => {
    expect(
      normalizeProjectImages([
        { url: ' a ', altText: ' A ', position: 9 },
        { url: 'b', altText: 'B', caption: ' ', credits: ' C ', position: 4 },
      ])
    ).toEqual([
      { url: 'a', altText: 'A', position: 0 },
      { url: 'b', altText: 'B', credits: 'C', position: 1 },
    ]);
  });

  it('accepts optional language and text fields while rejecting required identity and image metadata', () => {
    const result = projectFormSchema.safeParse({
      language: '',
      title: '',
      description: '',
      fullText: '',
      images: [{ url: 'https://example.test/image.jpg', altText: '', position: 0 }],
      status: 'published',
      author: { type: 'person', id: '', displayName: '' },
    });
    expect(result.success).toBe(false);
    expect(
      projectFormSchema.safeParse({
        language: '',
        title: 'Projekt',
        description: '',
        fullText: '',
        images: [],
        status: 'draft',
        author: { type: 'organization', id: 'org-1', displayName: 'Gemeinde' },
      }).success
    ).toBe(true);
  });

  it('rejects non-contiguous input positions', () => {
    const result = projectFormSchema.safeParse({
      language: 'de',
      title: 'Titel',
      description: 'Kurz',
      fullText: '<p>Text</p>',
      images: [{ url: 'https://example.test/image.jpg', altText: 'Bild', position: 2 }],
      status: 'draft',
      author: { type: 'organization', id: 'org-1', displayName: 'Gemeinde' },
    });
    expect(result.success).toBe(false);
  });
});
