import type { IamInstanceDetail } from '@sva/core';
import { DEFAULT_ACCOUNT_INVITATION_TEMPLATE } from '@sva/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setActiveLocale } from '../../../i18n';
import { AccountInvitationTemplateCard } from './-account-invitation-template-card';

afterEach(() => {
  setActiveLocale('de');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

const instance = {
  instanceId: 'demo',
  displayName: 'Stadt Demo',
  primaryHostname: 'demo.example.org',
  effectiveAccountInvitationTemplate: { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 0 },
  accountInvitationTemplateSource: 'sva_default',
  serverAccountInvitationTemplateRevision: 0,
} as IamInstanceDetail;

describe('AccountInvitationTemplateCard', () => {
  it('shows a safe tenant preview and submits the controlled template', async () => {
    const onSave = vi.fn(async () => true);
    render(<AccountInvitationTemplateCard instance={instance} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));

    expect(screen.getByText(/https:\/\/demo\.example\.org\//)).toBeTruthy();
    expect(screen.getByText(/Stadt Demo/)).toBeTruthy();
    expect(screen.queryByText(/eyJ/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect((await screen.findByText('Im Studio gespeichert. Den Synchronisierungsstand zeigt der Keycloak-Abgleich.')).textContent).toContain(
      'gespeichert'
    );
  });

  it('resets through the same revision-bound save path', async () => {
    const onSave = vi.fn(async () => true);
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    render(<AccountInvitationTemplateCard instance={instance} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Servervorlage verwenden' }));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Instanzvorlage entfernen'));
  });
  it('clears the previous save message on reopen while preserving a new draft', async () => {
    const onSave = vi.fn(async () => true);
    render(<AccountInvitationTemplateCard instance={instance} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    const saved = 'Im Studio gespeichert. Den Synchronisierungsstand zeigt der Keycloak-Abgleich.';
    await screen.findByText(saved);
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Neuer Entwurf' } });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    expect(screen.queryByText(saved)).toBeNull();
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Neuer Entwurf');
    expect(onSave).toHaveBeenCalledTimes(1);
  });
  it('prevents duplicate saves while validation and the request are pending', async () => {
    let finish!: (saved: boolean) => void;
    const onSave = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        })
    );
    render(<AccountInvitationTemplateCard instance={instance} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    const save = screen.getByRole('button', { name: 'Vorlage speichern' });
    fireEvent.click(save);
    fireEvent.click(save);
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    finish(true);
    await screen.findByText('Im Studio gespeichert. Den Synchronisierungsstand zeigt der Keycloak-Abgleich.');
  });
});
