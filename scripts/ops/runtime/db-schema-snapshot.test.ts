import { describe, expect, it } from 'vitest';

import { diffSchemaSnapshots, extractSchemaSnapshotObjects } from './db-schema-snapshot.ts';

describe('extractSchemaSnapshotObjects', () => {
  it('extracts supported schema objects and ignores graphile_worker by default', () => {
    const sql = `
      CREATE TABLE public.example_table (
        id uuid NOT NULL
      );
      CREATE FUNCTION iam.current_instance_id() RETURNS text
        LANGUAGE sql
        AS $$ SELECT 'demo'::text; $$;
      CREATE POLICY examples_isolation_policy ON iam.examples USING (true);
      ALTER TABLE ONLY iam.examples FORCE ROW LEVEL SECURITY;
      CREATE INDEX idx_examples_instance_id ON iam.examples USING btree (instance_id);
      CREATE TABLE graphile_worker.jobs (
        id bigint NOT NULL
      );
    `;

    expect(extractSchemaSnapshotObjects(sql)).toEqual([
      'function:iam.current_instance_id()',
      'index:idx_examples_instance_id',
      'policy:iam.examples.examples_isolation_policy',
      'rls:force:iam.examples',
      'table:public.example_table',
    ]);
  });

  it('ignores indexes that target ignored schemas', () => {
    const sql = `
      CREATE INDEX idx_jobs_locked_at ON graphile_worker.jobs USING btree (locked_at);
      CREATE UNIQUE INDEX idx_public_examples_slug ON public.examples USING btree (slug);
    `;

    expect(extractSchemaSnapshotObjects(sql)).toEqual(['index:idx_public_examples_slug']);
  });
});

describe('diffSchemaSnapshots', () => {
  it('reports missing and unexpected objects between expected and actual snapshots', () => {
    const expectedSql = `
      CREATE TABLE public.expected_table (
        id uuid NOT NULL
      );
      ALTER TABLE ONLY iam.legal_text_targets FORCE ROW LEVEL SECURITY;
    `;
    const actualSql = `
      CREATE TABLE public.actual_table (
        id uuid NOT NULL
      );
    `;

    expect(diffSchemaSnapshots(actualSql, expectedSql)).toEqual({
      ignoredSchemas: ['graphile_worker'],
      missingObjects: ['rls:force:iam.legal_text_targets', 'table:public.expected_table'],
      unexpectedObjects: ['table:public.actual_table'],
    });
  });
});
