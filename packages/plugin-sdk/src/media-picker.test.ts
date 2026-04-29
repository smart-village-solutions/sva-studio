import { describe, expect, it } from 'vitest';

import { defineMediaPickerDefinition } from './media-picker.js';

describe('defineMediaPickerDefinition', () => {
  it('normalizes a single-role picker contract', () => {
    expect(
      defineMediaPickerDefinition({
        roles: ['teaser_image'],
        allowedMediaTypes: ['image'],
      })
    ).toEqual({
      selectionMode: 'single',
      roles: ['teaser_image'],
      allowedMediaTypes: ['image'],
    });
  });

  it('rejects duplicate media roles', () => {
    expect(() =>
      defineMediaPickerDefinition({
        roles: ['teaser_image', 'teaser_image'],
        allowedMediaTypes: ['image'],
      })
    ).toThrow('duplicate_media_picker_role:teaser_image');
  });

  it('rejects an empty role list', () => {
    expect(() =>
      defineMediaPickerDefinition({
        roles: [],
        allowedMediaTypes: ['image'],
      })
    ).toThrow('invalid_media_picker_roles');
  });
});
