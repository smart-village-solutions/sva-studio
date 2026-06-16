import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InstanceInterfaceDraft } from '../../lib/instance-interfaces';
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

const createMailTransportDraft = (): Extract<InstanceInterfaceDraft, { type: 'mailTransport' }> => ({
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

describe('interfaces-page dialogs', () => {
  afterEach(() => {
    cleanup();
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
  });

  it('updates mainserver draft fields and submits without reloading the page', () => {
    const onChange = vi.fn();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    render(
      <InterfaceForm
        draft={createMainserverDraft()}
        isSaving={false}
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
    fireEvent.submit(screen.getByRole('button', { name: 'Einstellungen speichern' }).closest('form')!);

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
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('updates mail transport fields through the shared patch helper without exposing transport type selection', () => {
    const onChange = vi.fn();

    render(
      <InterfaceForm
        draft={createMailTransportDraft()}
        isSaving={false}
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
});
