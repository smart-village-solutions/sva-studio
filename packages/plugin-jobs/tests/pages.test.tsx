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
  useSearch: () => ({}),
  useNavigate: () => api.navigate,
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
