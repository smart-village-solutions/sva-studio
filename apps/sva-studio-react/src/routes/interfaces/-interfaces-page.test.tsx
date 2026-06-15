import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const supabaseEntry = {
  id: 'supabase-1',
  instanceId: 'de-musterhausen',
  type: 'supabase',
  name: 'Abfallkalender',
  enabled: true,
  status: 'unknown',
  statusMessage: 'Pending health check',
  lastCheckedAt: '2026-03-15T20:02:00.000Z',
  createdAt: '2026-03-15T20:02:00.000Z',
  updatedAt: '2026-03-15T20:02:00.000Z',
  config: {
    projectUrl: 'https://tenant.supabase.co',
    schemaName: 'public',
    databaseUrl: '',
    serviceRoleKey: '',
  },
} as const;

const mailTransportEntry = {
  id: 'mail-transport-1',
  instanceId: 'de-musterhausen',
  type: 'mailTransport',
  name: 'Zentraler Mailversand',
  enabled: true,
  status: 'unknown',
  statusMessage: 'Pending health check',
  lastCheckedAt: '2026-03-15T20:03:00.000Z',
  createdAt: '2026-03-15T20:03:00.000Z',
  updatedAt: '2026-03-15T20:03:00.000Z',
  config: {
    transportId: 'mail-transport-1',
    transportType: 'smtp',
    host: 'smtp.example.org',
    port: '587',
    securityMode: 'starttls',
    authMode: 'basic',
    username: 'mailer',
    defaultFromEmail: 'noreply@example.org',
    defaultFromName: 'Abfallservice',
    defaultReplyToEmail: 'service@example.org',
    maxBatchSize: '50',
    rateLimitPerMinute: '120',
    providerMode: '',
    endpoint: '',
  },
} as const;

const createListResponse = (
  entries: readonly unknown[],
  availableTypes: readonly ('mainserver' | 's3' | 'supabase' | 'mailTransport')[] = [
    'mainserver',
    's3',
    'supabase',
    'mailTransport',
  ]
) => ({
  instanceId: 'de-musterhausen',
  availableTypes,
  entries,
});

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
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry, s3Entry]));
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
    fireEvent.click(screen.getByRole('switch', { name: 'Aktiv' }));
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

  it('shows a blocking load error instead of the empty state when the interfaces payload is malformed', async () => {
    state.listInterfaces.mockResolvedValueOnce(undefined).mockResolvedValueOnce(createListResponse([mainserverEntry]));

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('Schnittstellen konnten nicht geladen werden.')).toBeTruthy();
    });

    expect(screen.queryByText('0 Schnittstelle(n)')).toBeNull();
    expect(screen.queryByText('Für diese Instanz sind noch keine Schnittstellen hinterlegt.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));

    await waitFor(() => {
      expect(screen.getByText('1 Schnittstelle(n)')).toBeTruthy();
    });
  });

  it('creates an s3 interface through the picker dialog and upsert endpoint', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry]));
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

  it('creates a mainserver interface through the picker dialog and dedicated endpoint', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([]));
    state.saveMainserver.mockResolvedValue({
      instanceId: 'de-musterhausen',
      providerKey: 'sva_mainserver',
      graphqlBaseUrl: 'https://mainserver.example/graphql',
      oauthTokenUrl: 'https://mainserver.example/oauth/token',
      enabled: true,
    });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Für diese Instanz sind noch keine Schnittstellen hinterlegt.')
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Neue Schnittstelle' }));
    fireEvent.click(screen.getByRole('radio', { name: /SVA Mainserver/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    fireEvent.change(screen.getByLabelText('GraphQL Basis-URL'), {
      target: { value: 'https://mainserver.example/graphql' },
    });
    fireEvent.change(screen.getByLabelText('OAuth Token-URL'), {
      target: { value: 'https://mainserver.example/oauth/token' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(state.saveMainserver).toHaveBeenCalledWith({
        data: {
          enabled: true,
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
        },
      });
    });

    expect(state.upsertInterface).not.toHaveBeenCalled();
  });

  it('creates a supabase interface through the picker dialog and upsert endpoint', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry]));
    state.upsertInterface.mockResolvedValue({
      ...supabaseEntry,
      config: { ...supabaseEntry.config, serviceRoleKey: '' },
    });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Neue Schnittstelle' }));
    fireEvent.click(screen.getByRole('radio', { name: /Supabase/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0]!, { target: { value: 'Abfallkalender' } });
    fireEvent.change(textboxes[1]!, { target: { value: 'https://tenant.supabase.co' } });
    fireEvent.change(textboxes[2]!, { target: { value: 'waste' } });
    fireEvent.change(textboxes[3]!, { target: { value: 'postgres://db.example.local' } });
    fireEvent.change(document.getElementById('supabase-key')!, { target: { value: 'service-role-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(state.upsertInterface).toHaveBeenCalledWith({
        data: {
          instanceId: 'de-musterhausen',
          draft: expect.objectContaining({
            type: 'supabase',
            name: 'Abfallkalender',
            config: expect.objectContaining({
              projectUrl: 'https://tenant.supabase.co',
              schemaName: 'waste',
              databaseUrl: 'postgres://db.example.local',
              serviceRoleKey: 'service-role-1',
            }),
          }),
        },
      });
    });
  });

  it('creates a mail transport interface through the picker dialog and upsert endpoint', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry]));
    state.upsertInterface.mockResolvedValue({
      ...mailTransportEntry,
      config: { ...mailTransportEntry.config },
    });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Neue Schnittstelle' }));
    fireEvent.click(screen.getByRole('radio', { name: /Mail-Transport/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    fireEvent.change(screen.getByLabelText('Anzeigename'), {
      target: { value: 'Zentraler Mailversand' },
    });
    fireEvent.change(screen.getByLabelText('Transport-ID'), {
      target: { value: 'mail-transport-1' },
    });
    fireEvent.change(screen.getByLabelText('SMTP-Host'), {
      target: { value: 'smtp.example.org' },
    });
    fireEvent.change(screen.getByLabelText('Port'), {
      target: { value: '587' },
    });
    fireEvent.change(screen.getByLabelText('Benutzername'), {
      target: { value: 'mailer' },
    });
    fireEvent.change(screen.getByLabelText('Passwort'), {
      target: { value: 'smtp-password' },
    });
    fireEvent.change(screen.getByLabelText('Standard-Absenderadresse'), {
      target: { value: 'noreply@example.org' },
    });
    fireEvent.change(screen.getByLabelText('Standard-Absendername'), {
      target: { value: 'Abfallservice' },
    });
    fireEvent.change(screen.getByLabelText('Standard-Reply-To'), {
      target: { value: 'service@example.org' },
    });
    fireEvent.change(screen.getByLabelText('Maximale Batch-Größe'), {
      target: { value: '50' },
    });
    fireEvent.change(screen.getByLabelText('Rate-Limit pro Minute'), {
      target: { value: '120' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(state.upsertInterface).toHaveBeenCalledWith({
        data: {
          instanceId: 'de-musterhausen',
          draft: expect.objectContaining({
            type: 'mailTransport',
            name: 'Zentraler Mailversand',
            config: expect.objectContaining({
              transportId: 'mail-transport-1',
              transportType: 'smtp',
              host: 'smtp.example.org',
              port: '587',
              securityMode: 'starttls',
              authMode: 'basic',
              username: 'mailer',
              password: 'smtp-password',
              defaultFromEmail: 'noreply@example.org',
              defaultFromName: 'Abfallservice',
              defaultReplyToEmail: 'service@example.org',
              maxBatchSize: '50',
              rateLimitPerMinute: '120',
            }),
          }),
        },
      });
    });
  });

  it('does not offer provider API mail transports in the dialog before runtime support exists', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry]));

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Neue Schnittstelle' }));
    fireEvent.click(screen.getByRole('radio', { name: /Mail-Transport/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    const transportTypeSelect = screen.getByLabelText('Transporttyp');
    expect(within(transportTypeSelect).getByRole('option', { name: /SMTP/i })).toBeTruthy();
    expect(within(transportTypeSelect).queryByRole('option', { name: /Provider-API/i })).toBeNull();
  });

  it('shows the persisted healthcheck message below the interface status', async () => {
    state.listInterfaces.mockResolvedValue(
      createListResponse([
        {
          ...supabaseEntry,
          status: 'error',
          statusMessage: 'Die Datenbankverbindung wurde abgelehnt. Benutzername oder Passwort der DB-URL sind falsch.',
        },
      ])
    );

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(
        screen.getAllByText(
          'Die Datenbankverbindung wurde abgelehnt. Benutzername oder Passwort der DB-URL sind falsch.'
        ).length
      ).toBeGreaterThan(0);
    });
  });

  it('does not offer supabase in the picker when the waste-management module is unavailable', async () => {
    state.listInterfaces.mockResolvedValue(
      createListResponse([mainserverEntry], ['mainserver', 's3', 'mailTransport'])
    );

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Neue Schnittstelle' }));

    expect(screen.queryByRole('radio', { name: /Supabase/i })).toBeNull();
    const mainserverRadio = screen.getByRole('radio', { name: /SVA Mainserver/i });
    expect(mainserverRadio).toBeTruthy();
    expect(mainserverRadio.closest('label')?.getAttribute('aria-labelledby')).toBe(
      'interface-type-mainserver-title'
    );
    expect(screen.getByRole('radio', { name: /S3-kompatibler Object Storage/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Mail-Transport/i })).toBeTruthy();
  });

  it('keeps the whole picker card clickable through the description text', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry]));

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Neue Schnittstelle' }));
    fireEvent.click(document.getElementById('interface-type-supabase-description')!);

    expect((screen.getByRole('radio', { name: /Supabase/i }) as HTMLInputElement).checked).toBe(true);
  });

  it('deletes non-mainserver interfaces through the destructive confirm dialog', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry, s3Entry]));
    state.deleteInterface.mockResolvedValue({ deleted: true });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('2 Schnittstelle(n)')).toBeTruthy();
    });

    const interfacesTable = screen.getByRole('table', { name: 'Schnittstellen der Instanz' });
    const s3Row = within(interfacesTable).getByRole('cell', { name: 'Uploads' }).closest('tr');
    expect(s3Row).toBeTruthy();
    fireEvent.click(within(s3Row!).getByRole('button', { name: 'Löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));

    await waitFor(() => {
      expect(state.deleteInterface).toHaveBeenCalledWith({
        data: { id: 's3-1', instanceId: 'de-musterhausen' },
      });
    });
  });

  it('deletes the mainserver interface through the destructive confirm dialog', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry]));
    state.deleteInterface.mockResolvedValue({ deleted: true });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('1 Schnittstelle(n)')).toBeTruthy();
    });

    const interfacesTable = screen.getByRole('table', { name: 'Schnittstellen der Instanz' });
    const mainserverRow = within(interfacesTable).getAllByRole('cell', { name: 'SVA Mainserver' })[0]?.closest('tr');
    expect(mainserverRow).toBeTruthy();
    fireEvent.click(within(mainserverRow!).getByRole('button', { name: 'Löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));

    await waitFor(() => {
      expect(state.deleteInterface).toHaveBeenCalledWith({
        data: { id: 'mainserver:de-musterhausen', instanceId: 'de-musterhausen' },
      });
    });
  });

  it('shows the translated backend error when the backend rejects an invalid interface mutation', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry]));
    state.upsertInterface.mockRejectedValue(new Error('interface_type_change_not_supported'));

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
        screen.getByText('Der Typ einer vorhandenen Schnittstelle kann nicht nachträglich geändert werden.')
      ).toBeTruthy();
    });
  });

  it('shows translated load errors before any mutation interaction', async () => {
    state.listInterfaces.mockRejectedValue(new Error('interface_instance_mismatch'));

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Die gewählte Schnittstelle gehört nicht zur aktuellen Instanz und konnte nicht geändert werden.'
        )
      ).toBeTruthy();
    });

    expect(state.saveMainserver).not.toHaveBeenCalled();
    expect(state.upsertInterface).not.toHaveBeenCalled();
  });

  it('updates an existing s3 interface through the generic endpoint with its existing id', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry, s3Entry]));
    state.upsertInterface.mockResolvedValue({
      ...s3Entry,
      name: 'Uploads aktualisiert',
      config: { ...s3Entry.config, secretAccessKey: '' },
    });

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('2 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[1]!);
    fireEvent.change(screen.getByDisplayValue('Uploads'), {
      target: { value: 'Uploads aktualisiert' },
    });
    fireEvent.change(document.getElementById('s3-secret-key')!, { target: { value: 'rotated-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(state.upsertInterface).toHaveBeenCalledWith({
        data: {
          instanceId: 'de-musterhausen',
          existingId: 's3-1',
          draft: expect.objectContaining({
            type: 's3',
            name: 'Uploads aktualisiert',
            config: expect.objectContaining({
              secretAccessKey: 'rotated-secret',
            }),
          }),
        },
      });
    });
  });

  it('shows a specific save error when an existing s3 secret can no longer be decrypted', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry, s3Entry]));
    state.upsertInterface.mockRejectedValue(new Error('secret_unreadable'));

    render(<InterfacesPage />);

    await waitFor(() => {
      expect(screen.getByText('2 Schnittstelle(n)')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen speichern' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Das gespeicherte Secret der Schnittstelle konnte serverseitig nicht mehr gelesen werden. Bitte den Secret-Wert neu eintragen und erneut speichern.'
        )
      ).toBeTruthy();
    });
  });

  it('shows a save error when deletion reports no removed interface', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry, s3Entry]));
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

  it('shows the translated not-found error when deletion resolves without removing a record', async () => {
    state.listInterfaces.mockResolvedValue(createListResponse([mainserverEntry, s3Entry]));
    state.deleteInterface.mockResolvedValue({ deleted: false });

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
