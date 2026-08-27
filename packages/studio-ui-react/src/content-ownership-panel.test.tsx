import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ContentOwnershipPanel,
  type ContentOwnershipPanelLabels,
} from './content-ownership-panel.js';

const labels: ContentOwnershipPanelLabels = {
  title: 'Inhaber',
  currentOwner: 'Aktueller Inhaber',
  account: 'Persönlicher Account',
  organization: 'Organisation',
  saveKeepsOwner: 'Normales Speichern ändert den Inhaber nicht.',
  transferUnavailable: 'Nicht verfügbar',
  transferForbidden: 'Nicht berechtigt',
  transferAction: 'Inhalt übertragen',
  dialogTitle: 'Inhalt übertragen',
  dialogDescription: 'Ziel auswählen',
  targetType: 'Zieltyp',
  search: 'Suchen',
  searchAction: 'Suche starten',
  loading: 'Lädt',
  loadError: 'Laden fehlgeschlagen',
  noTargets: 'Keine Ziele',
  previousPage: 'Zurück',
  nextPage: 'Weiter',
  confirmation: 'Übertragung bestätigen',
  accessWarning: 'Zugriff kann verloren gehen.',
  authorEffect: 'Autor bleibt unverändert.',
  cancel: 'Abbrechen',
  confirm: 'Jetzt übertragen',
  transferring: 'Wird übertragen',
  success: 'Erfolgreich übertragen',
  transferError: 'Übertragung fehlgeschlagen',
};

const currentOwner = {
  principal: { type: 'account' as const, id: '11111111-1111-4111-8111-111111111111' },
  displayName: 'Aktuelle Person',
};

afterEach(cleanup);

describe('ContentOwnershipPanel', () => {
  it('shows the owner but no active transfer action for unsupported content', () => {
    render(
      <ContentOwnershipPanel
        currentOwner={currentOwner}
        supported={false}
        canTransfer={true}
        labels={labels}
        loadTargets={vi.fn()}
        onTransfer={vi.fn()}
      />
    );

    expect(screen.getByText('Aktuelle Person')).toBeTruthy();
    expect(screen.getByText('Nicht verfügbar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Inhalt übertragen' })).toBeNull();
  });

  it('requires a selected target and explicit confirmation before transferring', async () => {
    const target = {
      principal: { type: 'organization' as const, id: '22222222-2222-4222-8222-222222222222' },
      displayName: 'Zielorganisation',
    };
    const loadTargets = vi.fn().mockResolvedValue({ items: [target], total: 1 });
    const onTransfer = vi.fn().mockResolvedValue(undefined);
    render(
      <ContentOwnershipPanel
        currentOwner={currentOwner}
        supported
        canTransfer
        labels={labels}
        loadTargets={loadTargets}
        onTransfer={onTransfer}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Inhalt übertragen' }));
    expect(await screen.findByText('Zielorganisation')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Zielorganisation/u }));

    const submit = screen.getByRole('button', { name: 'Jetzt übertragen' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Übertragung bestätigen' }));
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(onTransfer).toHaveBeenCalledWith(target));
    expect((await screen.findByRole('status')).textContent).toContain('Erfolgreich übertragen');
  });

  it('shows target loading failures and maps stable transfer errors', async () => {
    const target = {
      principal: { type: 'account' as const, id: '33333333-3333-4333-8333-333333333333' },
      displayName: 'Zielperson',
    };
    const loadTargets = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ items: [target], total: 1 });
    const onTransfer = vi.fn().mockRejectedValue(new Error('binding conflict'));
    render(
      <ContentOwnershipPanel
        currentOwner={currentOwner}
        supported
        canTransfer
        labels={labels}
        loadTargets={loadTargets}
        onTransfer={onTransfer}
        resolveTransferError={() => 'Bindung ist nicht eindeutig'}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Inhalt übertragen' }));
    expect(await screen.findByText('Laden fehlgeschlagen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Suche starten' }));
    expect(await screen.findByText('Zielperson')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Zielperson/u }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Übertragung bestätigen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt übertragen' }));

    expect(await screen.findByText('Bindung ist nicht eindeutig')).toBeTruthy();
  });
});
