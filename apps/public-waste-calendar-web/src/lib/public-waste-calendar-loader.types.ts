import type { WasteHolidayRuleRecord } from '@sva/core';

export type CalendarEntryRow = {
  readonly link_id: string;
  readonly location_id: string;
  readonly tour_id: string;
  readonly tour_name: string;
  readonly tour_description: string | null;
  readonly tour_recurrence:
    'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom' | null;
  readonly tour_custom_recurrence_interval_days: number | null;
  readonly tour_first_date: string | null;
  readonly tour_end_date: string | null;
  readonly tour_custom_dates:
    readonly { readonly date?: unknown; readonly description?: unknown }[] | null;
  readonly fraction_id: string;
  readonly fraction_label: string;
  readonly fraction_description: string | null;
  readonly fraction_pdf_short_label: string | null;
  readonly fraction_color: string | null;
};

export type TourDateShiftRow = {
  readonly id: string;
  readonly tour_id: string;
  readonly original_date: string;
  readonly actual_date: string;
  readonly description: string | null;
};

export type GlobalDateShiftRow = {
  readonly id: string;
  readonly original_date: string;
  readonly actual_date: string;
  readonly description: string | null;
  readonly tour_ids: readonly string[] | null;
};

export type TourAssignmentRow = {
  readonly assignment_id: string;
  readonly pickup_date: string;
  readonly tour_id: string;
  readonly tour_name: string;
  readonly tour_description: string | null;
  readonly fraction_id: string | null;
  readonly fraction_label: string | null;
  readonly fraction_description: string | null;
  readonly fraction_pdf_short_label: string | null;
  readonly fraction_color: string | null;
  readonly note: string | null;
};

export type HolidayRuleRow = {
  readonly id: string;
  readonly holiday_date: string;
  readonly holiday_name: string;
  readonly holiday_year: number;
  readonly state_code: WasteHolidayRuleRecord['stateCode'];
  readonly source_status: WasteHolidayRuleRecord['sourceStatus'];
  readonly configuration_status: WasteHolidayRuleRecord['configurationStatus'];
  readonly conflict_status: WasteHolidayRuleRecord['conflictStatus'];
  readonly scope: WasteHolidayRuleRecord['scope'] | null;
  readonly strategy: WasteHolidayRuleRecord['strategy'] | null;
  readonly created_at: string;
  readonly updated_at: string;
};
