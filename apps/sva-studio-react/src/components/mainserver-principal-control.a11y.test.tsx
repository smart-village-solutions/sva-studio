import { ContentOwnershipPanel, MainserverPrincipalControl } from '@sva/studio-ui-react';
import { cleanup, render } from '@testing-library/react';
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
    const { container } = render(
      <ContentOwnershipPanel
        currentOwner={{ displayName: 'Stadt Musterhausen', principalType: 'organization' }}
        supported
        canTransfer
        labels={{
          title: 'Inhaber',
          currentOwner: 'Aktueller Inhaber',
          account: 'Persönlicher Account',
          organization: 'Organisation',
          saveKeepsOwner: 'Normales Speichern ändert den Inhaber nicht.',
          transferUnavailable: 'Nicht verfügbar',
          transferForbidden: 'Nicht berechtigt',
          transferAction: 'Inhalt übertragen',
          dialogTitle: 'Inhalt übertragen',
          dialogDescription: 'Ziel auswählen und Auswirkung prüfen.',
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
          authorEffect: 'Autorenangabe bleibt unverändert.',
          cancel: 'Abbrechen',
          confirm: 'Jetzt übertragen',
          transferring: 'Wird übertragen',
          success: 'Erfolgreich übertragen',
          transferError: 'Übertragung fehlgeschlagen',
        }}
        loadTargets={vi.fn().mockResolvedValue({ items: [], total: 0 })}
        onTransfer={vi.fn()}
      />
    );

    await expect(expectNoA11yViolations(container)).resolves.toBeUndefined();
  });
});
