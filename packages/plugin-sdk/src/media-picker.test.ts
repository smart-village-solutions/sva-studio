import { describe, expect, it } from 'vitest';

import { defineMediaPickerDefinition } from './media-picker.js';

describe('defineMediaPickerDefinition', () => {
  it('defaults the selection mode to single', () => {
    expect(
      defineMediaPickerDefinition({
        roles: ['hero_image'],
        allowedMediaTypes: ['image'],
      })
    ).toEqual({
      roles: ['hero_image'],
      allowedMediaTypes: ['image'],
      selectionMode: 'single',
    });
  });

  it('keeps an explicit multiple selection mode', () => {
    expect(
      defineMediaPickerDefinition({
        roles: ['gallery'],
        allowedMediaTypes: ['image'],
        selectionMode: 'multiple',
      })
    ).toEqual({
      roles: ['gallery'],
      allowedMediaTypes: ['image'],
      selectionMode: 'multiple',
    });
  });

  it('rejects empty or blank roles', () => {
    expect(() =>
      defineMediaPickerDefinition({
        roles: [],
        allowedMediaTypes: ['image'],
      })
    ).toThrow('invalid_media_picker_roles');

    expect(() =>
      defineMediaPickerDefinition({
        roles: ['   '],
        allowedMediaTypes: ['image'],
      })
    ).toThrow('invalid_media_picker_roles');
  });

  it('rejects duplicate normalized roles', () => {
    expect(() =>
      defineMediaPickerDefinition({
        roles: ['editor', ' editor '],
        allowedMediaTypes: ['image'],
      })
    ).toThrow('duplicate_media_picker_role:editor');
  });

  it('rejects empty or blank media types', () => {
    expect(() =>
      defineMediaPickerDefinition({
        roles: ['hero_image'],
        allowedMediaTypes: [],
      })
    ).toThrow('invalid_media_picker_media_types');

    expect(() =>
      defineMediaPickerDefinition({
        roles: ['hero_image'],
        allowedMediaTypes: ['   '],
      })
    ).toThrow('invalid_media_picker_media_types');
  });
});
