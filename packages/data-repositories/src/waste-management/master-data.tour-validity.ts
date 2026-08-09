import type {
  WasteTourRecord,
  WasteTourValidityBulkUpdateInput,
  WasteTourValidityRecord,
} from '@sva/core';

import type { SqlStatement } from '../iam/repositories/types.js';

export type WasteTourValidityRow = {
  readonly id: string;
  readonly recurrence: WasteTourRecord['recurrence'];
  readonly custom_recurrence_id: string | null;
  readonly first_date: string | null;
  readonly end_date: string | null;
};

export const buildTourValidityLockStatement = (ids: readonly string[]): SqlStatement => ({
  text: `
SELECT
  id::text,
  recurrence,
  custom_recurrence_id::text,
  first_date::text,
  end_date::text
FROM waste_tours
WHERE id = ANY($1::uuid[])
ORDER BY id
FOR UPDATE;
`,
  values: [ids],
});

export const mapWasteTourValidityRow = (row: WasteTourValidityRow): WasteTourValidityRecord => ({
  id: row.id,
  recurrence: row.recurrence ?? null,
  customRecurrenceId: row.custom_recurrence_id ?? undefined,
  firstDate: row.first_date ?? undefined,
  endDate: row.end_date ?? undefined,
});

export const buildTourValidityBulkUpdateStatement = (
  input: WasteTourValidityBulkUpdateInput
): SqlStatement => ({
  text: `
UPDATE waste_tours
SET first_date = CASE $2
      WHEN 'set' THEN $3::date
      ELSE first_date
    END,
    end_date = CASE $4
      WHEN 'set' THEN $5::date
      WHEN 'clear' THEN NULL
      ELSE end_date
    END,
    updated_at = NOW()
WHERE id = ANY($1::uuid[]);
`,
  values: [
    input.tourIds,
    input.firstDate.mode,
    input.firstDate.mode === 'set' ? input.firstDate.value : null,
    input.endDate.mode,
    input.endDate.mode === 'set' ? input.endDate.value : null,
  ],
});
