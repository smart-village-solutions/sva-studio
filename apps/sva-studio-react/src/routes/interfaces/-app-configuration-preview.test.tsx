import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoadedAppConfigurationPreview } from '@sva/sva-mainserver';
import { AppConfigurationPreview } from './-app-configuration-preview';

const state = vi.hoisted(() => ({ read: vi.fn(), organizationId: 'org-a' }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock('../../lib/app-configuration-preview-api', () => ({
  loadAppConfigurationPreview: state.read,
}));
vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-a', instanceId: 'tenant-a' }, isLoading: false }),
}));
vi.mock('../../hooks/use-organization-context', () => ({
  useOrganizationContext: () => ({
    context: { activeOrganizationId: state.organizationId },
    isLoading: false,
    isUpdating: false,
  }),
}));
// Navigation, session recovery and organization confirmation belong to the existing tested host boundary.
vi.mock('../../routing/content-editor-leave-boundary', () => ({
  ContentEditorLeaveBoundary: ({ children }: { children: React.ReactNode }) => children,
}));
const loaded: LoadedAppConfigurationPreview = {
  status: 'loaded',
  instanceId: 'tenant-a',
  requestedVersion: null,
  record: { id: '17', name: 'globalSettings', version: null },
  fallback: false,
  fields: {
    alternativeLocation: { state: 'value', value: false },
    tileTitleLines: { state: 'value', value: 3 },
  },
};
const load = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Konfiguration laden' }));
  await screen.findByLabelText('Alternative Standortwahl anzeigen');
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  state.read.mockReset().mockResolvedValue(structuredClone(loaded));
  state.organizationId = 'org-a';
});

describe('App configuration preview without saving', () => {
  it('loads only on demand and has no save action', async () => {
    render(<AppConfigurationPreview />);
    expect(state.read).not.toHaveBeenCalled();
    expect(screen.getByText(/Änderungen werden noch nicht gespeichert/)).toBeTruthy();
    await load();
    expect(state.read).toHaveBeenCalledWith({ data: { version: null } });
    expect(screen.getByLabelText('Alternative Standortwahl anzeigen')).toHaveProperty(
      'value',
      'false'
    );
    expect(screen.getByLabelText('Zeilen für Service-Kacheltitel')).toHaveProperty('value', '3');
    expect(screen.queryByRole('button', { name: /speichern/i })).toBeNull();
  });
  it('previews both local changes and discards them without another request', async () => {
    render(<AppConfigurationPreview />);
    await load();
    fireEvent.change(screen.getByLabelText('Alternative Standortwahl anzeigen'), {
      target: { value: 'true' },
    });
    fireEvent.change(screen.getByLabelText('Zeilen für Service-Kacheltitel'), {
      target: { value: '5' },
    });
    const preview = screen.getByRole('table', { name: 'Lokale Änderungsvorschau' });
    expect(within(preview).getByText('Nein')).toBeTruthy();
    expect(within(preview).getByText('Ja')).toBeTruthy();
    expect(within(preview).getByText('3')).toBeTruthy();
    expect(within(preview).getByText('5')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen verwerfen' }));
    expect(screen.getByLabelText('Alternative Standortwahl anzeigen')).toHaveProperty(
      'value',
      'false'
    );
    expect(screen.getByLabelText('Zeilen für Service-Kacheltitel')).toHaveProperty('value', '3');
    expect(screen.getByText('Noch keine lokalen Änderungen.')).toBeTruthy();
    expect(state.read).toHaveBeenCalledTimes(1);
  });
  it('validates positive whole numbers and distinguishes clearing a field', async () => {
    render(<AppConfigurationPreview />);
    await load();
    fireEvent.change(screen.getByLabelText('Zeilen für Service-Kacheltitel'), {
      target: { value: '1.5' },
    });
    expect(
      screen.getByLabelText('Zeilen für Service-Kacheltitel').getAttribute('aria-invalid')
    ).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('positive ganze Zahl');
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.change(screen.getByLabelText('Zeilen für Service-Kacheltitel'), {
      target: { value: '' },
    });
    expect(within(screen.getByRole('table')).getByText('Nicht gesetzt')).toBeTruthy();
    expect(state.read).toHaveBeenCalledTimes(1);
  });
  it('makes a returned version fallback explicit', async () => {
    state.read.mockResolvedValue({
      ...loaded,
      requestedVersion: '5.0.0',
      record: { ...loaded.record, version: '4.0.0' },
      fallback: true,
    });
    render(<AppConfigurationPreview />);
    fireEvent.change(screen.getByLabelText('Gewünschte App-Version'), {
      target: { value: '5.0.0' },
    });
    await load();
    expect(state.read).toHaveBeenCalledWith({ data: { version: '5.0.0' } });
    expect(screen.getByText(/andere Variante als angefragt/)).toBeTruthy();
    expect(screen.getByText('4.0.0')).toBeTruthy();
  });
  it('rejects invalid versions before making a request', async () => {
    render(<AppConfigurationPreview />);
    fireEvent.change(screen.getByLabelText('Gewünschte App-Version'), {
      target: { value: 'invalid / version' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Konfiguration laden' }));
    expect((await screen.findByRole('alert')).textContent).toContain('gültige App-Version');
    expect(state.read).not.toHaveBeenCalled();
  });
  it('confirms reloading and preserves drafts after a failed read', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AppConfigurationPreview />);
    await load();
    fireEvent.change(screen.getByLabelText('Zeilen für Service-Kacheltitel'), {
      target: { value: '7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Neu laden' }).closest('fieldset')?.disabled).toBe(
        false
      )
    );
    expect(state.read).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    state.read.mockRejectedValueOnce(new Error('unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    await screen.findByText(/Die Konfiguration konnte nicht geladen werden/);
    expect(screen.getByLabelText('Zeilen für Service-Kacheltitel')).toHaveProperty('value', '7');
  });
  it('does not create a blank editor from an unresolved response', async () => {
    state.read.mockResolvedValue({ status: 'unavailable', reason: 'not_resolved' });
    render(<AppConfigurationPreview />);
    fireEvent.click(screen.getByRole('button', { name: 'Konfiguration laden' }));
    await screen.findByText(/keinen eindeutig aufgelösten Datensatz/);
    expect(screen.queryByLabelText('Zeilen für Service-Kacheltitel')).toBeNull();
  });
  it('clears the loaded editor when the confirmed organization changes', async () => {
    const view = render(<AppConfigurationPreview />);
    await load();
    state.organizationId = 'org-b';
    view.rerender(<AppConfigurationPreview />);
    await waitFor(() =>
      expect(screen.queryByLabelText('Zeilen für Service-Kacheltitel')).toBeNull()
    );
    expect(state.read).toHaveBeenCalledTimes(1);
  });
  it('retains a dirty draft across an involuntary context change', async () => {
    const view = render(<AppConfigurationPreview />);
    await load();
    fireEvent.change(screen.getByLabelText('Zeilen für Service-Kacheltitel'), {
      target: { value: '7' },
    });
    state.organizationId = 'org-b';
    view.rerender(<AppConfigurationPreview />);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    state.organizationId = 'org-a';
    view.rerender(<AppConfigurationPreview />);
    expect(screen.getByRole('spinbutton')).toHaveProperty('value', '7');
    expect(state.read).toHaveBeenCalledTimes(1);
  });
  it('retains local changes when a reload cannot resolve the document', async () => {
    render(<AppConfigurationPreview />);
    await load();
    fireEvent.change(screen.getByLabelText('Zeilen für Service-Kacheltitel'), {
      target: { value: '7' },
    });
    state.read.mockResolvedValueOnce({ status: 'unavailable', reason: 'not_resolved' });
    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    await screen.findByText(/keinen eindeutig aufgelösten Datensatz/);
    expect(screen.getByRole('spinbutton')).toHaveProperty('value', '7');
  });
});
