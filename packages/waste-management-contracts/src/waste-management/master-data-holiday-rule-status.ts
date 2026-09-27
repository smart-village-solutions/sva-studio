export const wasteHolidayRuleSourceStatuses = ['confirmed', 'not-confirmed'] as const;
export const wasteHolidayRuleConfigurationStatuses = ['draft', 'configured'] as const;
export const wasteHolidayRuleConflictStatuses = ['none', 'manual-global-rule'] as const;

export type WasteHolidayRuleSourceStatus = (typeof wasteHolidayRuleSourceStatuses)[number];

export type WasteHolidayRuleConfigurationStatus =
  (typeof wasteHolidayRuleConfigurationStatuses)[number];

export type WasteHolidayRuleConflictStatus = (typeof wasteHolidayRuleConflictStatuses)[number];
