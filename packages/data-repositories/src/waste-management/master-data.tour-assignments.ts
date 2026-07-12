import type { WasteTourAssignmentListFilter, WasteTourAssignmentRecord } from '@sva/core';

import type { SqlExecutor, SqlPrimitive, SqlStatement } from '../iam/repositories/types.js';
import type { WasteMasterDataRepository } from './master-data.contract.js';

type WasteTourAssignmentRow = {
  readonly id: string;
  readonly tour_id: string;
  readonly pickup_date: string;
  readonly note: string | null;
  readonly location_ids: readonly string[];
  readonly created_at: string;
  readonly updated_at: string;
};

const mapRow = (row: WasteTourAssignmentRow): WasteTourAssignmentRecord => ({
  id: row.id,
  tourId: row.tour_id,
  pickupDate: row.pickup_date,
  note: row.note,
  locationIds: row.location_ids,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildSelectStatement = (
  filter: WasteTourAssignmentListFilter = {},
  assignmentId?: string
): SqlStatement => {
  const values: SqlPrimitive[] = [];
  const conditions: string[] = [];

  if (assignmentId !== undefined) {
    values.push(assignmentId);
    conditions.push(`assignment.id = $${values.length}::uuid`);
  }
  if (filter.tourId?.trim()) {
    values.push(filter.tourId);
    conditions.push(`assignment.tour_id = $${values.length}::uuid`);
  }
  if (filter.pickupDate?.trim()) {
    values.push(filter.pickupDate);
    conditions.push(`assignment.pickup_date = $${values.length}::date`);
  }
  if (filter.locationIds?.length) {
    values.push([...new Set(filter.locationIds)]);
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM waste_tour_assignment_locations AS matched_location
        WHERE matched_location.assignment_id = assignment.id
          AND matched_location.collection_location_id = ANY($${values.length}::uuid[])
      )`
    );
  }

  return {
    text: `
SELECT
  assignment.id::text,
  assignment.tour_id::text,
  assignment.pickup_date::text,
  assignment.note,
  ARRAY_AGG(
    assignment_location.collection_location_id::text
    ORDER BY assignment_location.collection_location_id::text
  ) AS location_ids,
  assignment.created_at::text,
  assignment.updated_at::text
FROM waste_tour_assignments AS assignment
INNER JOIN waste_tour_assignment_locations AS assignment_location
  ON assignment_location.assignment_id = assignment.id
${conditions.length > 0 ? `WHERE ${conditions.join('\n  AND ')}` : ''}
GROUP BY assignment.id
ORDER BY assignment.pickup_date ASC, assignment.created_at ASC, assignment.id ASC
${assignmentId === undefined ? ';' : 'LIMIT 1;'}
`,
    values,
  };
};

const buildListStatement = (filter: WasteTourAssignmentListFilter = {}): SqlStatement =>
  buildSelectStatement(filter);

const buildGetStatement = (id: string): SqlStatement => buildSelectStatement({}, id);

const normalizeLocationIds = (locationIds: readonly string[]): readonly string[] => {
  const normalizedLocationIds = [
    ...new Set(locationIds.map((locationId) => locationId.trim()).filter(Boolean)),
  ];
  if (normalizedLocationIds.length === 0) {
    throw new Error('waste_tour_assignment_requires_location');
  }
  return normalizedLocationIds;
};

const buildUpsertStatement = (
  input: Omit<WasteTourAssignmentRecord, 'createdAt' | 'updatedAt'>
): SqlStatement => ({
  text: `
WITH saved_assignment AS (
  INSERT INTO waste_tour_assignments (id, tour_id, pickup_date, note)
  VALUES ($1::uuid, $2::uuid, $3::date, $4::text)
  ON CONFLICT (id) DO UPDATE
  SET
    tour_id = EXCLUDED.tour_id,
    pickup_date = EXCLUDED.pickup_date,
    note = EXCLUDED.note,
    updated_at = NOW()
  RETURNING id
), removed_locations AS (
  DELETE FROM waste_tour_assignment_locations
  WHERE assignment_id = (SELECT id FROM saved_assignment)
)
INSERT INTO waste_tour_assignment_locations (assignment_id, collection_location_id)
SELECT saved_assignment.id, location_id
FROM saved_assignment
CROSS JOIN UNNEST($5::uuid[]) AS location_id;
`,
  values: [
    input.id,
    input.tourId,
    input.pickupDate,
    input.note,
    normalizeLocationIds(input.locationIds),
  ],
});

const buildDeleteStatement = (id: string): SqlStatement => ({
  text: 'DELETE FROM waste_tour_assignments WHERE id = $1::uuid;',
  values: [id],
});

export const createWasteTourAssignmentRepositoryPart = (
  executor: SqlExecutor
): Pick<
  WasteMasterDataRepository,
  | 'listWasteTourAssignments'
  | 'getWasteTourAssignmentById'
  | 'upsertWasteTourAssignment'
  | 'deleteWasteTourAssignment'
> => ({
  async listWasteTourAssignments(filter) {
    const result = await executor.execute<WasteTourAssignmentRow>(buildListStatement(filter));
    return result.rows.map(mapRow);
  },
  async getWasteTourAssignmentById(id) {
    const result = await executor.execute<WasteTourAssignmentRow>(buildGetStatement(id));
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },
  async upsertWasteTourAssignment(input) {
    await executor.execute(buildUpsertStatement(input));
  },
  async deleteWasteTourAssignment(id) {
    await executor.execute(buildDeleteStatement(id));
  },
});

export const wasteTourAssignmentStatements = {
  listWasteTourAssignments: buildListStatement,
  getWasteTourAssignmentById: buildGetStatement,
  upsertWasteTourAssignment: buildUpsertStatement,
  deleteWasteTourAssignment: buildDeleteStatement,
} as const;
