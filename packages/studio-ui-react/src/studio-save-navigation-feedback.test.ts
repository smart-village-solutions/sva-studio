import { describe, expect, it } from 'vitest';

import {
  addStudioCreatedSaveFeedback,
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
} from './studio-save-navigation-feedback.js';

describe('studio save navigation feedback', () => {
  it('binds created feedback to resource type and id', () => {
    const state = addStudioCreatedSaveFeedback({ preserved: true }, 'news', 'news-1');

    expect(hasStudioCreatedSaveFeedback(state, 'news', 'news-1')).toBe(true);
    expect(hasStudioCreatedSaveFeedback(state, 'event', 'news-1')).toBe(false);
    expect(hasStudioCreatedSaveFeedback(state, 'news', 'news-2')).toBe(false);
    expect(state.preserved).toBe(true);
  });

  it('consumes feedback without removing unrelated router state', () => {
    const state = removeStudioSaveFeedback(
      addStudioCreatedSaveFeedback({ preserved: true }, 'news', 'news-1')
    );

    expect(hasStudioCreatedSaveFeedback(state, 'news', 'news-1')).toBe(false);
    expect(state.preserved).toBe(true);
  });
});
