import { describe, expect, it } from 'vitest';

import { wasteManagementMasterDataContract } from './waste-management-master-data.js';

describe('waste-management-master-data', () => {
  it('defines stable explicit date-shift reasons', () => {
    expect(wasteManagementMasterDataContract.dateShiftReasonTypes).toEqual([
      'holiday',
      'global-deviation',
      'manual-adjustment',
      'operational-disruption',
      'weather',
      'other',
    ]);
    expect(wasteManagementMasterDataContract.isDateShiftReasonType('holiday')).toBe(true);
    expect(wasteManagementMasterDataContract.isDateShiftReasonType('free-text')).toBe(false);
  });

  it('defines explicit follow-up modes for single shift effects', () => {
    expect(wasteManagementMasterDataContract.followUpModes).toEqual([
      'none',
      'propagate-series',
      'mark-follow-up-dates',
    ]);
    expect(wasteManagementMasterDataContract.isTourDateShiftFollowUpMode('propagate-series')).toBe(true);
    expect(wasteManagementMasterDataContract.isTourDateShiftFollowUpMode('implicit')).toBe(false);
  });
});
