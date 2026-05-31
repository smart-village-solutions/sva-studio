import type { WasteCustomTourDate, WasteTourRecord } from '@sva/plugin-sdk';

export type LocationTourLinkFormState = {
  readonly id: string;
  readonly locationId: string;
  readonly tourId: string;
  readonly startDate: string;
  readonly endDate: string;
};

export type TourFormState = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly wasteFractionIds: readonly string[];
  readonly recurrence: NonNullable<WasteTourRecord['recurrence']> | '';
  readonly customRecurrenceId: string;
  readonly firstDate: string;
  readonly endDate: string;
  readonly customDates: readonly WasteCustomTourDate[];
  readonly active: boolean;
};
