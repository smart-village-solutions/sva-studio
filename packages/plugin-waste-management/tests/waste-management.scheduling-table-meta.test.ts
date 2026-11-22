import { describe, expect, it } from 'vitest';

import {
  formatSchedulingDisplayDate,
  joinSchedulingMetaItems,
} from '../src/waste-management.scheduling-table-meta.js';

describe('joinSchedulingMetaItems', () => {
  it('trims values and omits empty or whitespace-only items', () => {
    expect(joinSchedulingMetaItems([' Status: aktiv ', '', '   ', 'Jahr: 2026'])).toBe(
      'Status: aktiv · Jahr: 2026'
    );
  });
});

describe('formatSchedulingDisplayDate', () => {
  it('shows German calendar dates with both day and month padded', () => {
    const previousLang = document.documentElement.lang;
    document.documentElement.lang = 'de';
    try {
      expect(formatSchedulingDisplayDate('2027-02-04')).toBe('04.02.2027');
      expect(formatSchedulingDisplayDate('2027-02-13')).toBe('13.02.2027');
    } finally {
      document.documentElement.lang = previousLang;
    }
  });
});
