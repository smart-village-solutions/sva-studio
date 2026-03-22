import { describe, expect, it } from 'vitest';

import {
  createContentTypeRegistry,
  genericContentTypeDefinition,
  getContentTypeDefinition,
} from '../src/content-types.js';

const GENERIC_CONTENT_TYPE = 'generic';

describe('content type registry', () => {
  it('registers and resolves content types', () => {
    const registry = createContentTypeRegistry([genericContentTypeDefinition]);

    expect(getContentTypeDefinition(registry, GENERIC_CONTENT_TYPE)).toMatchObject({
      contentType: GENERIC_CONTENT_TYPE,
      displayName: 'Generischer Inhalt',
    });
  });

  it('rejects invalid registrations', () => {
    expect(() =>
      createContentTypeRegistry([
        genericContentTypeDefinition,
        { ...genericContentTypeDefinition, displayName: 'Duplikat' },
      ])
    ).toThrow('duplicate_content_type:generic');

    expect(() =>
      createContentTypeRegistry([{ ...genericContentTypeDefinition, contentType: '   ' }])
    ).toThrow('invalid_content_type_definition');
  });
});
