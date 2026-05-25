import { describe, expect, it } from 'vitest';

import { diffAssignments } from './assignment-diff.js';

describe('assignment-diff', () => {
  it('keeps unchanged ids and isolates inserts and deletes', () => {
    expect(diffAssignments(['role-2', 'role-1'], ['role-1', 'role-3'])).toEqual({
      keepIds: ['role-1'],
      insertIds: ['role-3'],
      deleteIds: ['role-2'],
    });
  });

  it('deduplicates repeated ids on both sides', () => {
    expect(diffAssignments(['group-1', 'group-1'], ['group-1', 'group-2', 'group-2'])).toEqual({
      keepIds: ['group-1'],
      insertIds: ['group-2'],
      deleteIds: [],
    });
  });
});
