import { describe, expect, it } from 'vitest';

import { validateEventForm } from '../src/events.validation.js';

describe('validateEventForm', () => {
  it('accepts a minimal event', () => {
    expect(validateEventForm({ title: 'Stadtfest' })).toEqual([]);
  });

  it('requires a title and https urls', () => {
    expect(validateEventForm({ title: '', urls: [{ url: 'http://example.test' }] })).toEqual(['title', 'urls']);
  });
});
