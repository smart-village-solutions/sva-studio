## ADDED Requirements
### Requirement: Rollenrechte koennen Assignment-Scopes fuer Datensatzzugriffe tragen
Das System SHALL Rollen-Rechte-Zuordnungen fuer scope-faehige Datensatzrechte mit einem Assignment-Scope `all`, `own` oder `organization` speichern und auswerten.

#### Scenario: Legacy-Rollenpayload bleibt kompatibel
- **WHEN** ein Rollen-Update weiterhin nur `permissionIds` sendet
- **THEN** interpretiert das System jede dieser Zuordnungen als `accessScope = all`
- **AND** es schreibt konsistente `role_permissions` ohne Scope-Verlust

#### Scenario: Own-Scope verlangt Erstellerbezug
- **WHEN** eine Authorize-Anfrage fuer ein scope-faehiges Datensatzrecht auf eine Permission mit `accessScope = own` trifft
- **THEN** erlaubt das System den Zugriff nur bei passendem `createdByAccountId`
- **AND** fehlende oder fremde Erstellerbezuege fuehren fail-closed zu keinem Match

#### Scenario: Organization-Scope folgt der aktiven Session-Organisation
- **WHEN** eine Authorize-Anfrage fuer ein scope-faehiges Datensatzrecht auf eine Permission mit `accessScope = organization` trifft
- **THEN** erlaubt das System den Zugriff fuer eigene Datensaetze oder Datensaetze der aktiven Session-Organisation
- **AND** Datensaetze ausserhalb dieses Kontexts matchen nicht
