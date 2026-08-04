import { describe, expect, it, vi } from 'vitest';

import {
  collectSummaryErrors,
  readNestedFieldError,
  translateFieldError,
} from '../src/news.detail-content-tab.helpers.js';

describe('news detail content field helpers', () => {
  it('filters summary errors and translates string messages', () => {
    expect(collectSummaryErrors([{ summaryError: 'Fehler' }, { summaryError: undefined }])).toEqual(['Fehler']);
    const pt = vi.fn((key: string) => `translated:${key}`);
    expect(translateFieldError({ type: 'manual', message: 'required' }, pt)).toEqual({
      type: 'manual',
      message: 'translated:validation.required',
    });
    expect(translateFieldError(undefined, pt)).toBeUndefined();
    expect(translateFieldError({ type: 'manual' }, pt)).toEqual({ type: 'manual' });
  });

  it('accepts only nested field-error shaped objects', () => {
    expect(readNestedFieldError({ message: 'required' })).toEqual({ message: 'required' });
    expect(readNestedFieldError({ type: 'manual' })).toEqual({ type: 'manual' });
    expect(readNestedFieldError(null)).toBeUndefined();
    expect(readNestedFieldError([])).toBeUndefined();
    expect(readNestedFieldError({ value: true })).toBeUndefined();
  });
});
