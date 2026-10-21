import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createEmptyInstanceInterfaceDraft,
  type InstanceInterfaceDraft,
  type InstanceInterfaceDeepL,
} from '../../lib/instance-interfaces';
import { InterfaceForm, TypePickerDialog } from './-interfaces-page.dialogs';

const createMainserverDraft = (): Extract<InstanceInterfaceDraft, { type: 'mainserver' }> => ({
  type: 'mainserver',
  name: 'Mainserver',
  enabled: true,
  config: {
    graphqlBaseUrl: 'https://mainserver.example/graphql',
    oauthTokenUrl: 'https://mainserver.example/oauth/token',
  },
});

const createMailTransportDraft = (): Extract<
  InstanceInterfaceDraft,
  { type: 'mailTransport' }
> => ({
  type: 'mailTransport',
  name: 'Mail-Transport',
  enabled: true,
  config: {
    transportId: 'mail-1',
    host: 'smtp.example.org',
    port: '587',
    securityMode: 'starttls',
    authMode: 'basic',
    username: 'mailer',
    password: 'secret',
    defaultFromEmail: 'noreply@example.org',
    defaultFromName: 'Abfallservice',
    defaultReplyToEmail: 'service@example.org',
    maxBatchSize: '50',
    rateLimitPerMinute: '120',
  },
});

const createMapGeocodingDraft = (): Extract<InstanceInterfaceDraft, { type: 'mapGeocoding' }> => ({
  type: 'mapGeocoding',
  name: 'Karte & Geocoding',
  enabled: true,
  config: {
    provider: 'geoapify',
    styleUrl: 'https://tiles.example/styles/osm-bright',
    autocompleteEnabled: true,
    geocodeEnabled: true,
    reverseGeocodeEnabled: true,
    suggestEndpoint: 'https://host.example/suggest',
    geocodeEndpoint: 'https://host.example/geocode',
    reverseGeocodeEndpoint: 'https://host.example/reverse',
    requestTimeoutMs: '3000',
    rateLimitPerMinute: '60',
    killSwitchEnabled: false,
    apiKey: '',
  },
});

describe('interfaces-page dialogs', () => {
  afterEach(() => {
    cleanup();
  });

  it('requires saved credentials before the explicit DeepL query and offers only verified supported targets', () => {
    const onChange = vi.fn(),
      onCheck = vi.fn();
    const draft = createEmptyInstanceInterfaceDraft('deepl');
    if (draft.type !== 'deepl') throw new Error('fixture');
    const props = {
      draft,
      saveStatus: 'idle' as const,
      saveErrorMessage: null,
      onChange,
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
      onCheckDeepL: onCheck,
    };
    const { rerender } = render(<InterfaceForm {...props} />);
    const check = screen.getByRole('button', {
      name: /Verbindung (erneut )?prüfen/,
    }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    expect(onCheck).not.toHaveBeenCalled();
    const entry: InstanceInterfaceDeepL = {
      id: 'deepl-a',
      instanceId: 'a',
      type: 'deepl',
      name: 'DeepL',
      enabled: true,
      status: 'connected',
      apiKeyConfigured: true,
      createdAt: 'now',
      updatedAt: 'now',
      config: {
        revision: 'r1',
        credentialRevision: 'k1',
        verifiedCredentialRevision: 'k1',
        plan: 'pro',
        englishVariant: 'en-GB',
        selectedLocales: [],
        availableLanguages: [
          { code: 'en-GB', name: 'English', tagHandling: true },
          { code: 'en-US', name: 'English (American)', tagHandling: true },
          { code: 'sv', name: 'Swedish', tagHandling: true },
          { code: 'da', name: 'Danish', tagHandling: true },
          { code: 'ar', name: 'Arabic', tagHandling: true },
        ],
      },
    };
    const saved = { ...draft, config: { ...draft.config, revision: 'r1' } };
    rerender(<InterfaceForm {...props} draft={saved} deepLEntry={entry} />);
    expect((screen.getByLabelText('Englisch') as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByLabelText('Variante für Englisch')).toBeNull();
    expect(
      screen.getAllByRole('checkbox').map((checkbox) => checkbox.closest('label')?.textContent)
    ).toEqual(['Arabisch', 'Dänisch', 'Englisch', 'Schwedisch']);
    expect(screen.getByRole('checkbox', { name: 'Arabisch' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Verbindung (erneut )?prüfen/ }));
    expect(onCheck).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Englisch'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ selectedLocales: ['en'] }) })
    );
    const english = { ...saved, config: { ...saved.config, selectedLocales: ['en' as const] } };
    rerender(<InterfaceForm {...props} draft={english} deepLEntry={entry} />);
    expect(
      (screen.getByRole('button', { name: 'Verbindung erneut prüfen' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
    expect(screen.queryByText(/Speichere die Konfiguration vor der Prüfung/)).toBeNull();
    const variant = screen.getByLabelText('Variante für Englisch');
    expect(variant.closest('div')?.contains(screen.getByLabelText('Englisch'))).toBe(true);
    fireEvent.change(variant, { target: { value: 'en-US' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ englishVariant: 'en-US', selectedLocales: ['en'] }),
      })
    );
    const portuguese = {
      ...entry,
      config: {
        ...entry.config,
        availableLanguages: [
          { code: 'pt-PT', name: 'Portuguese (Portugal)', tagHandling: true },
          { code: 'pt-BR', name: 'Portuguese (Brazil)', tagHandling: true },
          { code: 'zh-Hans', name: 'Chinese (Simplified)', tagHandling: true },
          { code: 'zh-Hant', name: 'Chinese (Traditional)', tagHandling: true },
        ],
      },
    };
    rerender(<InterfaceForm {...props} draft={saved} deepLEntry={portuguese} />);
    expect(screen.queryByLabelText('Variante für Portugiesisch')).toBeNull();
    fireEvent.click(screen.getByLabelText('Portugiesisch'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ selectedLocales: ['pt-PT'] }) })
    );
    rerender(
      <InterfaceForm
        {...props}
        draft={{ ...saved, config: { ...saved.config, selectedLocales: ['pt-PT'] } }}
        deepLEntry={portuguese}
      />
    );
    fireEvent.change(screen.getByLabelText('Variante für Portugiesisch'), {
      target: { value: 'pt-BR' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ selectedLocales: ['pt-BR'] }) })
    );
    rerender(
      <InterfaceForm
        {...props}
        draft={{ ...saved, config: { ...saved.config, selectedLocales: ['zh-Hans'] } }}
        deepLEntry={portuguese}
      />
    );
    fireEvent.change(screen.getByLabelText('Variante für Chinesisch'), {
      target: { value: 'zh-Hant' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ selectedLocales: ['zh-Hant'] }) })
    );
    const displayNames = vi
      .spyOn(Intl.DisplayNames.prototype, 'of')
      .mockImplementation((code) => code);
    try {
      const rare = {
        ...entry,
        config: {
          ...entry.config,
          availableLanguages: [{ code: 'ace', name: 'Acehnese', tagHandling: true }],
        },
      };
      rerender(<InterfaceForm {...props} draft={saved} deepLEntry={rare} />);
      expect(screen.getByLabelText('Acehnese')).toBeTruthy();
    } finally {
      displayNames.mockRestore();
    }
    const americanOnly = {
      ...entry,
      config: {
        ...entry.config,
        availableLanguages: [{ code: 'en-US', name: 'English (American)', tagHandling: true }],
      },
    };
    rerender(<InterfaceForm {...props} draft={saved} deepLEntry={americanOnly} />);
    fireEvent.click(screen.getByLabelText('Englisch'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ englishVariant: 'en-US', selectedLocales: ['en'] }),
      })
    );
    rerender(
      <InterfaceForm
        {...props}
        draft={{ ...saved, config: { ...saved.config, apiKey: 'rotated' } }}
        deepLEntry={entry}
      />
    );
    expect((screen.getByLabelText('Englisch') as HTMLInputElement).disabled).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: /Verbindung (erneut )?prüfen/,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect((screen.getByLabelText('API-Key') as HTMLInputElement).type).toBe('password');
  });
  it('returns null when the type picker is closed and forwards cancel or confirm actions when open', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onSelectType = vi.fn();
    const { rerender } = render(
      <TypePickerDialog
        open={false}
        availableTypes={['mainserver', 's3']}
        selectedType="mainserver"
        onSelectType={onSelectType}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(
      <TypePickerDialog
        open
        availableTypes={['mainserver', 's3']}
        selectedType="mainserver"
        onSelectType={onSelectType}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: /S3-kompatibler Object Storage/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(onSelectType).toHaveBeenCalledWith('s3');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const s3Radio = screen.getByRole('radio', { name: /S3-kompatibler Object Storage/i });
    s3Radio.focus();
    expect(document.activeElement).toBe(s3Radio);
    expect((s3Radio as HTMLInputElement).type).toBe('radio');
  });

  it('updates mainserver draft fields without rendering municipality id controls', () => {
    const onChange = vi.fn();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    render(
      <InterfaceForm
        draft={createMainserverDraft()}
        saveStatus="idle"
        saveErrorMessage={null}
        onChange={onChange}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('GraphQL Basis-URL'), {
      target: { value: 'https://next.example/graphql' },
    });
    fireEvent.change(screen.getByLabelText('OAuth Token-URL'), {
      target: { value: 'https://next.example/oauth/token' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Einstellungen speichern' }).closest('form')!
    );

    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'mainserver',
        config: expect.objectContaining({
          graphqlBaseUrl: 'https://next.example/graphql',
        }),
      })
    );
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'mainserver',
        config: expect.objectContaining({
          oauthTokenUrl: 'https://next.example/oauth/token',
        }),
      })
    );
    expect(screen.queryByLabelText('Municipality-ID')).toBeNull();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('updates mail transport fields through the shared patch helper without exposing transport type selection', () => {
    const onChange = vi.fn();

    render(
      <InterfaceForm
        draft={createMailTransportDraft()}
        saveStatus="idle"
        saveErrorMessage={null}
        onChange={onChange}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Transporttyp')).toBeNull();
    fireEvent.change(screen.getByLabelText('Port'), {
      target: { value: '2525' },
    });
    fireEvent.change(screen.getByLabelText('Sicherheitsmodus'), {
      target: { value: 'tls' },
    });
    fireEvent.change(document.getElementById('mail-auth-mode')!, {
      target: { value: 'none' },
    });

    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        config: expect.objectContaining({ port: '2525' }),
      })
    );
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        config: expect.objectContaining({ securityMode: 'tls' }),
      })
    );
    expect(onChange).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        config: expect.objectContaining({ authMode: 'none' }),
      })
    );
  });

  it('updates map geocoding fields and toggles runtime flags without exposing secret reads', () => {
    const onChange = vi.fn();

    render(
      <InterfaceForm
        draft={createMapGeocodingDraft()}
        hasStoredMapApiKey={true}
        saveStatus="idle"
        saveErrorMessage={null}
        onChange={onChange}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Empfohlene Einrichtung mit Geoapify')).toBeTruthy();
    expect(screen.getByText('Leer lassen, um den vorhandenen API-Key beizubehalten')).toBeTruthy();
    expect(screen.getByText('Ein API-Key ist bereits hinterlegt')).toBeTruthy();
    expect(screen.getByLabelText('API-Key').getAttribute('placeholder')).toBe(
      'Neuen API-Key eingeben'
    );
    expect(screen.getByLabelText('API-Key').getAttribute('aria-describedby')).toBe(
      'map-api-key-hint'
    );
    expect(
      screen
        .getByRole('link', { name: 'Geoapify-Projekt und API-Key anlegen' })
        .getAttribute('href')
    ).toBe('https://myprojects.geoapify.com/');

    fireEvent.change(screen.getByLabelText('Style-URL'), {
      target: { value: 'https://tiles.example/styles/editorial' },
    });
    fireEvent.change(screen.getByLabelText('API-Key'), {
      target: { value: 'geoapify-secret' },
    });
    fireEvent.click(screen.getByLabelText('Kill-Switch aktivieren'));

    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        config: expect.objectContaining({ styleUrl: 'https://tiles.example/styles/editorial' }),
      })
    );
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        config: expect.objectContaining({ apiKey: 'geoapify-secret' }),
      })
    );
    expect(onChange).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        config: expect.objectContaining({ killSwitchEnabled: true }),
      })
    );
  });

  it('preserves S3 endpoint and path-style changes after splitting the field groups', () => {
    const onChange = vi.fn();
    render(
      <InterfaceForm
        draft={createEmptyInstanceInterfaceDraft('s3')}
        saveStatus="idle"
        saveErrorMessage={null}
        onChange={onChange}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Endpoint-URL'), {
      target: { value: 'https://storage.example.org' },
    });
    fireEvent.click(document.getElementById('s3-path-style')!);

    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 's3',
        config: expect.objectContaining({ endpoint: 'https://storage.example.org' }),
      })
    );
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 's3',
        config: expect.objectContaining({ forcePathStyle: true }),
      })
    );
  });

  it('preserves Supabase and PostgreSQL database inputs', () => {
    const onChange = vi.fn();
    const props = {
      saveStatus: 'idle' as const,
      saveErrorMessage: null,
      onChange,
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
    };
    const { rerender } = render(
      <InterfaceForm draft={createEmptyInstanceInterfaceDraft('supabase')} {...props} />
    );

    fireEvent.change(document.getElementById('supabase-db')!, {
      target: { value: 'postgresql://supabase.example/db' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'supabase',
        config: expect.objectContaining({ databaseUrl: 'postgresql://supabase.example/db' }),
      })
    );

    rerender(<InterfaceForm draft={createEmptyInstanceInterfaceDraft('postgresql')} {...props} />);
    const databaseInput = document.getElementById('postgresql-db') as HTMLInputElement;
    expect(databaseInput.type).toBe('password');
    fireEvent.change(databaseInput, {
      target: { value: 'postgresql://database.example/db' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'postgresql',
        config: expect.objectContaining({ databaseUrl: 'postgresql://database.example/db' }),
      })
    );
  });

  it('keeps retry feedback available and blocks cancellation while saving', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const props = {
      draft: createMainserverDraft(),
      saveErrorMessage: 'Speichern fehlgeschlagen.',
      onChange: vi.fn(),
      onCancel,
      onSubmit,
    };
    const { rerender } = render(<InterfaceForm {...props} saveStatus="idle" />);

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(<InterfaceForm {...props} saveStatus="saving" />);
    expect(
      (screen.getByRole('button', { name: 'Erneut versuchen' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect((screen.getByRole('button', { name: 'Abbrechen' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(onCancel).not.toHaveBeenCalled();
  });
});
