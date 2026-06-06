const wasteDateShiftReasonTypes = [
  'holiday',
  'global-deviation',
  'manual-adjustment',
  'operational-disruption',
  'weather',
  'other',
] as const;

const wasteTourDateShiftFollowUpModes = ['none', 'propagate-series', 'mark-follow-up-dates'] as const;
const wasteFractionReminderCounts = ['none', 'once', 'twice'] as const;
const wasteHolidayStateCodes = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'] as const;
const wasteHolidayRuleScopes = ['holiday-only', 'full-week'] as const;
const wasteHolidayRuleStrategies = ['advance', 'postpone'] as const;

export type WasteDateShiftReasonType = (typeof wasteDateShiftReasonTypes)[number];
export type WasteTourDateShiftFollowUpMode = (typeof wasteTourDateShiftFollowUpModes)[number];
export type WasteFractionReminderCount = (typeof wasteFractionReminderCounts)[number];
export type WasteHolidayStateCode = (typeof wasteHolidayStateCodes)[number];
export type WasteHolidayRuleScope = (typeof wasteHolidayRuleScopes)[number];
export type WasteHolidayRuleStrategy = (typeof wasteHolidayRuleStrategies)[number];

export const wasteManagementMasterDataContract = {
  dateShiftReasonTypes: wasteDateShiftReasonTypes,
  followUpModes: wasteTourDateShiftFollowUpModes,
  fractionReminderCounts: wasteFractionReminderCounts,
  fractionReminderLeadDayMin: 1,
  fractionReminderLeadDayMax: 14,
  holidayStateCodes: wasteHolidayStateCodes,
  holidayRuleScopes: wasteHolidayRuleScopes,
  holidayRuleStrategies: wasteHolidayRuleStrategies,
  isDateShiftReasonType: (value: string): value is WasteDateShiftReasonType =>
    (wasteDateShiftReasonTypes as readonly string[]).includes(value),
  isTourDateShiftFollowUpMode: (value: string): value is WasteTourDateShiftFollowUpMode =>
    (wasteTourDateShiftFollowUpModes as readonly string[]).includes(value),
  isWasteFractionReminderCount: (value: string): value is WasteFractionReminderCount =>
    (wasteFractionReminderCounts as readonly string[]).includes(value),
  isWasteHolidayStateCode: (value: string): value is WasteHolidayStateCode =>
    (wasteHolidayStateCodes as readonly string[]).includes(value),
  isWasteHolidayRuleScope: (value: string): value is WasteHolidayRuleScope =>
    (wasteHolidayRuleScopes as readonly string[]).includes(value),
  isWasteHolidayRuleStrategy: (value: string): value is WasteHolidayRuleStrategy =>
    (wasteHolidayRuleStrategies as readonly string[]).includes(value),
} as const;

export type WasteLocalizedTextRecord = Readonly<Record<string, string>>;
