import { describe, expect, it } from 'vitest';

import { joinSchedulingMetaItems } from '../src/waste-management.scheduling-table-meta.js';

describe('joinSchedulingMetaItems', () => {
  it('trims values and omits empty or whitespace-only items', () => {
    expect(joinSchedulingMetaItems([' Status: aktiv ', '', '   ', 'Jahr: 2026'])).toBe(
      'Status: aktiv · Jahr: 2026'
    );
  });
});
