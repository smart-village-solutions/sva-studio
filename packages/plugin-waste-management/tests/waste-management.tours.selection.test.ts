import { describe, expect, it } from 'vitest';

import { createWasteToursSelectionSummary } from '../src/waste-management.tours.view-model.js';

describe('waste-management tour selection', () => {
  it('keeps selected tours outside the current filter visible in the summary', () => {
    expect(
      createWasteToursSelectionSummary({
        filteredTourIds: ['tour-1', 'tour-2'],
        selectedTourIds: ['tour-1', 'tour-3'],
      })
    ).toEqual({
      allFilteredSelected: false,
      someFilteredSelected: true,
      hiddenSelectedCount: 1,
    });
  });

  it('recognizes an explicit selection of every filtered result', () => {
    expect(
      createWasteToursSelectionSummary({
        filteredTourIds: ['tour-1', 'tour-2'],
        selectedTourIds: ['tour-1', 'tour-2', 'tour-3'],
      })
    ).toEqual({
      allFilteredSelected: true,
      someFilteredSelected: true,
      hiddenSelectedCount: 1,
    });
  });
});
