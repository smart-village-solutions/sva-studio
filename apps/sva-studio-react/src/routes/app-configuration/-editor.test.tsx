import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppConfigurationEditor } from './-editor';

const state = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), change: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('../../lib/app-configuration-sync-api', () => ({
  readAppConfiguration: state.read,
  saveAppConfiguration: state.save,
  changeAppConfigurationVariant: state.change,
}));
vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'user',
      instanceId: 'sandbox',
      permissionActions: ['application-workspace.settings.update'],
    },
    isLoading: false,
  }),
}));
vi.mock('../../providers/effective-access-provider', () => ({
  useEffectiveAccess: () => ({ decide: () => ({ status: 'allowed' }) }),
}));
vi.mock('../../hooks/use-organization-context', () => ({
  useOrganizationContext: () => ({ context: { activeOrganizationId: 'org' } }),
}));
vi.mock('../../routing/content-editor-leave-boundary', () => ({
  ContentEditorLeaveBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

const row = { id: '10', name: 'globalSettings', version: null, updatedAt: '2026-11-23T00:00:00Z' };
const documentFor = (revision: string, value: number) => ({
  ...row,
  canCopy: false,
  revision,
  fields: {
    alternativeLocation: { state: 'value', value: false },
    tileTitleLines: { state: 'value', value },
  },
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Application workspace JSON settings', () => {
  it('selects a real variant and submits explicit field choices for the reviewed revision', async () => {
    state.read
      .mockResolvedValueOnce({ ok: true, data: [row] })
      .mockResolvedValueOnce({ ok: true, data: documentFor('old', 2) });
    state.save
      .mockResolvedValueOnce({
        ok: true,
        data: { status: 'review', document: documentFor('new', 3), conflicts: ['tileTitleLines'] },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { status: 'saved', document: documentFor('saved', 4) },
      });
    render(<AppConfigurationEditor />);
    await screen.findByRole('option', { name: 'globalSettings' });
    fireEvent.change(screen.getByRole('combobox', { name: 'JSON-Datei' }), {
      target: { value: row.name },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'App-Version' }), {
      target: { value: row.id },
    });
    const lines = await screen.findByRole('spinbutton', { name: /Kacheltitel/ });
    expect(state.read).toHaveBeenLastCalledWith({ data: { id: '10' } });
    fireEvent.change(lines, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Im Mainserver speichern' }));
    const comparison = await screen.findByRole('table');
    expect(within(comparison).getByText('2')).toBeTruthy();
    expect(within(comparison).getByText('3')).toBeTruthy();
    expect(within(comparison).getByText('4')).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Auswahl bestätigen und speichern' });
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.change(within(comparison).getByRole('combobox', { name: /Kacheltitel/ }), {
      target: { value: 'studio' },
    });
    fireEvent.click(confirm);
    await screen.findByText('Stand im Mainserver geprüft.');
    await waitFor(() =>
      expect(state.save).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          id: '10',
          reviewedRevision: 'new',
          changes: { tileTitleLines: 4 },
          choices: { tileTitleLines: 'studio' },
        }),
      })
    );
  });
});

it('copies a selected version and requires explicit confirmation before deleting its new ID', async () => {
  const template = { ...documentFor('r1', 2), name: 'globalsettings', canCopy: true };
  const created = { ...template, id: '11', version: '2.1.0', revision: 'r2' };
  state.read
    .mockResolvedValueOnce({ ok: true, data: [template] })
    .mockResolvedValueOnce({ ok: true, data: template });
  state.change
    .mockResolvedValueOnce({ ok: true, data: { status: 'created', document: created } })
    .mockResolvedValueOnce({ ok: true, data: { status: 'deleted' } });
  render(<AppConfigurationEditor />);
  await screen.findByRole('option', { name: template.name });
  fireEvent.change(screen.getByRole('combobox', { name: 'JSON-Datei' }), {
    target: { value: template.name },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'App-Version' }), {
    target: { value: template.id },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Neue Variante anlegen' }));
  const copy = await screen.findByRole('alertdialog');
  expect(within(copy).getByText(/globalsettings.*ID 10/)).toBeTruthy();
  fireEvent.change(within(copy).getByLabelText('Version der neuen Variante'), {
    target: { value: '2.1.0' },
  });
  fireEvent.click(within(copy).getByRole('button', { name: 'Kopie anlegen' }));
  await screen.findByText('Die Kopie wurde im Mainserver bestätigt.');
  expect(state.change).toHaveBeenLastCalledWith({
    data: { operation: 'create', id: '10', revision: 'r1', version: '2.1.0' },
  });
  expect(screen.getByRole('combobox', { name: 'App-Version' })).toHaveProperty('value', '11');

  fireEvent.click(screen.getByRole('button', { name: 'Variante löschen' }));
  const deletion = await screen.findByRole('alertdialog');
  expect(within(deletion).getByText(/globalsettings.*2.1.0.*ID 11/)).toBeTruthy();
  expect(state.change).toHaveBeenCalledTimes(1);
  fireEvent.click(within(deletion).getByRole('button', { name: 'Endgültig löschen' }));
  await screen.findByText('Die Variante wurde im Mainserver gelöscht.');
  expect(state.change).toHaveBeenLastCalledWith({
    data: { operation: 'delete', id: '11', revision: 'r2' },
  });
  expect(screen.queryByRole('option', { name: /2.1.0/ })).toBeNull();
});
