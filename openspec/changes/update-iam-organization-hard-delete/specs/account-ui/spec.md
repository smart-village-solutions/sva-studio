## MODIFIED Requirements
### Requirement: Organisations-Verwaltungsseite

Das System MUST eine Organisations-Verwaltungsseite unter `/admin/organizations` bereitstellen, auf der berechtigte Administratoren Organisationen instanzgebunden pflegen und zulässige Blatt-Organisationen endgültig löschen können.

#### Scenario: Organisationsliste laden

- **WENN** ein Administrator `/admin/organizations` aufruft
- **DANN** wird eine Liste oder Tabelle der Organisationen der aktiven Instanz angezeigt
- **UND** die Oberfläche zeigt Name, Parent, Anzahl untergeordneter Organisationen und Anzahl zugeordneter Accounts
- **UND** ein Loading-State wird angezeigt, bis die Daten geladen sind

#### Scenario: Organisation suchen und filtern

- **WENN** ein Administrator einen Suchbegriff oder Filter setzt
- **DANN** werden die sichtbaren Organisationen nach Name, Key oder Status gefiltert
- **UND** die Trefferzahl wird über eine `aria-live="polite"`-Region aktualisiert

#### Scenario: Organisationen nach Typ filtern

- **WENN** ein Administrator einen Typfilter wie `municipality`, `district` oder einen äquivalenten unterstützten Organisationstyp setzt
- **DANN** werden nur Organisationen des gewählten Typs angezeigt
- **UND** die aktive Filterung bleibt in der Oberfläche eindeutig erkennbar

#### Scenario: Blatt-Organisation löschen

- **WENN** ein Administrator auf der Organisationsliste oder im Detail eine Organisation ohne Children löscht
- **DANN** ruft die UI den Delete-Endpunkt auf und entfernt die Organisation nach Erfolg aus dem sichtbaren Zustand
- **UND** erklärt der Bestätigungsdialog, dass Memberships und organisationsgebundene Credentials mit entfernt werden
