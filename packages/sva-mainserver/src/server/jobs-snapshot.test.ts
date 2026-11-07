import {
  jobInputSchema as browserSchema,
  createJobDefaults as browserDefaults,
} from '@sva/plugin-jobs';
import { describe, expect, it } from 'vitest';
import { buildClientSchema, parse, validate, type IntrospectionQuery } from 'graphql';
import schemaSnapshot from '../generated/schema.snapshot.json';
import {
  jobWriteFields,
  jobDetailDocument,
  jobListDocument,
  jobWriteDocument,
  jobCollisionDocument,
  jobCategoriesGuardDocument,
  jobOperationDocument,
} from '../generated/jobs.js';
import { assertJobWritable, buildJobWrite, jobRead } from './jobs-snapshot.js';
import { createJobDefaults, jobInputSchema, jobTemporalState } from './jobs-contract.js';
import type { RawRecord } from './vouchers-snapshot.js';
import { jobFixture } from './jobs-test-fixture.js';
describe('Job contract and snapshot', () => {
  it.each([
    jobDetailDocument,
    jobListDocument,
    jobWriteDocument,
    jobCollisionDocument,
    jobCategoriesGuardDocument,
    jobOperationDocument,
  ])('validates the actual GraphQL document against the existing schema', (document) => {
    const schema = buildClientSchema(schemaSnapshot.data as unknown as IntrospectionQuery);
    expect(validate(schema, parse(document)).map((error) => error.message)).toEqual([]);
  });
  it('preserves all unrelated fields, additional companies and nullable metadata in a title update', () => {
    const stored = jobFixture();
    const input = jobRead(stored).input;
    expect(jobInputSchema.safeParse(input).success).toBe(true);
    const write = buildJobWrite({ ...input, title: 'Neuer Titel' }, stored);
    for (const key of [
      'payload',
      'companies',
      'contacts',
      'dates',
      'contentBlocks',
      'publicationDate',
      'teaser',
      'description',
      'categories',
    ])
      expect(write[key], key).toEqual(stored[key]);
    const originalMedia = (stored.mediaContents as RawRecord[])[0]!;
    const { height: _height, width: _width, ...writableMedia } = originalMedia;
    expect(write.mediaContents).toEqual([writableMedia]);
    expect(write.title).toBe('Neuer Titel');
    expect(stored.title).toBe('Sachbearbeitung');
  });
  it('retains an obsolete employment name and never creates category membership from it', () => {
    const stored = jobFixture();
    const input = jobRead(stored).input;
    const write = buildJobWrite({ ...input, employmentType: 'Vollzeit' }, stored);
    expect(write.payload).toEqual({ employmentType: 'Vollzeit', opaque: { keep: [1, 2] } });
    expect(write.categories).toEqual(stored.categories);
  });
  it('rejects missing fields, damaged payload and non-restorable relationships before writing', () => {
    const incomplete = jobFixture();
    delete incomplete.companies;
    expect(() => buildJobWrite(jobRead(jobFixture()).input, incomplete)).toThrow();
    expect(() => assertJobWritable({ ...jobFixture(), payload: ['damaged'] })).toThrow();
    expect(() => assertJobWritable({ ...jobFixture(), payload: { employmentType: 42 } })).toThrow(
      'job_incomplete'
    );
    expect(() =>
      assertJobWritable({ ...jobFixture(), genericItemMessages: [{ id: '1' }] })
    ).toThrow('job_dependents_unsupported');
    expect(() => assertJobWritable({ ...jobFixture(), companies: [null] })).toThrow();
  });

  it.each([null, '', '   '])(
    'rejects a non-restorable existing category name before title changes: %s',
    (name) => {
      const stored = { ...jobFixture(), categories: [{ name }] };
      expect(() => buildJobWrite({ ...jobRead(jobFixture()).input, title: 'Neu' }, stored)).toThrow(
        'job_incomplete'
      );
    }
  );
  it('rejects forged source indices and sanitizes changed HTML', () => {
    const stored = jobFixture();
    const input = jobRead(stored).input;
    expect(() =>
      buildJobWrite({ ...input, companies: [{ ...input.companies[0]!, sourceIndex: 99 }] }, stored)
    ).toThrow('job_content_conflict');
    expect(
      buildJobWrite(
        { ...input, contentBlocks: [{ body: '<script>bad()</script><p>Safe</p>' }] },
        stored
      ).contentBlocks
    ).toEqual([{ body: '<p>Safe</p>' }]);
  });
  it('preserves company address metadata while editing a contact and accepts zero coordinates', () => {
    const stored = jobFixture();
    const input = jobRead(stored).input;
    input.companies[0]!.contact.email = 'jobs@example.org';
    const write = buildJobWrite(input, stored);
    expect((write.companies as RawRecord[])[0]!.address).toEqual(
      (stored.companies as RawRecord[])[0]!.address
    );
    expect((write.companies as RawRecord[])[1]).toEqual((stored.companies as RawRecord[])[1]);
    expect(jobInputSchema.safeParse(input).success).toBe(true);
  });
  it('uses 28 calendar days, handles leap years and separates temporal state from visibility', () => {
    const input = { ...createJobDefaults('2028-02-01'), title: 'Neu', employmentType: 'Vollzeit' };
    expect(input.dates[0]!.dateEnd).toBe('2028-02-29');
    expect(input.visible).toBe(false);
    expect(jobTemporalState(input, '2028-03-01')).toBe('ended');
    expect(jobTemporalState(input, '2028-01-31')).toBe('planned');
    expect(jobInputSchema.safeParse({ ...input, dates: [{ dateEnd: '2028-01-31' }] }).success).toBe(
      false
    );
    expect(
      jobInputSchema.safeParse({
        ...input,
        companies: [{ name: '', contact: input.contacts[0], address: {} }],
      }).success
    ).toBe(false);
  });
  it('keeps the independently validated browser/server contracts compatible', () => {
    expect(browserDefaults('2028-02-01')).toEqual(createJobDefaults('2028-02-01'));
    const valid = {
      ...createJobDefaults('2026-11-07'),
      title: 'Stelle',
      employmentType: 'Vollzeit',
    };
    for (const value of [
      valid,
      jobRead(jobFixture()).input,
      { ...valid, title: '' },
      { ...valid, publicationDate: '2026-02-30' },
      { ...valid, dates: [{ dateEnd: '2026-11-01' }] },
      { ...valid, externalId: 42 },
    ])
      expect(browserSchema.safeParse(value).success).toBe(jobInputSchema.safeParse(value).success);
  });
});
