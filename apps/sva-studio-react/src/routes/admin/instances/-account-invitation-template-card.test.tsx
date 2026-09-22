import type { IamInstanceDetail } from '@sva/core';
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
  accountInvitationProjection: { status: 'default' },
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
    expect((await screen.findByRole('status')).textContent).toContain('gespeichert');
  });

  it('resets through the same revision-bound save path', async () => {
    const onSave = vi.fn(async () => true);
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    render(<AccountInvitationTemplateCard instance={instance} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Auf SVA-Standard zurücksetzen' }));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('wirklich entfernen'));
  });
});
