import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishSessionAccessSnapshot } from '@sva/plugin-sdk';
import { pluginConstructionSitesTranslations } from '../src/plugin.translations.js';
import {
  ConstructionSitesCreatePage,
  ConstructionSitesEditPage,
} from '../src/construction-sites.pages.js';
import { ConstructionSitesListPage } from '../src/construction-sites.list.js';
import { createConstructionSiteDefaults } from '../src/contract.js';
import { constructionSiteRequestHash } from '../src/construction-sites.api.js';
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
  drawingChange: undefined as undefined | ((drawing: boolean) => void),
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
  usePluginTranslation:
    () =>
    (key: string, variables: Record<string, string | number> = {}) => {
      const value = key
        .split('.')
        .reduce<unknown>(
          (value, part) =>
            value && typeof value === 'object'
              ? (value as Record<string, unknown>)[part]
              : undefined,
          pluginConstructionSitesTranslations.de['construction-sites']
        );
      return typeof value === 'string'
        ? value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(variables[name] ?? ''))
        : key;
    },
}));
vi.mock('../src/construction-sites.api.js', async (original) => ({
  ...(await original<object>()),
  getConstructionSite: (...args: unknown[]) => state.get(...args),
  saveConstructionSite: (...args: unknown[]) => state.save(...args),
  listConstructionSites: (...args: unknown[]) => state.list(...args),
  listConstructionSiteCategories: (...args: unknown[]) => state.categories(...args),
}));
vi.mock('../src/construction-sites.map.js', () => ({
  ConstructionSiteMap: (props: { onDrawingChange?: (drawing: boolean) => void }) => {
    state.drawingChange = props.onDrawingChange;
    return null;
  },
}));
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
  it('locks the initial create form before asynchronous request hashing starts', async () => {
    let finishHash: ((value: ArrayBuffer) => void) | undefined;
    const digest = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(
      () =>
        new Promise<ArrayBuffer>((resolve) => {
          finishHash = resolve;
        })
    );
    try {
      render(<ConstructionSitesCreatePage />);
      const title = screen.getByLabelText(/^Titel/);
      fireEvent.change(title, { target: { value: 'Brückenbau' } });
      fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen' }));
      await waitFor(() => expect(finishHash).toBeDefined());
      expect(title.matches(':disabled')).toBe(true);
      expect(state.save).not.toHaveBeenCalled();
      await act(async () => finishHash?.(new ArrayBuffer(32)));
      await screen.findByRole('link', { name: 'Gespeicherte Baustelle öffnen' });
      expect(state.save).toHaveBeenCalledTimes(1);
      expect(state.save.mock.calls[0]?.[1].site.title).toBe('Brückenbau');
    } finally {
      digest.mockRestore();
    }
  });
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
  it('uses title links and keeps filters, creation and pagination in the shared table', async () => {
    const { container } = render(<ConstructionSitesListPage />);
    const titles = await screen.findAllByRole('link', { name: 'Brückenbau' });
    expect(titles[0]?.getAttribute('href')).toBe('/admin/construction-sites/42');
    expect(screen.queryByRole('link', { name: 'Bearbeiten', exact: true })).toBeNull();
    const table = screen.getByRole('table', { name: 'Baustellen' });
    const frame = table.closest('[data-layout]');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent)
    ).toEqual(['Titel', 'Standort', 'Beginn', 'Ende', 'Zeitraumstatus', 'Letzte Änderung']);
    expect(frame?.contains(screen.getByLabelText('Titel suchen'))).toBe(true);
    expect(frame?.contains(screen.getByRole('link', { name: 'Baustelle anlegen' }))).toBe(true);
    expect(frame?.contains(screen.getByRole('navigation', { name: 'Baustellenseiten' }))).toBe(
      true
    );
    expect(container.querySelectorAll('a[href="/admin/construction-sites/new"]')).toHaveLength(1);
    expect(screen.getByText('1–1 von 1 Einträgen')).toBeTruthy();
  });
  it('keeps filters focused while loading and available after empty results or failures', async () => {
    const view = render(<ConstructionSitesListPage />);
    await screen.findAllByRole('link', { name: 'Brückenbau' });
    let finish: ((value: unknown) => void) | undefined;
    state.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const search = screen.getByLabelText('Titel suchen');
    search.focus();
    fireEvent.change(search, { target: { value: 'Brücke' } });
    state.search = { search: 'Brücke' };
    view.rerender(<ConstructionSitesListPage />);
    await screen.findByText('Baustellen werden geladen…');
    expect(screen.getByLabelText('Titel suchen')).toBe(search);
    expect(document.activeElement).toBe(search);
    expect(screen.queryByRole('link', { name: 'Brückenbau' })).toBeNull();
    await act(async () =>
      finish?.({
        data: [],
        pagination: { page: 1, pageSize: 25, hasNextPage: false, total: 0 },
      })
    );
    await screen.findByText('Keine passenden Baustellen vorhanden.');
    expect(document.activeElement).toBe(search);
    expect(screen.getByText('0–0 von 0 Einträgen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zurück' }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Weiter' }).matches(':disabled')).toBe(true);
    state.list.mockRejectedValueOnce(new Error('network'));
    state.search = { search: 'Brücke', category: 'Verkehr' };
    view.rerender(<ConstructionSitesListPage />);
    await screen.findByText('Die Baustellen konnten nicht geladen werden.');
    expect(document.activeElement).toBe(search);
    expect(screen.getByRole('link', { name: 'Baustelle anlegen' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Baustellenseiten' })).toBeNull();
  });
  it('opens readable sites without offering creation when the create permission is absent', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      subjectId: 'reader',
      instanceId: 'tenant',
      assignedModules: ['construction-sites'],
      roles: [],
      permissionActions: ['construction-sites.read'],
    });
    render(<ConstructionSitesListPage />);
    await screen.findAllByRole('link', { name: 'Brückenbau' });
    expect(screen.queryByRole('link', { name: 'Baustelle anlegen' })).toBeNull();
  });
  it('lists the primary location, dates and temporal state, preserving filters during pagination', async () => {
    state.search = { category: 'Verkehr', search: 'Brücke', page: 2 };
    state.list.mockResolvedValueOnce({
      data: [record],
      pagination: { page: 2, pageSize: 25, hasNextPage: true, total: 51 },
    });
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
    expect(screen.getByText('26–26 von 51 Einträgen')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Einträge pro Seite'), { target: { value: '50' } });
    const resized = state.navigate.mock.calls[1]?.[0];
    expect(resized.search(state.search)).toMatchObject({
      category: 'Verkehr',
      q: 'Brücke',
      page: 1,
      pageSize: 50,
      type: 'construction-sites.construction-site',
    });
  });
  it('edits optional traffic, zero coordinates, categories and rich text without losing their input', async () => {
    const { container } = render(<ConstructionSitesCreatePage />);
    fireEvent.change(screen.getByLabelText(/^Titel/), { target: { value: 'Road' } });
    fireEvent.change(screen.getByLabelText('Richtung'), { target: { value: 'Nord' } });
    fireEvent.change(screen.getByLabelText('Grund'), { target: { value: 'Brückenarbeiten' } });
    const traffic = screen.getByRole('heading', { name: 'Einschränkungen' }).closest('section')!;
    fireEvent.click(within(traffic).getByRole('button', { name: 'Hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Einschränkungen'), { target: { value: 'Langsam' } });
    const location = screen
      .getByRole('heading', { name: 'Standort, Strecken und Flächen' })
      .closest('section')!;
    fireEvent.click(within(location).getByRole('button', { name: 'Hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Bezeichnung'), { target: { value: 'Brücke' } });
    fireEvent.change(screen.getByLabelText('Breitengrad'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Längengrad'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'HTML' }));
    fireEvent.change(container.querySelector('textarea#cs-contentBlocks-0-body-html')!, {
      target: { value: '<p>Umleitung</p>' },
    });
    fireEvent.click(container.querySelector('details summary')!);
    await waitFor(() =>
      expect(screen.getByLabelText('Kategorien').matches(':disabled')).toBe(false)
    );
    fireEvent.click(screen.getByLabelText('Kategorien'));
    await screen.findByLabelText('Verkehr');
    fireEvent.click(screen.getByLabelText('Verkehr'));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Kategorien suchen' }), {
      key: 'Escape',
    });
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
    const location = screen
      .getByRole('heading', { name: 'Standort, Strecken und Flächen' })
      .closest('section')!;
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
    const visible = screen.getByRole('switch', { name: 'Sichtbar' });
    expect(visible.matches(':disabled')).toBe(false);
    expect(visible.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(visible);
    expect(screen.getByRole('switch', { name: 'Sichtbar' }).getAttribute('aria-checked')).toBe(
      'true'
    );
    expect(screen.getByText(/Die Baustelle wird sichtbar gespeichert/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0]?.[1].site.visible).toBe(true);
  });
  it('keeps selected categories while searching, closing and removing an unavailable category', async () => {
    state.get.mockResolvedValue({
      data: { ...record, input: { ...record.input, categories: [{ name: 'Bestand' }] } },
      access: { 'construction-sites.update': true },
    });
    const { container } = render(<ConstructionSitesEditPage />);
    await screen.findByDisplayValue('Brückenbau');
    fireEvent.click(screen.getByRole('tab', { name: 'Inhalt' }));
    fireEvent.click(container.querySelector('details summary')!);
    const trigger = screen.getByLabelText('Kategorien');
    await waitFor(() => expect(trigger.matches(':disabled')).toBe(false));
    expect(screen.getByText(/Nicht verfügbar/)).toBeTruthy();
    fireEvent.click(trigger);
    const search = screen.getByRole('textbox', { name: 'Kategorien suchen' });
    fireEvent.change(search, { target: { value: 'unbekannt' } });
    expect(screen.getByText('Keine passenden Kategorien gefunden.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kategorie Bestand entfernen' })).toBeTruthy();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Kategorie Bestand entfernen' }));
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Verkehr' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Kategorien suchen' }), {
      key: 'Escape',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0]?.[1].site.categories).toEqual([{ name: 'Verkehr' }]);
  });
  it('shows loading and failed category lookups without clearing existing selections', async () => {
    let reject!: (reason: Error) => void;
    state.categories.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        })
    );
    state.get.mockResolvedValue({
      data: { ...record, input: { ...record.input, categories: [{ name: 'Verkehr' }] } },
      access: { 'construction-sites.update': true },
    });
    const { container } = render(<ConstructionSitesEditPage />);
    await screen.findByDisplayValue('Brückenbau');
    fireEvent.click(screen.getByRole('tab', { name: 'Inhalt' }));
    fireEvent.click(container.querySelector('details summary')!);
    const trigger = screen.getByLabelText('Kategorien');
    expect(trigger.matches(':disabled')).toBe(true);
    expect(screen.getByText('Kategorien werden geladen…')).toBeTruthy();
    expect(screen.queryByText('Nicht verfügbar')).toBeNull();
    await act(async () => reject(new Error('offline')));
    expect(trigger.matches(':disabled')).toBe(true);
    expect(screen.getByText('Die Kategorieauswahl ist derzeit nicht verfügbar.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kategorie Verkehr entfernen' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0]?.[1].site.categories).toEqual([{ name: 'Verkehr' }]);
  });
  it('disables category changes and visibility for a read-only record', async () => {
    state.get.mockResolvedValue({
      data: {
        ...record,
        writeBlockedReason: 'construction_site_incomplete',
        input: {
          ...record.input,
          categories: [{ name: 'Verkehr' }],
        },
      },
      access: {},
    });
    const { container } = render(<ConstructionSitesEditPage />);
    await screen.findByDisplayValue('Brückenbau');
    expect(screen.getByRole('switch', { name: 'Sichtbar' }).matches(':disabled')).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: 'Inhalt' }));
    fireEvent.click(container.querySelector('details summary')!);
    expect(screen.getByLabelText('Kategorien').matches(':disabled')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Kategorie Verkehr entfernen' }).matches(':disabled')
    ).toBe(true);
    expect(state.save).not.toHaveBeenCalled();
  });
});

describe('geometry coordinate editor', () => {
  it('creates a route without a map and saves the same typed geometry draft', async () => {
    state.id = undefined;
    render(<ConstructionSitesCreatePage />);
    fireEvent.change(screen.getByLabelText(/^Titel/), { target: { value: 'Straßenbau' } });
    fireEvent.click(screen.getByRole('button', { name: 'Strecke über Koordinaten erfassen' }));
    const group = screen.getByRole('group', { name: 'Strecke 1', exact: true });
    for (const [label, value] of [
      ['Punkt 1: Längengrad', '13'],
      ['Punkt 1: Breitengrad', '52'],
      ['Punkt 2: Längengrad', '13.01'],
      ['Punkt 2: Breitengrad', '52.01'],
    ])
      fireEvent.change(within(group).getByLabelText(label!), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen', exact: true }));
    await waitFor(() => expect(state.save).toHaveBeenCalledOnce());
    expect(state.save.mock.calls[0]![1].site.geometry.features[0].geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [13, 52],
        [13.01, 52.01],
      ],
    });
  });
  it('prevents a server write while the map contains an unfinished drawing', async () => {
    state.id = undefined;
    render(<ConstructionSitesCreatePage />);
    fireEvent.change(screen.getByLabelText(/^Titel/), { target: { value: 'Straßenbau' } });
    act(() => state.drawingChange?.(true));
    fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen', exact: true }));
    expect(state.save).not.toHaveBeenCalled();
    act(() => state.drawingChange?.(false));
    fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen', exact: true }));
    await waitFor(() => expect(state.save).toHaveBeenCalledOnce());
  });
  it('removes the last feature with an explicit null deletion signal', async () => {
    state.id = undefined;
    render(<ConstructionSitesCreatePage />);
    fireEvent.change(screen.getByLabelText(/^Titel/), { target: { value: 'Straßenbau' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fläche über Koordinaten erfassen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Form löschen', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen', exact: true }));
    await waitFor(() => expect(state.save).toHaveBeenCalledOnce());
    expect(state.save.mock.calls[0]![1].site.geometry).toBeNull();
  });
});

it('reorders polygon points by keyboard controls while keeping the closing point automatic', async () => {
  state.id = undefined;
  render(<ConstructionSitesCreatePage />);
  fireEvent.change(screen.getByLabelText(/^Titel/), { target: { value: 'Platzsanierung' } });
  fireEvent.click(screen.getByRole('button', { name: 'Fläche über Koordinaten erfassen' }));
  const group = screen.getByRole('group', { name: 'Fläche 1', exact: true });
  for (const [index, longitude, latitude] of [
    [1, 13, 52],
    [2, 13.01, 52],
    [3, 13.01, 52.01],
  ]) {
    fireEvent.change(within(group).getByLabelText(`Punkt ${index}: Längengrad`), {
      target: { value: String(longitude) },
    });
    fireEvent.change(within(group).getByLabelText(`Punkt ${index}: Breitengrad`), {
      target: { value: String(latitude) },
    });
  }
  expect(within(group).queryByLabelText('Punkt 4: Breitengrad')).toBeNull();
  fireEvent.click(within(group).getByRole('button', { name: 'Punkt 3 nach oben verschieben' }));
  expect((within(group).getByLabelText('Punkt 2: Breitengrad') as HTMLInputElement).value).toBe(
    '52.01'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen', exact: true }));
  await waitFor(() => expect(state.save).toHaveBeenCalledOnce());
  const points = state.save.mock.calls[0]![1].site.geometry.features[0].geometry.coordinates[0];
  expect(points).toHaveLength(4);
  expect(points[0]).toEqual(points[3]);
  expect(points.slice(0, -1)).toEqual(
    expect.arrayContaining([
      [13, 52],
      [13.01, 52],
      [13.01, 52.01],
    ])
  );
});

it('stops coordinate creation at ten shapes and allows it again after removal', () => {
  state.id = undefined;
  render(<ConstructionSitesCreatePage />);
  const add = screen.getByRole('button', { name: 'Strecke über Koordinaten erfassen' });
  for (let index = 0; index < 10; index++) fireEvent.click(add);
  expect(add.matches(':disabled')).toBe(true);
  expect(
    screen.getByRole('button', { name: 'Fläche über Koordinaten erfassen' }).matches(':disabled')
  ).toBe(true);
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Strecke 10', exact: true })).getByRole('button', {
      name: 'Form löschen',
      exact: true,
    })
  );
  expect(add.matches(':disabled')).toBe(false);
});

it('shows stored coordinates without geometry mutation actions for a read-only record', async () => {
  publishSessionAccessSnapshot({
    isResolved: true,
    subjectId: 'actor',
    instanceId: 'tenant',
    assignedModules: ['construction-sites'],
    roles: [],
    permissionActions: ['construction-sites.read'],
    unscopedPermissionActions: [],
  });
  state.get.mockResolvedValue({
    data: {
      ...record,
      input: {
        ...record.input,
        geometry: {
          version: 1,
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: '8b51428e-832b-49ea-a9f7-537608e344e1',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [13, 52],
                  [13.01, 52.01],
                ],
              },
            },
          ],
        },
      },
    },
    access: { 'construction-sites.update': false },
  });
  render(<ConstructionSitesEditPage />);
  await screen.findByDisplayValue('Brückenbau');
  fireEvent.click(screen.getByRole('tab', { name: 'Inhalt' }));
  expect(screen.getByLabelText('Punkt 1: Breitengrad').matches(':disabled')).toBe(true);
  expect(screen.queryByRole('button', { name: 'Strecke über Koordinaten erfassen' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Form löschen', exact: true })).toBeNull();
  expect(state.save).not.toHaveBeenCalled();
});

it('hashes exactly the normalized geometry body sent to the server', async () => {
  state.id = undefined;
  let finish: ((result: typeof record) => void) | undefined;
  state.save.mockImplementationOnce(
    () =>
      new Promise<typeof record>((resolve) => {
        finish = resolve;
      })
  );
  render(<ConstructionSitesCreatePage />);
  fireEvent.change(screen.getByLabelText(/^Titel/), { target: { value: 'Straßenbau' } });
  fireEvent.click(screen.getByRole('button', { name: 'Strecke über Koordinaten erfassen' }));
  const group = screen.getByRole('group', { name: 'Strecke 1', exact: true });
  for (const [label, value] of [
    ['Punkt 1: Längengrad', '13.123456789'],
    ['Punkt 1: Breitengrad', '52'],
    ['Punkt 2: Längengrad', '13.01'],
    ['Punkt 2: Breitengrad', '52.01'],
  ])
    fireEvent.change(within(group).getByLabelText(label!), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Baustelle anlegen', exact: true }));
  await waitFor(() => expect(state.save).toHaveBeenCalledOnce());
  const body = state.save.mock.calls[0]![1];
  expect(body.site.geometry.features[0].geometry.coordinates[0][0]).toBe(13.123457);
  const key = Object.keys(sessionStorage).find((key) => key.startsWith('construction-sites:'));
  expect(key).toBeDefined();
  const pending = JSON.parse(sessionStorage.getItem(key!)!);
  expect(pending.inputHash).toBe(await constructionSiteRequestHash(body));
  await act(async () => finish?.(record));
});
