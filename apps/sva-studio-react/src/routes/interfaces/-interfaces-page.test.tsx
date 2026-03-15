import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InterfacesPage } from './-interfaces-page';

const state = vi.hoisted(() => {
  const loadToken = () => undefined;
  const saveToken = () => undefined;

  return {
    loadToken,
    saveToken,
    loadOverview: vi.fn(),
    saveSettings: vi.fn(),
  };
});

vi.mock('@tanstack/react-start', () => ({
  useServerFn: (serverFn: unknown) => {
    if (serverFn === state.loadToken) {
      return state.loadOverview;
    }

    if (serverFn === state.saveToken) {
      return state.saveSettings;
    }

    throw new Error('Unexpected server function token');
  },
}));

vi.mock('../../lib/interfaces-api', () => ({
  loadInterfacesOverview: state.loadToken,
  saveSvaMainserverInterfaceSettings: state.saveToken,
}));

describe('InterfacesPage', () => {
  beforeEach(() => {
    state.loadOverview.mockReset();
    state.saveSettings.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a loading state before the overview request resolves', () => {
    state.loadOverview.mockImplementation(() => new Promise(() => undefined));

    render(<InterfacesPage />);

    expect(screen.getByText('Schnittstellen werden geladen ...')).toBeTruthy();
  });

  it('loads the overview and saves updated settings', async () => {
    state.loadOverview
      .mockResolvedValueOnce({
        instanceId: 'de-musterhausen',
        config: {
          instanceId: 'de-musterhausen',
          providerKey: 'sva_mainserver',
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
          enabled: true,
        },
        status: {
          status: 'connected',
          checkedAt: '2026-03-15T20:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        instanceId: 'de-musterhausen',
        config: {
          instanceId: 'de-musterhausen',
          providerKey: 'sva_mainserver',
          graphqlBaseUrl: 'https://next.example/graphql',
          oauthTokenUrl: 'https://next.example/oauth/token',
          enabled: false,
        },
        status: {
          status: 'error',
          checkedAt: '2026-03-15T20:05:00.000Z',
          errorCode: 'network_error',
          errorMessage: 'Verbindungsstatus konnte nicht abgerufen werden.',
        },
      });
    state.saveSettings.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://next.example/graphql',
      oauthTokenUrl: 'https://next.example/oauth/token',
      enabled: false,
    });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Schnittstellen' })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('GraphQL Basis-URL'), {
      target: { value: 'https://next.example/graphql' },
    });
    fireEvent.change(screen.getByLabelText('OAuth Token-URL'), {
      target: { value: 'https://next.example/oauth/token' },
    });
    fireEvent.click(screen.getByLabelText('Integration aktiv'));
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(state.saveSettings).toHaveBeenCalledWith({
        data: {
          graphqlBaseUrl: 'https://next.example/graphql',
          oauthTokenUrl: 'https://next.example/oauth/token',
          enabled: false,
        },
      });
    });

    await waitFor(() => {
      expect(state.loadOverview).toHaveBeenCalledTimes(2);
      expect(screen.getByDisplayValue('https://next.example/graphql')).toBeTruthy();
      expect(screen.getByDisplayValue('https://next.example/oauth/token')).toBeTruthy();
      expect(screen.getByText('Verbindungsstatus konnte nicht abgerufen werden.')).toBeTruthy();
    });
  });

  it('shows a load error when the overview request fails', async () => {
    state.loadOverview.mockRejectedValue(new Error('Kaputt'));

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Kaputt')).toBeTruthy();
    });
  });

  it('reloads the overview when the reload action is used', async () => {
    state.loadOverview
      .mockResolvedValueOnce({
        instanceId: 'de-musterhausen',
        config: null,
        status: {
          status: 'error',
          checkedAt: '2026-03-15T20:00:00.000Z',
          errorCode: 'forbidden',
          errorMessage: 'Keine Berechtigung zur Schnittstellenverwaltung.',
        },
      })
      .mockResolvedValueOnce({
        instanceId: 'de-musterhausen',
        config: null,
        status: {
          status: 'connected',
          checkedAt: '2026-03-15T20:10:00.000Z',
        },
      });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Keine Berechtigung zur Schnittstellenverwaltung.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));

    await waitFor(() => {
      expect(state.loadOverview).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Verbunden')).toBeTruthy();
    });
  });

  it('shows a save error when persisting settings fails', async () => {
    state.loadOverview.mockResolvedValue({
      instanceId: 'de-musterhausen',
      config: {
        instanceId: 'de-musterhausen',
        providerKey: 'sva_mainserver',
        graphqlBaseUrl: 'https://mainserver.example/graphql',
        oauthTokenUrl: 'https://mainserver.example/oauth/token',
        enabled: true,
      },
      status: {
        status: 'connected',
        checkedAt: '2026-03-15T20:00:00.000Z',
      },
    });
    state.saveSettings.mockRejectedValue({ response: { data: { message: 'Speichern fehlgeschlagen' } } });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Einstellungen speichern' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(screen.getByText('Speichern fehlgeschlagen')).toBeTruthy();
    });
  });
});
