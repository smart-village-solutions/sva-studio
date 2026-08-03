import { describe, expect, it } from 'vitest';
import { mergeReconcileResults } from './service-module-mutations.js';

describe('mergeReconcileResults', () => {
  it('returns an empty summary when no reconcile results exist', () => {
    expect(mergeReconcileResults()).toEqual({
      permissionsInserted: 0,
      permissionsUpdated: 0,
      permissionsUnchanged: 0,
      grantsInserted: 0,
      grantsUnchanged: 0,
    });
  });
});
