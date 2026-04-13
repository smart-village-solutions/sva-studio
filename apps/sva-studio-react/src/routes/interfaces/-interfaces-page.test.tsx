import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    vi.useRealTimers();
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
      expect(screen.getByText('Der Verbindungsstatus konnte nicht abgerufen werden.')).toBeTruthy();
    });
  });

  it('shows a load error when the overview request fails', async () => {
    state.loadOverview.mockRejectedValue(new Error('Kaputt'));

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Kaputt')).toBeTruthy();
    });
  });

  it('retries once after an unauthorized overview result', async () => {
    state.loadOverview
      .mockResolvedValueOnce({
        instanceId: '',
        config: null,
        status: {
          status: 'error',
          checkedAt: '2026-03-15T20:00:00.000Z',
          errorCode: 'unauthorized',
        },
      })
      .mockResolvedValueOnce({
        instanceId: 'hb-meinquartier',
        config: {
          instanceId: 'hb-meinquartier',
          providerKey: 'sva_mainserver',
          graphqlBaseUrl: 'https://hb-meinquartier.server.smart-village.app/graphql',
          oauthTokenUrl: 'https://hb-meinquartier.server.smart-village.app/oauth/token',
          enabled: true,
        },
        status: {
          status: 'connected',
          checkedAt: '2026-03-15T20:05:00.000Z',
        },
      });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(state.loadOverview).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 350);
      });
    });

    await waitFor(() => {
      expect(state.loadOverview).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Verbunden')).toBeTruthy();
    });
  });

  it('reloads after a persisted unauthorized status update', async () => {
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
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
          enabled: true,
        },
        status: {
          status: 'error',
          checkedAt: '2026-03-15T20:05:00.000Z',
          errorCode: 'unauthorized',
        },
      })
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
          checkedAt: '2026-03-15T20:06:00.000Z',
        },
      });
    state.saveSettings.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example/graphql',
      oauthTokenUrl: 'https://mainserver.example/oauth/token',
      enabled: true,
    });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Einstellungen speichern' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(state.loadOverview).toHaveBeenCalledTimes(3);
      expect(screen.getByText('Verbunden')).toBeTruthy();
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
    state.saveSettings.mockRejectedValue(
      new Error('invalid_config', {
        cause: {
          error: 'invalid_config',
          field: 'graphql_base_url',
        },
      })
    );

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Einstellungen speichern' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(screen.getByText('Die GraphQL Basis-URL ist ungültig.')).toBeTruthy();
    });
  });
});
