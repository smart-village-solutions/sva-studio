import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InterfacesPage } from './-interfaces-page';

const state = vi.hoisted(() => {
  const listToken = () => undefined;
  const saveToken = () => undefined;
  const upsertToken = () => undefined;
  const deleteToken = () => undefined;

  return {
    deleteInterface: vi.fn(),
    deleteToken,
    listInterfaces: vi.fn(),
    listToken,
    saveMainserver: vi.fn(),
    saveToken,
    upsertInterface: vi.fn(),
    upsertToken,
  };
});

vi.mock('@tanstack/react-start', () => ({
  useServerFn: (serverFn: unknown) => {
    if (serverFn === state.listToken) return state.listInterfaces;
    if (serverFn === state.saveToken) return state.saveMainserver;
    if (serverFn === state.upsertToken) return state.upsertInterface;
    if (serverFn === state.deleteToken) return state.deleteInterface;
    throw new Error('Unexpected server function token');
  },
}));

vi.mock('../../lib/interfaces-api', () => ({
  deleteInstanceInterfaceServerFn: state.deleteToken,
  listInstanceInterfacesServerFn: state.listToken,
  saveSvaMainserverInterfaceSettings: state.saveToken,
  upsertInstanceInterfaceServerFn: state.upsertToken,
}));

const mainserverEntry = {
  id: 'mainserver:de-musterhausen',
  instanceId: 'de-musterhausen',
  type: 'mainserver',
  name: 'SVA Mainserver',
  enabled: true,
  status: 'connected',
  lastCheckedAt: '2026-03-15T20:00:00.000Z',
  createdAt: '2026-03-15T20:00:00.000Z',
  updatedAt: '2026-03-15T20:00:00.000Z',
  config: {
    graphqlBaseUrl: 'https://mainserver.example/graphql',
    oauthTokenUrl: 'https://mainserver.example/oauth/token',
  },
} as const;

const s3Entry = {
  id: 's3-1',
  instanceId: 'de-musterhausen',
  type: 's3',
  name: 'Uploads',
  enabled: true,
  status: 'unknown',
  statusMessage: 'Pending health check',
  lastCheckedAt: '2026-03-15T20:01:00.000Z',
  createdAt: '2026-03-15T20:01:00.000Z',
  updatedAt: '2026-03-15T20:01:00.000Z',
  config: {
    endpoint: 'https://s3.example',
    region: 'eu-central-1',
    bucket: 'uploads',
    accessKeyId: 'key-1',
    secretAccessKey: '',
    forcePathStyle: false,
  },
} as const;

describe('InterfacesPage', () => {
  beforeEach(() => {
    state.deleteInterface.mockReset();
    state.listInterfaces.mockReset();
    state.saveMainserver.mockReset();
    state.upsertInterface.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads the interface table and saves mainserver settings through the dedicated endpoint', async () => {
    state.listInterfaces.mockResolvedValue({
      instanceId: 'de-musterhausen',
      entries: [mainserverEntry, s3Entry],
    });
    state.saveMainserver.mockResolvedValue({
      ...mainserverEntry.config,
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      enabled: false,
    });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Schnittstellen' })).toBeTruthy();
      expect(screen.getByText('2 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]!);
    fireEvent.change(screen.getByLabelText('GraphQL Basis-URL'), {
      target: { value: 'https://next.example/graphql' },
    });
    fireEvent.change(screen.getByLabelText('OAuth Token-URL'), {
      target: { value: 'https://next.example/oauth/token' },
    });
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(state.saveMainserver).toHaveBeenCalledWith({
        data: {
          enabled: false,
          graphqlBaseUrl: 'https://next.example/graphql',
          oauthTokenUrl: 'https://next.example/oauth/token',
        },
      });
    });

    expect(state.upsertInterface).not.toHaveBeenCalled();
    expect(screen.getByText('Schnittstellen-Einstellungen wurden gespeichert.')).toBeTruthy();
  });

  it('creates an s3 interface through the picker dialog and upsert endpoint', async () => {
    state.listInterfaces.mockResolvedValue({
      instanceId: 'de-musterhausen',
      entries: [mainserverEntry],
    });
    state.upsertInterface.mockResolvedValue({
      ...s3Entry,
      config: { ...s3Entry.config, secretAccessKey: '' },
    });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Neue Schnittstelle' }));
    fireEvent.click(screen.getByRole('radio', { name: /S3-kompatibler Object Storage/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0]!, { target: { value: 'Medien-S3' } });
    fireEvent.change(textboxes[1]!, { target: { value: 'https://s3.example' } });
    fireEvent.change(textboxes[3]!, { target: { value: 'media-bucket' } });
    fireEvent.change(textboxes[4]!, { target: { value: 'key-2' } });
    fireEvent.change(document.getElementById('s3-secret-key')!, { target: { value: 'secret-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(state.upsertInterface).toHaveBeenCalledWith({
        data: {
          instanceId: 'de-musterhausen',
          draft: expect.objectContaining({
            type: 's3',
            name: 'Medien-S3',
            config: expect.objectContaining({
              endpoint: 'https://s3.example',
              bucket: 'media-bucket',
              accessKeyId: 'key-2',
              secretAccessKey: 'secret-2',
            }),
          }),
        },
      });
    });
  });

  it('deletes non-mainserver interfaces through the destructive confirm dialog', async () => {
    state.listInterfaces.mockResolvedValue({
      instanceId: 'de-musterhausen',
      entries: [mainserverEntry, s3Entry],
    });
    state.deleteInterface.mockResolvedValue({ deleted: true });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('2 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));

    await waitFor(() => {
      expect(state.deleteInterface).toHaveBeenCalledWith({
        data: { id: 's3-1', instanceId: 'de-musterhausen' },
      });
    });
  });

  it('shows the translated backend error when custom interface storage is unavailable', async () => {
    state.listInterfaces.mockResolvedValue({
      instanceId: 'de-musterhausen',
      entries: [mainserverEntry],
    });
    state.upsertInterface.mockRejectedValue(new Error('custom_interfaces_not_supported'));

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Neue Schnittstelle' }));
    fireEvent.click(screen.getByRole('radio', { name: /S3-kompatibler Object Storage/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0]!, { target: { value: 'Medien-S3' } });
    fireEvent.change(textboxes[1]!, { target: { value: 'https://s3.example' } });
    fireEvent.change(textboxes[3]!, { target: { value: 'media-bucket' } });
    fireEvent.change(textboxes[4]!, { target: { value: 'key-2' } });
    fireEvent.change(document.getElementById('s3-secret-key')!, { target: { value: 'secret-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(
        screen.getByText('Zusätzliche Schnittstellen werden erst unterstützt, sobald das Backend für diese Typen angebunden ist.')
      ).toBeTruthy();
    });
  });

  it('shows a save error when deletion reports no removed interface', async () => {
    state.listInterfaces.mockResolvedValue({
      instanceId: 'de-musterhausen',
      entries: [mainserverEntry, s3Entry],
    });
    state.deleteInterface.mockRejectedValue(new Error('interface_not_found'));

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('2 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));

    await waitFor(() => {
      expect(
        screen.getByText('Die gewählte Schnittstelle wurde nicht gefunden oder bereits entfernt.')
      ).toBeTruthy();
    });
  });
});
