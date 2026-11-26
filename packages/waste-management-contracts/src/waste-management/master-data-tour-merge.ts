import type { WasteTourRecord } from './master-data-tours.js';

export type WasteTourMergeInput = Readonly<{
  tourIds: readonly string[];
  targetTourId: string;
  confirmationToken?: string;
}>;

export type WasteTourMergeOption = Pick<
  WasteTourRecord,
  | 'id'
  | 'name'
  | 'status'
  | 'recurrence'
  | 'customRecurrenceName'
  | 'customRecurrenceIntervalDays'
  | 'firstDate'
  | 'endDate'
> &
  Readonly<{ locationCount: number }>;

export type WasteTourMergeConflict = Readonly<{
  tourId: string;
  reason:
    | 'status'
    | 'recurrence'
    | 'fractions'
    | 'validity'
    | 'notes'
    | 'shifts'
    | 'assignments'
    | 'duplicateLinks';
}>;

export type WasteTourMergePreview = Readonly<{
  token: string;
  tours: readonly WasteTourMergeOption[];
  addedCount: number;
  totalCount: number;
  sharedCount: number;
  sharedLocationLabel?: string;
  conflicts: readonly WasteTourMergeConflict[];
}>;

export type WasteTourMergeResult =
  | Readonly<{ kind: 'preview'; preview: WasteTourMergePreview }>
  | Readonly<{ kind: 'merged'; totalCount: number; archivedCount: number }>
  | Readonly<{ kind: 'stale' | 'rolled-back' }>;
