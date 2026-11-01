import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishSessionAccessSnapshot } from '@sva/plugin-sdk';
import { pluginConstructionSitesTranslations } from '../src/plugin.translations.js';
import {
  ConstructionSitesCreatePage,
  ConstructionSitesEditPage,
} from '../src/construction-sites.pages.js';
import { ConstructionSitesListPage } from '../src/construction-sites.list.js';
import { createConstructionSiteDefaults } from '../src/contract.js';
const state = vi.hoisted(() => ({
  id: '42' as string | undefined,
  search: {} as Record<string, unknown>,
  navigate: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  list: vi.fn(),
  categories: vi.fn(),
  history: vi.fn(),
  realMedia: false,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string;
    params?: { id?: string };
    children: React.ReactNode;
  }) => (
    <a {...props} href={to.replace('$id', params?.id ?? '')}>
      {children}
    </a>
  ),
  useParams: () => ({ id: state.id }),
  useSearch: () => state.search,
  useNavigate: () => state.navigate,
}));
vi.mock('@sva/plugin-sdk', async (original) => ({
  ...(await original<object>()),
  fetchIamContentHistory: (...args: unknown[]) => state.history(...args),
  usePluginTranslation: () => (key: string) =>
    key
      .split('.')
      .reduce<unknown>(
        (value, part) =>
          value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined,
        pluginConstructionSitesTranslations.de['construction-sites']
      ) ?? key,
}));
vi.mock('../src/construction-sites.api.js', async (original) => ({
  ...(await original<object>()),
  getConstructionSite: (...args: unknown[]) => state.get(...args),
  saveConstructionSite: (...args: unknown[]) => state.save(...args),
  listConstructionSites: (...args: unknown[]) => state.list(...args),
  listConstructionSiteCategories: (...args: unknown[]) => state.categories(...args),
}));
vi.mock('../src/construction-sites.map.js', () => ({ ConstructionSiteMap: () => null }));
vi.mock('../src/construction-sites.form-media.js', async (original) => {
  const actual = await original<typeof import('../src/construction-sites.form-media.js')>();
  return {
    ConstructionSiteMediaFields: (
      props: React.ComponentProps<typeof actual.ConstructionSiteMediaFields>
    ) => (state.realMedia ? <actual.ConstructionSiteMediaFields {...props} /> : null),
  };
});
const record = {
  id: '42',
  genericType: 'ConstructionSite' as const,
  title: 'Brückenbau',
  visible: false,
  updatedAt: '2026-11-01T12:00:00Z',
  contentFingerprint: 'a'.repeat(64),
  input: {
    ...createConstructionSiteDefaults('2026-11-01'),
    title: 'Brückenbau',
    locations: [{ name: 'Brücke', latitude: 0, longitude: 0 }],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  state.search = {};
  state.id = '42';
  state.realMedia = false;
  publishSessionAccessSnapshot({
    isResolved: true,
    subjectId: 'actor',
    instanceId: 'tenant',
    assignedModules: ['construction-sites'],
    roles: [],
    permissionActions: [
      'construction-sites.read',
      'construction-sites.create',
      'construction-sites.update',
    ],
    unscopedPermissionActions: ['construction-sites.update'],
  });
  state.categories.mockResolvedValue([{ id: '1', name: 'Verkehr' }]);
  state.save.mockResolvedValue(record);
  state.get.mockResolvedValue({
    data: record,
    access: { 'construction-sites.read': true, 'construction-sites.update': true },
  });
  state.list.mockResolvedValue({
    data: [record],
    pagination: { page: 1, pageSize: 25, hasNextPage: false, total: 1 },
  });
});
afterEach(cleanup);
describe('construction site editorial UI', () => {
  it('switches the overview and its category lookup between permitted author principals', async () => {
    render(
      <ConstructionSitesListPage
        principalControl={{
          kind: 'selectable',
          value: 'organization',
          options: [
            { value: 'organization', label: 'Organisation' },
            { value: 'user', label: 'Persönlich' },
          ],
        }}
      />
    );
    await waitFor(() =>
      expect(state.list).toHaveBeenLastCalledWith(expect.anything(), 'organization')
    );
    fireEvent.change(screen.getByLabelText('Handeln als'), { target: { value: 'user' } });
    await waitFor(() => expect(state.list).toHaveBeenLastCalledWith(expect.anything(), 'user'));
    expect(state.categories).toHaveBeenLastCalledWith('user');
  });
  it('opens the media details and focuses the actual invalid URL field from the error summary', async () => {
    state.realMedia = true;
    state.get.mockResolvedValue({
      data: {
        ...record,
        input: {
          ...record.input,
          mediaContents: [
            {
              contentType: 'image',
              sourceUrl: { url: 'invalid', description: '' },
              captionText: '',
              copyright: '',
            },
          ],
        },
      },
      access: { 'construction-sites.update': true },
    });
    const { container } = render(<ConstructionSitesEditPage />);
    await screen.findByDisplayValue('Brückenbau');
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Bitte prüfen Sie diese Angabe.' }));
    const url = screen.getByDisplayValue('invalid');
    await waitFor(() => expect(document.activeElement).toBe(url));
    expect((container.querySelector('#cs-mediaContents') as HTMLDetailsElement).open).toBe(true);
    expect(url.getAttribute('aria-invalid')).toBe('true');
    expect(state.save).not.toHaveBeenCalled();
  });
  it('creates through the onepager and exposes the saved identity without submitting again', async () => {
    render(<ConstructionSitesCreatePage />);
    fireEvent.change(screen.getByLabelText(/^Titel/), { target: { value: 'Brückenbau' } });
    fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0]?.[1].site.visible).toBe(false);
    await screen.findByRole('link', { name: 'Gespeicherte Baustelle öffnen' });
    expect(screen.queryByRole('button', { name: 'Baustelle anlegen' })).toBeNull();
  });
  it('keeps an intentionally chosen end date and updates the same record with its baseline', async () => {
    render(
      <ConstructionSitesEditPage
        principalControl={{ kind: 'fixed', value: 'user', label: 'Editor One' }}
      />
    );
    await screen.findByDisplayValue('Brückenbau');
    fireEvent.change(screen.getByLabelText(/^Ende/), { target: { value: '2026-12-20' } });
    fireEvent.change(screen.getByLabelText(/^Beginn/), { target: { value: '2026-11-15' } });
    expect((screen.getByLabelText(/^Ende/) as HTMLInputElement).value).toBe('2026-12-20');
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0]?.slice(0, 2)).toEqual([
      '42',
      {
        site: expect.objectContaining({
          dates: [{ dateStart: '2026-11-15', dateEnd: '2026-12-20' }],
        }),
        baseFingerprint: 'a'.repeat(64),
      },
    ]);
  });
  it('blocks malformed legacy structures visibly and disables editing', async () => {
    state.get.mockResolvedValue({
      data: { ...record, writeBlockedReason: 'construction_site_dependents_unsupported' },
      access: { 'construction-sites.update': true },
    });
    render(<ConstructionSitesEditPage />);
    await screen.findByText(/Dieser Eintrag kann hier nur gelesen werden/);
    expect(screen.getByLabelText(/^Titel/).matches(':disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Änderungen speichern' })).toBeNull();
  });
  it('lists the primary location, dates and temporal state, preserving filters during pagination', async () => {
    state.search = { category: 'Verkehr', page: 2 };
    render(
      <ConstructionSitesListPage
        principalControl={{ kind: 'fixed', value: 'organization', label: 'Town' }}
      />
    );
    await screen.findAllByText('Brückenbau');
    expect(screen.getAllByText('Brücke').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026-11-01').length).toBeGreaterThan(0);
    expect(state.list).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Verkehr', page: 2 }),
      'organization'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    const navigation = state.navigate.mock.calls[0]?.[0];
    expect(navigation.search(state.search)).toMatchObject({ category: 'Verkehr', page: 1 });
  });
  it('edits optional traffic, zero coordinates, categories and rich text without losing their input', async () => {
    const { container } = render(<ConstructionSitesCreatePage />);
    fireEvent.change(screen.getByLabelText(/^Titel/), { target: { value: 'Road' } });
    fireEvent.change(screen.getByLabelText('Richtung'), { target: { value: 'Nord' } });
    fireEvent.change(screen.getByLabelText('Grund'), { target: { value: 'Brückenarbeiten' } });
    const traffic = screen.getByRole('heading', { name: 'Einschränkungen' }).closest('section')!;
    fireEvent.click(within(traffic).getByRole('button', { name: 'Hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Einschränkungen'), { target: { value: 'Langsam' } });
    const location = screen.getByRole('heading', { name: 'Standort' }).closest('section')!;
    fireEvent.click(within(location).getByRole('button', { name: 'Hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Bezeichnung'), { target: { value: 'Brücke' } });
    fireEvent.change(screen.getByLabelText('Breitengrad'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Längengrad'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));
    fireEvent.change(container.querySelector('textarea#cs-contentBlocks-0-body-html')!, {
      target: { value: '<p>Umleitung</p>' },
    });
    await screen.findByLabelText('Verkehr');
    fireEvent.click(container.querySelector('details summary')!);
    fireEvent.click(screen.getByLabelText('Verkehr'));
    fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0]?.[1].site).toMatchObject({
      direction: 'Nord',
      cause: 'Brückenarbeiten',
      restrictions: [{ description: 'Langsam' }],
      locations: [{ name: 'Brücke', latitude: 0, longitude: 0 }],
      categories: [{ name: 'Verkehr' }],
      contentBlocks: [{ body: '<p>Umleitung</p>' }],
    });
  });
  it('removes optional rows and selects an explicit media kind while preserving extra rows', async () => {
    const input = {
      ...record.input,
      restrictions: [
        { sourceIndex: 0, description: 'One' },
        { sourceIndex: 1, description: 'Two' },
      ],
      contentBlocks: [],
      mediaContents: [
        {
          sourceIndex: 0,
          contentType: 'image',
          sourceUrl: { url: 'https://example.test/image.jpg', description: '' },
          captionText: '',
          copyright: '',
        },
      ],
    };
    state.get.mockResolvedValue({
      data: { ...record, input },
      access: { 'construction-sites.update': true },
    });
    render(<ConstructionSitesEditPage />);
    await screen.findByDisplayValue('Brückenbau');
    fireEvent.click(screen.getByRole('tab', { name: 'Inhalt' }));
    const traffic = screen.getByRole('heading', { name: 'Einschränkungen' }).closest('section')!;
    fireEvent.click(within(traffic).getAllByRole('button', { name: 'Entfernen' })[0]!);
    fireEvent.change(screen.getByDisplayValue('Two'), { target: { value: 'Remaining' } });
    const location = screen.getByRole('heading', { name: 'Standort' }).closest('section')!;
    fireEvent.click(within(location).getByRole('button', { name: 'Entfernen' }));
    const description = screen
      .getByRole('heading', { name: 'Weitere Informationen' })
      .closest('section')!;
    fireEvent.click(within(description).getByRole('button', { name: 'Hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Dateiart'), { target: { value: 'attachement' } });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0]?.[1].site).toMatchObject({
      restrictions: [{ sourceIndex: 1, description: 'Remaining' }],
      locations: [],
      mediaContents: [{ sourceIndex: 0, contentType: 'attachement' }],
    });
  });
  it('distinguishes empty results and fetch failures and resets pagination when filtering', async () => {
    state.list.mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false, total: 0 },
    });
    const first = render(<ConstructionSitesListPage />);
    await screen.findByText('Keine passenden Baustellen vorhanden.');
    fireEvent.change(screen.getByLabelText('Titel suchen'), { target: { value: 'Brücke' } });
    expect(
      state.navigate.mock.calls[0]?.[0].search({ page: 4, category: 'Verkehr' })
    ).toMatchObject({ page: 1, category: 'Verkehr', q: 'Brücke' });
    fireEvent.change(screen.getByLabelText('Beginn'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Ende'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('Kategorien'), { target: { value: 'Verkehr' } });
    first.unmount();
    state.list.mockRejectedValue(new Error('network'));
    render(<ConstructionSitesListPage />);
    await screen.findByText('Die Baustellen konnten nicht geladen werden.');
  });
  it('loads real host history and labels creation, visibility and ordinary updates', async () => {
    state.history.mockResolvedValue(
      ['created', 'status_changed', 'updated'].map((action, index) => ({
        id: String(index),
        action,
        actor: 'Editor',
        changedFields: [],
        createdAt: index === 2 ? 'legacy date' : '2026-11-01T12:00:00Z',
        summary: 'Changed',
      }))
    );
    render(<ConstructionSitesEditPage />);
    await screen.findByDisplayValue('Brückenbau');
    fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));
    await screen.findByText('Angelegt');
    expect(screen.getByText('Sichtbarkeit geändert')).toBeTruthy();
    expect(state.history).toHaveBeenCalledWith('42', {
      contentType: 'construction-sites.construction-site',
    });
    expect(screen.getByText('legacy date')).toBeTruthy();
  });
  it('shows category failures separately and focuses an invalid required field from the summary', async () => {
    state.categories.mockRejectedValue(new Error('network'));
    render(<ConstructionSitesCreatePage />);
    await screen.findByText(/Die Kategorien konnten nicht geladen werden/);
    fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen' }));
    await screen.findByText('Bitte prüfen Sie die folgenden Angaben.');
    fireEvent.click(screen.getByRole('link', { name: 'Bitte prüfen Sie diese Angabe.' }));
    await waitFor(() => expect(document.activeElement?.id).toBe('cs-title'));
    expect(state.save).not.toHaveBeenCalled();
  });
  it('offers explicit visibility only with the host publication permission', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      subjectId: 'actor',
      instanceId: 'tenant',
      assignedModules: ['construction-sites'],
      roles: [],
      permissionActions: [
        'construction-sites.read',
        'construction-sites.create',
        'content.publish',
      ],
    });
    render(<ConstructionSitesCreatePage />);
    fireEvent.change(screen.getByLabelText(/^Titel/), { target: { value: 'Visible road' } });
    const visible = screen.getByLabelText('Sichtbar');
    expect(visible.matches(':disabled')).toBe(false);
    fireEvent.click(visible);
    expect(screen.getByText(/Die Baustelle wird sichtbar gespeichert/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0]?.[1].site.visible).toBe(true);
  });
});
