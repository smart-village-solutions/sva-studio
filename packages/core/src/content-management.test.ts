import { describe, expect, it } from 'vitest';

import {
  GENERIC_CONTENT_TYPE,
  isContentJsonValue,
  isIamContentStatus,
  validateCreateIamContentInput,
} from './content-management.js';

describe('content-management core contract', () => {
  it('accepts known content statuses', () => {
    expect(isIamContentStatus('draft')).toBe(true);
    expect(isIamContentStatus('published')).toBe(true);
    expect(isIamContentStatus('unknown')).toBe(false);
  });

  it('accepts only JSON-compatible payload values', () => {
    expect(isContentJsonValue({ nested: ['ok', 1, true, null] })).toBe(true);
    expect(isContentJsonValue(new Date())).toBe(false);
    expect(isContentJsonValue({ bad: undefined })).toBe(false);
  });

  it('validates required content input fields', () => {
    expect(
      validateCreateIamContentInput(
        {
          contentType: GENERIC_CONTENT_TYPE,
          title: 'Startseite',
          status: 'draft',
          payload: { body: 'Hallo' },
        },
        [GENERIC_CONTENT_TYPE]
      )
    ).toEqual([]);

    expect(
      validateCreateIamContentInput(
        {
          contentType: '',
          title: '  ',
          status: 'published',
          payload: undefined,
        },
        [GENERIC_CONTENT_TYPE]
      )
    ).toEqual(['contentType', 'title', 'payload', 'publishedAt']);
  });
});
