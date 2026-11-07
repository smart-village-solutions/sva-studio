import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishSessionAccessSnapshot, registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { JobsCreatePage, JobsEditPage } from '../src/jobs.pages.js';
import { JobsListPage } from '../src/jobs.list.js';
import { createJobDefaults, emptyJobCompany } from '../src/contract.js';
import { pluginJobsTranslations } from '../src/plugin.translations.js';
const api = vi.hoisted(() => ({
  categories: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  navigate: vi.fn(),
  history: vi.fn(),
  search: {} as Record<string, unknown>,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
  }: Readonly<{ to: string; params?: { id: string }; children: React.ReactNode }>) => (
    <a href={to.replace('$id', params?.id ?? '')}>{children}</a>
  ),
  useParams: () => ({ id: '42' }),
  useSearch: () => api.search,
  useNavigate: () => api.navigate,
}));
vi.mock('@sva/plugin-sdk', async (original) => ({
  ...(await original<object>()),
  fetchIamContentHistory: api.history,
}));
vi.mock('../src/jobs.api.js', async (original) => ({
  ...(await original<object>()),
  listJobCategories: api.categories,
  getJob: api.get,
  saveJob: api.save,
  removeJob: api.remove,
  listJobs: api.list,
}));
vi.mock('../src/jobs.form-media.js', () => ({ JobMediaFields: () => null }));
vi.mock('../src/jobs.map.js', () => ({ JobMap: () => null }));
const record = {
  id: '42',
  genericType: 'Job' as const,
  title: 'Stadtentwicklung',
  visible: false,
  updatedAt: '2026-11-01T12:00:00Z',
  contentFingerprint: 'a'.repeat(64),
  dataProvider: { id: '7' },
  input: {
    ...createJobDefaults('2026-11-07'),
    title: 'Stadtentwicklung',
    employmentType: 'Vollzeit',
    companies: [{ ...emptyJobCompany(), name: 'Stadtverwaltung' }],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  api.search = {};
  api.navigate.mockReset();
  api.history.mockResolvedValue([]);
  sessionStorage.clear();
  const actions = ['jobs.read', 'jobs.create', 'jobs.update', 'jobs.delete'];
  publishSessionAccessSnapshot({
    isResolved: true,
    subjectId: 'editor',
    instanceId: 'fixture',
    assignedModules: ['jobs'],
    roles: [],
    permissionActions: actions,
    unscopedPermissionActions: actions,
  });
  registerPluginTranslationResolver((key, variables = {}) => {
    const value = key
      .split('.')
      .slice(1)
      .reduce<unknown>(
        (node, key) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
        pluginJobsTranslations.de.jobs
      );
    return typeof value === 'string'
      ? value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(variables[name] ?? ''))
      : key;
  });
  api.categories.mockResolvedValue([{ id: '1', name: 'Vollzeit' }]);
  api.get.mockResolvedValue({ data: record, access: { 'jobs.update': true, 'jobs.delete': true } });
  api.save.mockResolvedValue(record);
  api.remove.mockResolvedValue({ id: '42', deleted: true });
  api.list.mockResolvedValue({
    data: [record],
    pagination: { page: 1, pageSize: 25, total: 1, hasNextPage: false },
  });
});

describe('Job list and history journeys', () => {
  it('keeps list filters in typed navigation and resets pagination when filtering', async () => {
    api.search = {
      search: 'Stadt',
      employmentType: 'Altwert',
      visible: 'false',
      temporal: 'ended',
      page: 2,
      pageSize: 50,
    };
    let nextSearch: Record<string, unknown> = {};
    api.navigate.mockImplementation(
      ({ search }: { search: (current: Record<string, unknown>) => Record<string, unknown> }) => {
        nextSearch = search(api.search);
        return Promise.resolve();
      }
    );
    api.list.mockResolvedValue({
      data: [record],
      pagination: { page: 2, pageSize: 50, total: 101, hasNextPage: true },
    });
    render(<JobsListPage />);
    await screen.findAllByText('Stadtverwaltung');
    expect(api.list).toHaveBeenCalledWith(
      {
        search: 'Stadt',
        employmentType: 'Altwert',
        visible: 'false',
        temporal: 'ended',
        page: 2,
        pageSize: 50,
      },
      'user'
    );
    expect((screen.getByLabelText('Anstellungsart') as HTMLSelectElement).value).toBe('Altwert');
    fireEvent.change(screen.getByLabelText('Titel suchen'), { target: { value: 'Neue Suche' } });
    expect(nextSearch).toMatchObject({
      q: 'Neue Suche',
      page: 1,
      pageSize: 50,
      type: 'jobs.job',
      employmentType: 'Altwert',
    });
    fireEvent.change(screen.getByLabelText('Titel suchen'), { target: { value: '' } });
    expect(nextSearch.q).toBeUndefined();
    fireEvent.change(screen.getByLabelText('Anstellungsart'), { target: { value: 'Vollzeit' } });
    expect(nextSearch).toMatchObject({ employmentType: 'Vollzeit', q: 'Stadt', page: 1 });
    fireEvent.change(screen.getByLabelText('Sichtbar'), { target: { value: 'true' } });
    expect(nextSearch.visible).toBe('true');
    fireEvent.change(screen.getByLabelText('Laufzeit'), { target: { value: 'planned' } });
    expect(nextSearch.temporal).toBe('planned');
    fireEvent.change(screen.getByLabelText('Laufzeit'), { target: { value: '' } });
    expect(nextSearch.temporal).toBeUndefined();
    fireEvent.change(screen.getByLabelText('Einträge pro Seite'), { target: { value: '100' } });
    expect(nextSearch).toMatchObject({ page: 1, pageSize: 100 });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(nextSearch).toMatchObject({ page: 3, pageSize: 50, q: 'Stadt' });
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(nextSearch.page).toBe(1);
  });

  it('reloads records for the selected principal and shows empty and failed lists distinctly', async () => {
    api.list
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, pageSize: 25, total: 0, hasNextPage: false },
      })
      .mockRejectedValueOnce(new Error('offline'));
    api.categories.mockRejectedValue(new Error('lookup unavailable'));
    render(
      <JobsListPage
        principalControl={{
          kind: 'selectable',
          value: 'organization',
          options: [
            { value: 'organization', label: 'Stadt' },
            { value: 'user', label: 'Persönlich' },
          ],
        }}
      />
    );
    await screen.findByText('Keine passenden Stellenanzeigen vorhanden.');
    expect(api.list).toHaveBeenLastCalledWith(expect.anything(), 'organization');
    fireEvent.change(screen.getByLabelText('Handeln als'), { target: { value: 'user' } });
    await screen.findByText('Die Stellenanzeigen konnten nicht geladen werden.');
    expect(api.list).toHaveBeenLastCalledWith(expect.anything(), 'user');
  });

  it('renders visible records with missing optional employer, expiry and updated-time data', async () => {
    api.list.mockResolvedValue({
      data: [
        {
          ...record,
          visible: true,
          updatedAt: 'unbekannt',
          input: { ...record.input, companies: [], dates: [] },
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, hasNextPage: false },
    });
    render(
      <JobsListPage principalControl={{ kind: 'fixed', value: 'organization', label: 'Stadt' }} />
    );
    const row = (await screen.findAllByRole('link', { name: 'Stadtentwicklung' }))
      .map((link) => link.closest('tr'))
      .find((row) => row !== null);
    expect(row?.textContent).toContain('Sichtbar');
    expect(row?.textContent).toContain('Zeitraum unvollständig');
    expect(row?.textContent).toContain('unbekannt');
    expect(api.list).toHaveBeenLastCalledWith(expect.anything(), 'organization');
  });

  it('loads Job-specific history and distinguishes create, update and visibility changes', async () => {
    api.history.mockResolvedValue(
      ['created', 'updated', 'status_changed'].map((action, index) => ({
        id: String(index),
        action,
        actor: 'Redaktion',
        changedFields: ['title'],
        createdAt: index === 0 ? 'nicht-datiert' : '2026-11-07T12:00:00Z',
      }))
    );
    render(<JobsEditPage />);
    await screen.findByRole('button', { name: 'Änderungen speichern' });
    fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));
    const table = await screen.findByRole('table', { name: 'Stellenanzeigenänderungen' });
    expect(table.textContent).toContain('Angelegt');
    expect(table.textContent).toContain('Bearbeitet');
    expect(table.textContent).toContain('Sichtbarkeit geändert');
    expect(table.textContent).toContain('nicht-datiert');
    expect(api.history).toHaveBeenCalledWith('42', { contentType: 'jobs.job' });
  });

  it('changes the editing principal without reusing the previous provider context', async () => {
    render(
      <JobsEditPage
        principalControl={{
          kind: 'selectable',
          value: 'organization',
          options: [
            { value: 'organization', label: 'Stadt' },
            { value: 'user', label: 'Persönlich' },
          ],
          readinessByPrincipal: { organization: 'ready', user: 'ready' },
        }}
      />
    );
    await screen.findByRole('button', { name: 'Änderungen speichern' });
    fireEvent.change(screen.getByLabelText('Handeln als'), { target: { value: 'user' } });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('42', 'user'));
    expect(api.categories).toHaveBeenLastCalledWith('user');
  });
});
afterEach(cleanup);
describe('Job page acceptance', () => {
  it('focuses and describes the first invalid field after submit', async () => {
    render(<JobsCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Stellenanzeige anlegen' }));
    await waitFor(() => expect(document.activeElement?.id).toBe('job-title'));
    const title = screen.getByLabelText(/Titel/);
    expect(title.getAttribute('aria-describedby')).toBe('job-title-error');
    expect(document.getElementById('job-title-error')?.textContent).toBe(
      'Bitte prüfen Sie diese Angabe.'
    );
    expect(api.save).not.toHaveBeenCalled();
  });
  it('explains a successful but empty employment lookup', async () => {
    api.categories.mockResolvedValue([]);
    render(<JobsCreatePage />);
    expect(
      await screen.findByText(
        'Keine Anstellungsarten verfügbar. Die Administration muss passende Kategorien freigeben.'
      )
    ).toBeDefined();
  });
  it('shows the employer in the overview and routes to the dedicated editor', async () => {
    render(<JobsListPage />);
    expect((await screen.findAllByText('Stadtverwaltung')).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Stadtentwicklung' })[0]!.getAttribute('href')).toBe(
      '/admin/jobs/42'
    );
    expect(screen.getByLabelText('Einträge pro Seite')).toBeDefined();
  });
  it('requires a named confirmation before deletion and offers no second delete after success', async () => {
    render(<JobsEditPage />);
    const button = await screen.findByRole('button', { name: 'Stellenanzeige löschen' });
    fireEvent.click(button);
    let dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Stadtentwicklung/)).toBeDefined();
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(button);
    dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stellenanzeige löschen' }));
    await screen.findByText('Die Stellenanzeige wurde gelöscht.');
    expect(api.remove).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Stellenanzeige löschen' })).toBeNull();
  });
});
