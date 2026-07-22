import { describe, expect, it } from 'vitest';

import {
  createTourAssignmentSelectionSummary,
  orderTourAssignmentLocations,
} from '../src/waste-management.tours.view-model.js';

describe('createTourAssignmentSelectionSummary', () => {
  it.each([
    [[], [], false, false, 0],
    [['one', 'two'], ['one', 'two'], true, true, 0],
    [['one'], ['hidden'], false, false, 1],
    [[], ['hidden'], false, false, 1],
  ])(
    'summarizes visible and hidden selections',
    (
      filteredLocationIds,
      selectedLocationIds,
      allVisibleSelected,
      someVisibleSelected,
      hiddenSelectedCount
    ) => {
      expect(
        createTourAssignmentSelectionSummary({ filteredLocationIds, selectedLocationIds })
      ).toMatchObject({
        allVisibleSelected,
        someVisibleSelected,
        hiddenSelectedCount,
      });
    }
  );
});

describe('orderTourAssignmentLocations', () => {
  it('places selected locations first while preserving each group order', () => {
    expect(
      orderTourAssignmentLocations(
        [
          { id: 'one', label: 'One' },
          { id: 'two', label: 'Two' },
          { id: 'three', label: 'Three' },
          { id: 'four', label: 'Four' },
        ],
        ['three', 'one']
      )
    ).toEqual([
      { id: 'one', label: 'One' },
      { id: 'three', label: 'Three' },
      { id: 'two', label: 'Two' },
      { id: 'four', label: 'Four' },
    ]);
  });
});
