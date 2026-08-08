import { describe, expect, it } from 'vitest';

import {
  resolveMainserverLifecycleAction,
  resolveMainserverVisibilityAction,
  toMainserverAdditionalActions,
} from './mutation-principal.js';

describe('Mainserver lifecycle authorization actions', () => {
  it('maps lifecycle transitions to their separate permissions', () => {
    expect(resolveMainserverLifecycleAction('draft', 'published')).toBe('content.publish');
    expect(resolveMainserverLifecycleAction('published', 'archived')).toBe('content.archive');
    expect(resolveMainserverLifecycleAction('archived', 'draft')).toBe('content.restore');
    expect(resolveMainserverLifecycleAction('published', 'draft')).toBe('content.changeStatus');
    expect(resolveMainserverLifecycleAction('draft', 'draft')).toBeUndefined();
  });

  it('maps visibility changes without inventing an action for unchanged state', () => {
    expect(resolveMainserverVisibilityAction(false, true)).toBe('content.publish');
    expect(resolveMainserverVisibilityAction(true, false)).toBe('content.changeStatus');
    expect(resolveMainserverVisibilityAction(true, true)).toBeUndefined();
    expect(resolveMainserverVisibilityAction(true, undefined)).toBeUndefined();
  });

  it('normalizes optional lifecycle actions for route authorization', () => {
    expect(toMainserverAdditionalActions('content.publish')).toEqual(['content.publish']);
    expect(toMainserverAdditionalActions(undefined)).toEqual([]);
  });
});
