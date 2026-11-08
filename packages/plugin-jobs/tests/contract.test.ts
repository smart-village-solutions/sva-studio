import { describe, it, expect } from 'vitest';
import {
  createJobDefaults,
  emptyJobCompany,
  emptyJobContact,
  jobInputSchema,
  jobTemporalState,
} from '../src/contract.js';
import { pluginJobs } from '../src/plugin.js';
import { jobsMainserverGenericItemOwnership } from '../src/generic-item-ownership.js';
describe('Job input and ownership boundary', () => {
  it('starts hidden with one employer/contact section and 28 calendar days, including leap years', () => {
    const job = { ...createJobDefaults('2028-02-01'), title: 'Stelle', employmentType: 'Vollzeit' };
    expect(job.dates[0]?.dateEnd).toBe('2028-02-29');
    expect(job.visible).toBe(false);
    expect(job.companies).toHaveLength(1);
    expect(job.contacts).toHaveLength(1);
    expect(jobInputSchema.safeParse(job).success).toBe(true);
    expect(jobTemporalState(job, '2028-03-01')).toBe('ended');
  });
  it('validates employers, URLs, paired coordinates and source identities', () => {
    const job = { ...createJobDefaults('2026-11-07'), title: 'Stelle', employmentType: 'Vollzeit' };
    const company = {
      ...emptyJobCompany(),
      name: 'Stadt',
      address: { ...emptyJobCompany().address, latitude: 0, longitude: 0 },
    };
    expect(jobInputSchema.safeParse({ ...job, companies: [company] }).success).toBe(true);
    expect(
      jobInputSchema.safeParse({ ...job, companies: [{ ...company, name: '' }] }).success
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({
        ...job,
        companies: [{ ...company, address: { ...company.address, longitude: null } }],
      }).success
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({ ...job, contacts: [{ ...job.contacts[0], email: 'broken' }] })
        .success
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({
        ...job,
        dates: [
          { sourceIndex: 0, dateEnd: '2026-12-01' },
          { sourceIndex: 0, dateEnd: '2026-12-02' },
        ],
      }).success
    ).toBe(false);
  });
  it('owns only exact Job records and exposes the four namespaced Job permissions', () => {
    expect(jobsMainserverGenericItemOwnership).toMatchObject({
      mainserverGenericType: 'Job',
      contentType: 'jobs.job',
    });
    expect(pluginJobs.permissions?.map((permission) => permission.id)).toEqual([
      'jobs.read',
      'jobs.create',
      'jobs.update',
      'jobs.delete',
    ]);
    expect(pluginJobs.contentHistory).toMatchObject({ mode: 'host' });
  });
  it('validates non-empty contact links and media URLs before a write', () => {
    const job = { ...createJobDefaults('2026-11-07'), title: 'Stelle', employmentType: 'Vollzeit' };
    const contact = {
      ...emptyJobContact(),
      email: 'jobs@example.org',
      webUrls: [{ url: 'https://example.org/jobs', description: 'Karriere' }],
    };
    expect(jobInputSchema.safeParse({ ...job, contacts: [contact] }).success).toBe(true);
    expect(
      jobInputSchema.safeParse({
        ...job,
        contacts: [{ ...contact, webUrls: [{ url: 'javascript:alert(1)', description: '' }] }],
      }).success
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({
        ...job,
        mediaContents: [
          {
            contentType: 'audio',
            sourceUrl: { url: 'https://example.org/a.mp3', description: '' },
            copyright: '',
            captionText: '',
          },
        ],
      }).success
    ).toBe(true);
    expect(
      jobInputSchema.safeParse({
        ...job,
        mediaContents: [
          {
            contentType: 'video',
            sourceUrl: { url: 'https://', description: '' },
            copyright: '',
            captionText: '',
          },
        ],
      }).success
    ).toBe(false);
  });
  it('distinguishes planned, running and incomplete periods without changing visibility', () => {
    const job = createJobDefaults('2026-11-07');
    expect(jobTemporalState(job, '2026-11-01')).toBe('planned');
    expect(jobTemporalState(job, '2026-11-08')).toBe('ongoing');
    expect(jobTemporalState({ ...job, dates: [] }, '2026-11-08')).toBe('incomplete');
    expect(jobTemporalState({ ...job, dates: [{ dateEnd: '2026-11-01' }] }, '2026-11-08')).toBe(
      'incomplete'
    );
    expect(
      jobInputSchema.safeParse({
        ...job,
        title: 'Stelle',
        employmentType: 'Vollzeit',
        dates: [{ dateEnd: '2026-02-30' }],
      }).success
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({
        ...job,
        title: 'Stelle',
        employmentType: 'Vollzeit',
        dates: [{ dateEnd: '' }],
      }).success
    ).toBe(false);
    expect(job.visible).toBe(false);
  });
});
