import { describe, expect, it } from 'vitest';

import { parseFilterStateFromSearchParams, stringifyFilterStateToSearchParams } from './url-state';

describe('url state', () => {
  it('falls back to defaults for invalid params', () => {
    const state = parseFilterStateFromSearchParams(new URLSearchParams('view=invalid&status=bogus&q=test'));

    expect(state).toEqual({
      view: 'milestones',
      milestone: 'all',
      status: 'all',
      health: 'all',
      priority: 'all',
      q: 'test',
    });
  });

  it('serializes only non-default filter params', () => {
    const params = stringifyFilterStateToSearchParams({
      view: 'work-packages',
      milestone: 'M2',
      status: 'implementation',
      health: 'all',
      priority: 'must',
      q: '',
    });

    expect(params.toString()).toBe('view=work-packages&milestone=M2&status=implementation&priority=must');
  });
});
