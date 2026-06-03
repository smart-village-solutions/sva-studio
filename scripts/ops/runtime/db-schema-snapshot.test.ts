import { describe, expect, it } from 'vitest';

import {
  compareSchemaSnapshots,
  diffSchemaSnapshots,
  extractSchemaSnapshotObjects,
  normalizeSchemaSnapshotSql,
} from './db-schema-snapshot.ts';

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
      CREATE TRIGGER trg_examples_updated_at BEFORE UPDATE ON iam.examples FOR EACH ROW EXECUTE FUNCTION iam.touch_updated_at();
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
      'trigger:iam.examples.trg_examples_updated_at',
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
      CREATE TRIGGER trg_expected BEFORE UPDATE ON iam.expected_table FOR EACH ROW EXECUTE FUNCTION iam.touch_updated_at();
      ALTER TABLE ONLY iam.legal_text_targets FORCE ROW LEVEL SECURITY;
    `;
    const actualSql = `
      CREATE TABLE public.actual_table (
        id uuid NOT NULL
      );
    `;

    expect(diffSchemaSnapshots(actualSql, expectedSql)).toEqual({
      ignoredSchemas: ['graphile_worker'],
      missingObjects: ['rls:force:iam.legal_text_targets', 'table:public.expected_table', 'trigger:iam.expected_table.trg_expected'],
      unexpectedObjects: ['table:public.actual_table'],
    });
  });
});

describe('normalizeSchemaSnapshotSql', () => {
  it('removes volatile dump preamble lines and ignored schema sections', () => {
    const sql = `
      --
      -- PostgreSQL database dump
      --
      \\restrict token

      -- Name: graphile_worker; Type: SCHEMA; Schema: -; Owner: -
      --

      CREATE SCHEMA graphile_worker;


      -- Name: jobs; Type: TABLE; Schema: graphile_worker; Owner: -
      --

      CREATE TABLE graphile_worker.jobs (
        id bigint NOT NULL
      );

      -- Name: examples; Type: TABLE; Schema: iam; Owner: -
      --

      CREATE TABLE iam.examples (
        id uuid NOT NULL
      );
    `;

    expect(normalizeSchemaSnapshotSql(sql)).toBe(`CREATE TABLE iam.examples (\n        id uuid NOT NULL\n      );`);
  });
});

describe('compareSchemaSnapshots', () => {
  it('treats matching schema sections as equal even when pg_dump orders them differently', () => {
    const expectedSql = `
      -- Name: legal_text_versions; Type: TABLE; Schema: iam; Owner: -
      CREATE TABLE iam.legal_text_versions (
        id uuid NOT NULL
      );

      -- Name: legal_text_target_groups; Type: TABLE; Schema: iam; Owner: -
      CREATE TABLE iam.legal_text_target_groups (
        id uuid NOT NULL
      );
    `;
    const actualSql = `
      -- Name: legal_text_target_groups; Type: TABLE; Schema: iam; Owner: -
      CREATE TABLE iam.legal_text_target_groups (
        id uuid NOT NULL
      );

      -- Name: legal_text_versions; Type: TABLE; Schema: iam; Owner: -
      CREATE TABLE iam.legal_text_versions (
        id uuid NOT NULL
      );
    `;

    expect(compareSchemaSnapshots(actualSql, expectedSql)).toEqual({
      contentMatches: true,
      ignoredSchemas: ['graphile_worker'],
      missingObjects: [],
      unexpectedObjects: [],
    });
  });

  it('detects definition drift even when object names stay stable', () => {
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

    expect(compareSchemaSnapshots(actualSql, expectedSql)).toEqual({
      contentMatches: false,
      ignoredSchemas: ['graphile_worker'],
      missingObjects: [],
      unexpectedObjects: [],
    });
  });
});
