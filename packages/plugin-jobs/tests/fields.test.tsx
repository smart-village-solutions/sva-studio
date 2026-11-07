import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJobDefaults, emptyJobCompany, type JobInput } from '../src/contract.js';
import { JobBasisFields, JobContentFields } from '../src/jobs.fields.js';
vi.mock('@sva/plugin-sdk', async (original) => ({
  ...(await original<object>()),
  usePluginTranslation: () => (key: string) => key,
}));
vi.mock('../src/jobs.map.js', () => ({
  JobMap: ({ onChange }: { onChange: (latitude: number, longitude: number) => void }) => (
    <button type="button" onClick={() => onChange(0, 0)}>
      Kartenposition wählen
    </button>
  ),
}));
vi.mock('../src/jobs.form-media.js', () => ({ JobMediaFields: () => null }));
afterEach(cleanup);
function Form({
  initial = {},
  canPublish = false,
}: {
  initial?: Partial<JobInput>;
  canPublish?: boolean;
}) {
  const [draft, change] = useState<JobInput>({
    ...createJobDefaults('2026-11-07'),
    employmentType: 'Altwert',
    companies: [
      { ...emptyJobCompany(), sourceIndex: 0, name: 'Erste Firma' },
      { ...emptyJobCompany(), sourceIndex: 1, name: 'Zweite Firma' },
    ],
    ...initial,
  });
  const props = {
    draft,
    change: <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
      change((current) => ({ ...current, [key]: value })),
    errors: [],
    categories: [{ id: '1', name: 'Vollzeit' }],
    disabled: false,
    canPublish,
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

const readDraft = (): JobInput => JSON.parse(screen.getByTestId('draft').textContent ?? '{}');

describe('Job editing journeys', () => {
  it('updates title, identity, employment, expiry and explicit visibility without dropping extra dates', () => {
    render(
      <Form
        canPublish
        initial={{
          dates: [
            { sourceIndex: 0, dateEnd: '2026-12-05' },
            { sourceIndex: 1, dateEnd: '2026-12-20' },
          ],
        }}
      />
    );
    fireEvent.change(screen.getByLabelText(/^fields.title/), { target: { value: 'Neue Stelle' } });
    fireEvent.change(screen.getByLabelText('fields.externalId'), { target: { value: 'job-123' } });
    fireEvent.change(screen.getByLabelText(/^fields.employmentType/), {
      target: { value: 'Vollzeit' },
    });
    fireEvent.change(screen.getByLabelText(/^fields.dateEnd/), { target: { value: '2026-12-10' } });
    fireEvent.click(screen.getByRole('switch'));
    expect(readDraft()).toMatchObject({
      title: 'Neue Stelle',
      externalId: 'job-123',
      employmentType: 'Vollzeit',
      visible: true,
    });
    expect(readDraft().dates).toEqual([
      { sourceIndex: 0, dateEnd: '2026-12-10' },
      { sourceIndex: 1, dateEnd: '2026-12-20' },
    ]);
  });

  it('edits company contact, address and map independently of job contacts and other employers', () => {
    render(<Form />);
    const employer = within(screen.getByRole('group', { name: 'fields.primaryCompany' }));
    const contact = within(employer.getByRole('group', { name: 'fields.companyContact' }));
    for (const [field, value] of Object.entries({
      firstName: 'Alex',
      lastName: 'Muster',
      email: 'jobs@example.org',
      phone: '030123',
      fax: '030456',
    }))
      fireEvent.change(contact.getByLabelText(`fields.${field}`), { target: { value } });
    fireEvent.click(contact.getByRole('button', { name: 'actions.addUrl' }));
    fireEvent.change(contact.getByLabelText('fields.url'), {
      target: { value: 'https://example.org/jobs' },
    });
    fireEvent.change(contact.getByLabelText('fields.urlDescription'), {
      target: { value: 'Karriere' },
    });
    for (const [field, value] of Object.entries({
      addition: 'Haus A',
      street: 'Markt 1',
      zip: '12345',
      city: 'Musterstadt',
      latitude: '52',
      longitude: '13',
    }))
      fireEvent.change(employer.getByLabelText(`fields.${field}`), { target: { value } });
    expect(readDraft().companies[0]).toMatchObject({
      contact: {
        firstName: 'Alex',
        email: 'jobs@example.org',
        webUrls: [{ url: 'https://example.org/jobs', description: 'Karriere' }],
      },
      address: { city: 'Musterstadt', latitude: 52, longitude: 13 },
    });
    expect(readDraft().contacts[0]?.firstName).toBe('');
    expect(readDraft().companies[1]?.name).toBe('Zweite Firma');
    fireEvent.click(employer.getByRole('button', { name: 'Kartenposition wählen' }));
    expect(readDraft().companies[0]?.address).toMatchObject({ latitude: 0, longitude: 0 });
    fireEvent.change(employer.getByLabelText('fields.latitude'), { target: { value: '' } });
    fireEvent.change(employer.getByLabelText('fields.longitude'), { target: { value: '' } });
    expect(readDraft().companies[0]?.address).toMatchObject({ latitude: null, longitude: null });
    fireEvent.click(contact.getByRole('button', { name: 'actions.removeUrl' }));
    expect(readDraft().companies[0]?.contact.webUrls).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'actions.addCompany' }));
    expect(readDraft().companies).toHaveLength(3);
    fireEvent.click(employer.getByRole('button', { name: 'actions.removeCompany' }));
    expect(readDraft().companies.map((company) => company.name)).toEqual(['Zweite Firma', '']);
  });

  it('adds and removes contact people and their web links without changing employers', () => {
    render(<Form />);
    const contact = within(screen.getByRole('group', { name: 'fields.primaryContact' }));
    fireEvent.change(contact.getByLabelText('fields.firstName'), { target: { value: 'Kim' } });
    fireEvent.click(contact.getByRole('button', { name: 'actions.addUrl' }));
    fireEvent.change(contact.getByLabelText('fields.url'), {
      target: { value: 'https://example.org/person' },
    });
    fireEvent.change(contact.getByLabelText('fields.urlDescription'), {
      target: { value: 'Kontakt' },
    });
    expect(readDraft().contacts[0]).toMatchObject({
      firstName: 'Kim',
      webUrls: [{ url: 'https://example.org/person', description: 'Kontakt' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'actions.addContact' }));
    expect(readDraft().contacts).toHaveLength(2);
    fireEvent.click(contact.getByRole('button', { name: 'actions.removeContact' }));
    expect(readDraft().contacts).toHaveLength(1);
    expect(readDraft().contacts[0]?.firstName).toBe('');
    expect(readDraft().companies[0]?.name).toBe('Erste Firma');
  });

  it('adds optional HTML and changes a media type while preserving the other medium', async () => {
    render(
      <Form
        initial={{
          contentBlocks: [],
          mediaContents: [
            {
              sourceIndex: 0,
              contentType: 'image',
              sourceUrl: { url: 'https://example.org/a', description: '' },
              copyright: '',
              captionText: '',
            },
            {
              sourceIndex: 1,
              contentType: 'audio',
              sourceUrl: { url: 'https://example.org/b', description: '' },
              copyright: '',
              captionText: '',
            },
          ],
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'actions.add' }));
    fireEvent.click(await screen.findByRole('button', { name: 'richText.htmlMode' }));
    fireEvent.change(document.querySelector('textarea')!, { target: { value: '<p>Aufgaben</p>' } });
    fireEvent.blur(document.querySelector('textarea')!);
    await waitFor(() => expect(readDraft().contentBlocks[0]?.body).toContain('Aufgaben'));
    fireEvent.change(screen.getAllByLabelText('fields.mediaType')[0]!, {
      target: { value: 'video' },
    });
    expect(readDraft().mediaContents.map((medium) => medium.contentType)).toEqual([
      'video',
      'audio',
    ]);
  });
});
