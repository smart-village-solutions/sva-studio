import { describe, it, expect } from 'vitest';
import {
  createJobDefaults,
  emptyJobCompany,
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
});
