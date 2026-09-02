import { ContentOwnershipPanel, MainserverPrincipalControl } from '@sva/studio-ui-react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectNoA11yViolations } from '../test/a11y.js';

afterEach(cleanup);

describe('MainserverPrincipalControl accessibility', () => {
  it('has no detectable violations with selectable principal and read-only provider', async () => {
    const { container } = render(
      <MainserverPrincipalControl
        id="mainserver-principal"
        label="Erstellen als"
        description="Bestimmt die für diesen Schreibvorgang verwendeten Credentials."
        value="organization"
        options={[
          { value: 'organization', label: 'Stadt Musterhausen' },
          { value: 'user', label: 'Redakteurin' },
        ]}
        onChange={vi.fn()}
        dataProvider={{ id: 'provider-1', name: 'Mainserver-Redaktion' }}
        dataProviderLabel="Datenanbieter"
        dataProviderUnavailableLabel="Noch nicht verfügbar"
      />
    );

    await expect(expectNoA11yViolations(container)).resolves.toBeUndefined();
  });

  it('keeps the ownership display and transfer entry point accessible', async () => {
    render(
      <ContentOwnershipPanel
        currentOwner={{ displayName: 'Stadt Musterhausen', principalType: 'organization' }}
        supported
        canTransfer
        labels={{
          title: 'Inhaber',
          currentOwner: 'Aktueller Inhaber',
          ownerUnresolved: 'Keinem Account oder keiner Organisation eindeutig zugeordnet.',
          ownerResolutionFailed:
            'Die Account- oder Organisationszuordnung konnte nicht geprüft werden.',
          account: 'Persönlicher Account',
          organization: 'Organisation',
          verificationRequired: 'DataProvider-Zuordnung wird beim Transfer geprüft.',
          saveKeepsOwner: 'Normales Speichern ändert den Inhaber nicht.',
          transferUnavailable: 'Nicht verfügbar',
          transferForbidden: 'Nicht berechtigt',
          transferAction: 'Inhalt übertragen',
          dialogTitle: 'Inhalt übertragen',
          dialogDescription: 'Ziel auswählen und Auswirkung prüfen.',
          targetOwner: 'Neuer Inhaber',
          targetPlaceholder: 'Account oder Organisation auswählen',
          search: 'Suchen',
          loading: 'Lädt',
          loadError: 'Laden fehlgeschlagen',
          noTargets: 'Keine Ziele',
          refineSearch: 'Suche genauer',
          confirmation: 'Übertragung bestätigen',
          accessWarning: 'Zugriff kann verloren gehen.',
          authorEffect: 'Autorenangabe bleibt unverändert.',
          cancel: 'Abbrechen',
          confirm: 'Jetzt übertragen',
          transferring: 'Wird übertragen',
          success: 'Erfolgreich übertragen',
          transferError: 'Übertragung fehlgeschlagen',
        }}
        loadTargets={vi.fn().mockImplementation(({ type }: { type: string }) =>
          Promise.resolve({
            items: [
              type === 'organization'
                ? {
                    principal: { type: 'organization', id: 'organization-1' },
                    displayName: 'Stadt Musterhausen',
                  }
                : {
                    principal: { type: 'account', id: 'account-1' },
                    displayName: 'Redakteurin Muster',
                  },
            ],
            total: 2,
          })
        )}
        onTransfer={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Inhalt übertragen' }));
    const targetSelect = await screen.findByRole('combobox', { name: /^Neuer Inhaber/u });
    fireEvent.click(targetSelect);
    await screen.findByRole('option', { name: 'Stadt Musterhausen' });

    await expect(expectNoA11yViolations(screen.getByRole('dialog'))).resolves.toBeUndefined();
  });
});
