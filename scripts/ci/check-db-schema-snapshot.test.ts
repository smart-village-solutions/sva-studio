import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CI_SCHEMA_SNAPSHOT_DB,
  createSchemaSnapshotVerificationReport,
} from './check-db-schema-snapshot.ts';

describe('check-db-schema-snapshot', () => {
  it('reports drift between actual and expected schema snapshots', () => {
    const expectedSql = `
      CREATE TABLE public.expected_table (
        id uuid NOT NULL
      );
      ALTER TABLE ONLY iam.examples FORCE ROW LEVEL SECURITY;
    `;
    const actualSql = `
      CREATE TABLE public.actual_table (
        id uuid NOT NULL
      );
    `;

    expect(createSchemaSnapshotVerificationReport(actualSql, expectedSql)).toEqual({
      contentDrift: true,
      ignoredSchemas: ['graphile_worker'],
      missingObjects: ['rls:force:iam.examples', 'table:public.expected_table'],
      status: 'drift',
      unexpectedObjects: ['table:public.actual_table'],
    });
  });

  it('reports definition drift even when the object set stays stable', () => {
    const expectedSql = `
      -- Name: examples; Type: TABLE; Schema: iam; Owner: -
      CREATE TABLE iam.examples (
        id uuid NOT NULL,
        label text NOT NULL DEFAULT ''::text
      );
    `;
    const actualSql = `
      -- Name: examples; Type: TABLE; Schema: iam; Owner: -
      CREATE TABLE iam.examples (
        id uuid NOT NULL,
        label text
      );
    `;

    expect(createSchemaSnapshotVerificationReport(actualSql, expectedSql)).toEqual({
      contentDrift: true,
      ignoredSchemas: ['graphile_worker'],
      missingObjects: [],
      status: 'drift',
      unexpectedObjects: [],
    });
  });

  it('uses a stable dedicated database name for the ci snapshot run', () => {
    expect(DEFAULT_CI_SCHEMA_SNAPSHOT_DB).toBe('sva_schema_snapshot_ci');
  });
});
