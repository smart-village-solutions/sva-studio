import {
  IAM_DELETED_CONTENT_AUTHOR_TOKEN,
  IAM_PSEUDONYMIZED_CONTENT_AUTHOR_TOKEN,
} from '@sva/core';
import { describe, expect, it } from 'vitest';

import { formatContentAuthor } from './content-author';

describe('formatContentAuthor', () => {
  it('translates the pseudonymized author token', () => {
    expect(formatContentAuthor(IAM_PSEUDONYMIZED_CONTENT_AUTHOR_TOKEN)).toBe('Pseudonymisiert');
  });

  it('translates the deleted author token', () => {
    expect(formatContentAuthor(IAM_DELETED_CONTENT_AUTHOR_TOKEN)).toBe('Gelöscht');
  });

  it('keeps regular author names unchanged', () => {
    expect(formatContentAuthor('Editor')).toBe('Editor');
  });
});
