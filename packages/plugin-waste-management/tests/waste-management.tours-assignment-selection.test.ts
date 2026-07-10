import { describe, expect, it } from 'vitest';

import { createTourAssignmentSelectionSummary } from '../src/waste-management.tours.view-model.js';

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
