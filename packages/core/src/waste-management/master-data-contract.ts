const wasteDateShiftReasonTypes = [
  'holiday',
  'global-deviation',
  'manual-adjustment',
  'operational-disruption',
  'weather',
  'other',
] as const;

const wasteTourDateShiftFollowUpModes = ['none', 'propagate-series', 'mark-follow-up-dates'] as const;

export type WasteDateShiftReasonType = (typeof wasteDateShiftReasonTypes)[number];
export type WasteTourDateShiftFollowUpMode = (typeof wasteTourDateShiftFollowUpModes)[number];

export const wasteManagementMasterDataContract = {
  dateShiftReasonTypes: wasteDateShiftReasonTypes,
  followUpModes: wasteTourDateShiftFollowUpModes,
  isDateShiftReasonType: (value: string): value is WasteDateShiftReasonType =>
    (wasteDateShiftReasonTypes as readonly string[]).includes(value),
  isTourDateShiftFollowUpMode: (value: string): value is WasteTourDateShiftFollowUpMode =>
    (wasteTourDateShiftFollowUpModes as readonly string[]).includes(value),
} as const;

export type WasteLocalizedTextRecord = Readonly<Record<string, string>>;
