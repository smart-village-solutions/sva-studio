import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ContentOwnershipPanel,
  type ContentOwnershipPanelLabels,
} from './content-ownership-panel.js';

const labels: ContentOwnershipPanelLabels = {
  title: 'Inhaber',
  currentOwner: 'Aktueller Inhaber',
  ownerUnresolved: 'Keinem Account oder keiner Organisation eindeutig zugeordnet.',
  ownerResolutionFailed: 'Die Account- oder Organisationszuordnung konnte nicht geprüft werden.',
  account: 'Persönlicher Account',
  organization: 'Organisation',
  verificationRequired: 'DataProvider-Zuordnung wird beim Transfer geprüft.',
  saveKeepsOwner: 'Normales Speichern ändert den Inhaber nicht.',
  transferUnavailable: 'Nicht verfügbar',
  transferForbidden: 'Nicht berechtigt',
  transferAction: 'Inhalt übertragen',
  dialogTitle: 'Inhalt übertragen',
  dialogDescription: 'Ziel auswählen',
  targetOwner: 'Neuer Inhaber',
  targetPlaceholder: 'Account oder Organisation auswählen',
  search: 'Suchen',
  loading: 'Lädt',
  loadError: 'Laden fehlgeschlagen',
  noTargets: 'Keine Ziele',
  refineSearch: 'Suche genauer',
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
  it.each([
    ['unresolved', labels.ownerUnresolved],
    ['failed', labels.ownerResolutionFailed],
  ] as const)('shows the %s principal resolution below the DataProvider owner', (status, text) => {
    render(
      <ContentOwnershipPanel
        currentOwner={{
          displayName: 'Bestehender DataProvider',
          principalResolution: status,
        }}
        supported
        canTransfer
        labels={labels}
        loadTargets={vi.fn()}
        onTransfer={vi.fn()}
      />
    );

    expect(screen.getByText('Bestehender DataProvider')).toBeTruthy();
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Inhalt übertragen' })).toBeTruthy();
  });

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
      readiness: 'verification_required' as const,
    };
    const loadTargets = vi.fn().mockImplementation(({ type }: { type: string }) =>
      Promise.resolve({
        items: type === 'organization' ? [target] : [],
        total: type === 'organization' ? 1 : 0,
      })
    );
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
    fireEvent.click(screen.getByRole('combobox', { name: 'Neuer Inhaber' }));
    expect(await screen.findByText('Zielorganisation')).toBeTruthy();
    expect(screen.getAllByText('DataProvider-Zuordnung wird beim Transfer geprüft.')).toHaveLength(
      1
    );
    fireEvent.click(screen.getByRole('option', { name: /Zielorganisation/u }));
    expect(screen.getAllByText('DataProvider-Zuordnung wird beim Transfer geprüft.')).toHaveLength(
      1
    );

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
    let failFirstRequest = true;
    const loadTargets = vi.fn().mockImplementation(({ type }: { type: string }) => {
      if (failFirstRequest) {
        failFirstRequest = false;
        return Promise.reject(new Error('network'));
      }
      return Promise.resolve({
        items: type === 'account' ? [target] : [],
        total: type === 'account' ? 1 : 0,
      });
    });
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
    fireEvent.click(screen.getByRole('combobox', { name: 'Neuer Inhaber' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Suchen' }), {
      target: { value: 'Zielperson' },
    });
    expect(await screen.findByText('Zielperson')).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: /Zielperson/u }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Übertragung bestätigen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt übertragen' }));

    expect(await screen.findByText('Bindung ist nicht eindeutig')).toBeTruthy();
  });

  it('loads both target types and searches them through one field', async () => {
    const targets = {
      account: {
        principal: { type: 'account' as const, id: '55555555-5555-4555-8555-555555555555' },
        displayName: 'Stadt Account',
      },
      organization: {
        principal: {
          type: 'organization' as const,
          id: '66666666-6666-4666-8666-666666666666',
        },
        displayName: 'Stadt Organisation',
      },
    };
    const loadTargets = vi
      .fn()
      .mockImplementation(({ type }: { type: 'account' | 'organization' }) =>
        Promise.resolve({ items: [targets[type]], total: 30 })
      );
    render(
      <ContentOwnershipPanel
        currentOwner={currentOwner}
        supported
        canTransfer
        labels={labels}
        loadTargets={loadTargets}
        onTransfer={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Inhalt übertragen' }));
    await waitFor(() => expect(loadTargets).toHaveBeenCalledTimes(2));
    expect(loadTargets).toHaveBeenCalledWith(expect.objectContaining({ type: 'account', page: 1 }));
    expect(loadTargets).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'organization', page: 1 })
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Neuer Inhaber' }));
    expect(screen.getByRole('group', { name: 'Persönlicher Account' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Organisation' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Stadt Account' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Stadt Organisation' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Suchen' }), {
      target: { value: '  Stadt  ' },
    });
    await waitFor(() => expect(loadTargets).toHaveBeenCalledTimes(4));
    expect(loadTargets).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'account', page: 1, search: 'Stadt' })
    );
    expect(loadTargets).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'organization', page: 1, search: 'Stadt' })
    );
  });

  it('ignores stale target responses after the search changes', async () => {
    const staleTarget = {
      principal: { type: 'account' as const, id: '33333333-3333-4333-8333-333333333333' },
      displayName: 'Veraltete Person',
    };
    const currentTarget = {
      principal: { type: 'account' as const, id: '44444444-4444-4444-8444-444444444444' },
      displayName: 'Aktuelles Suchergebnis',
    };
    let resolveStale: ((value: { items: [typeof staleTarget]; total: number }) => void) | undefined;
    const loadTargets = vi
      .fn()
      .mockImplementation(
        ({ search, type }: { search?: string; type: 'account' | 'organization' }) => {
          if (!search && type === 'account') {
            return new Promise<{ items: [typeof staleTarget]; total: number }>((resolve) => {
              resolveStale = resolve;
            });
          }
          if (!search) return Promise.resolve({ items: [], total: 0 });
          return Promise.resolve({
            items: type === 'account' ? [currentTarget] : [],
            total: type === 'account' ? 1 : 0,
          });
        }
      );

    render(
      <ContentOwnershipPanel
        currentOwner={currentOwner}
        supported
        canTransfer
        labels={labels}
        loadTargets={loadTargets}
        onTransfer={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Inhalt übertragen' }));
    await waitFor(() => expect(loadTargets).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('combobox', { name: 'Neuer Inhaber' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Suchen' }), {
      target: { value: 'Aktuell' },
    });
    expect(await screen.findByText('Aktuelles Suchergebnis')).toBeTruthy();

    await act(async () => {
      resolveStale?.({ items: [staleTarget], total: 1 });
    });

    expect(screen.queryByText('Veraltete Person')).toBeNull();
    expect(screen.getByText('Aktuelles Suchergebnis')).toBeTruthy();
  });
});
