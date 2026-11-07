import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJobDefaults, emptyJobCompany } from '../src/contract.js';
import { JobBasisFields, JobContentFields } from '../src/jobs.fields.js';
vi.mock('@sva/plugin-sdk', async (original) => ({
  ...(await original<object>()),
  usePluginTranslation: () => (key: string) => key,
}));
vi.mock('../src/jobs.map.js', () => ({ JobMap: () => null }));
vi.mock('../src/jobs.form-media.js', () => ({ JobMediaFields: () => null }));
afterEach(cleanup);
function Form() {
  const [draft, change] = useState({
    ...createJobDefaults('2026-11-07'),
    employmentType: 'Altwert',
    companies: [
      { ...emptyJobCompany(), sourceIndex: 0, name: 'Erste Firma' },
      { ...emptyJobCompany(), sourceIndex: 1, name: 'Zweite Firma' },
    ],
  });
  const props = {
    draft,
    change: <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
      change((current) => ({ ...current, [key]: value })),
    errors: [],
    categories: [{ id: '1', name: 'Vollzeit' }],
    disabled: false,
    canPublish: false,
  };
  return (
    <>
      <JobBasisFields {...props} />
      <JobContentFields {...props} />
      <output data-testid="draft">{JSON.stringify(draft)}</output>
    </>
  );
}
describe('Job editorial fields', () => {
  it('preserves a second employer and expiry while editing the first employer and publication date', () => {
    render(<Form />);
    fireEvent.change(screen.getAllByLabelText('fields.companyName')[0]!, {
      target: { value: 'Neue Firma' },
    });
    fireEvent.change(screen.getByLabelText(/fields.publicationDate/), {
      target: { value: '2026-11-08' },
    });
    const draft = JSON.parse(screen.getByTestId('draft').textContent!);
    expect(draft.companies.map((item: { name: string }) => item.name)).toEqual([
      'Neue Firma',
      'Zweite Firma',
    ]);
    expect(draft.dates[0].dateEnd).toBe('2026-12-05');
    expect(draft.companies[1].sourceIndex).toBe(1);
  });
  it('keeps an obsolete employment value selectable and separates company contacts from job contacts', () => {
    render(<Form />);
    expect((screen.getByLabelText(/fields.employmentType/) as HTMLSelectElement).value).toBe(
      'Altwert'
    );
    expect(screen.getAllByRole('group', { name: 'fields.companyContact' })).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'fields.primaryContact' })).toBeDefined();
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
  });
});
