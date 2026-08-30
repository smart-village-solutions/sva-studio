import { describe, expect, it } from 'vitest';

import {
  createStudioMediaPickerLabels,
  resolveStudioMediaPickerFeedback,
} from './studio-media-picker-config.js';

const translate = (key: string) => `translated:${key}`;

describe('studio media picker configuration', () => {
  it('creates the canonical label structure with one proven title-field variant', () => {
    expect(createStudioMediaPickerLabels(translate).fields.title).toBe('translated:fields.title');
    expect(
      createStudioMediaPickerLabels(translate, { titleFieldKey: 'fields.name' }).fields.title
    ).toBe('translated:fields.name');
    expect(createStudioMediaPickerLabels(translate).actions.useMedia).toBe(
      'translated:messages.mediaPickerUseMedia'
    );
  });

  it('maps technical errors before upload phases and preserves neutral idle feedback', () => {
    expect(resolveStudioMediaPickerFeedback(translate, 'asset_unavailable', 'success')).toEqual({
      message: 'translated:messages.mediaUploadUnavailableUrl',
      tone: 'error',
    });
    expect(resolveStudioMediaPickerFeedback(translate, null, 'success')).toEqual({
      message: 'translated:messages.mediaUploadSuccess',
      tone: 'success',
    });
    expect(resolveStudioMediaPickerFeedback(translate, null, 'idle')).toEqual({
      message: null,
      tone: 'default',
    });
  });
});
