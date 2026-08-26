import { describe, expect, it } from 'vitest';

import {
  addStudioDestructiveNavigationFeedback,
  readStudioDestructiveNavigationFeedback,
  removeStudioActionNavigationFeedback,
} from './studio-action-navigation-feedback.js';

describe('studio action navigation feedback', () => {
  it('binds destructive feedback to its resource and removes it after consumption', () => {
    const state = addStudioDestructiveNavigationFeedback({ preserved: true }, 'events', 'event-1');

    expect(readStudioDestructiveNavigationFeedback(state)).toEqual({
      kind: 'destructive-complete',
      resourceType: 'events',
      resourceId: 'event-1',
    });
    expect(removeStudioActionNavigationFeedback(state)).toEqual({
      preserved: true,
      studioActionFeedback: undefined,
    });
  });

  it('rejects malformed or unrelated navigation state', () => {
    expect(readStudioDestructiveNavigationFeedback(null)).toBeNull();
    expect(
      readStudioDestructiveNavigationFeedback({ studioActionFeedback: { kind: 'created' } })
    ).toBeNull();
  });
});
