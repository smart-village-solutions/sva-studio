import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppConfigurationEditor } from './-editor';

const state = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('../../lib/app-configuration-sync-api', () => ({
  readAppConfiguration: state.read,
  saveAppConfiguration: state.save,
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
