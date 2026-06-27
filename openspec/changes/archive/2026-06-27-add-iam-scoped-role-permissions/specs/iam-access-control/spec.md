## ADDED Requirements
### Requirement: Rollenrechte koennen Assignment-Scopes fuer Datensatzzugriffe tragen
Das System SHALL Rollen-Rechte-Zuordnungen fuer scope-faehige Datensatzrechte mit einem Assignment-Scope `all`, `own` oder `organization` speichern und auswerten.

#### Scenario: Legacy-Rollenpayload bleibt kompatibel
- **WHEN** ein Rollen-Update weiterhin nur `permissionIds` sendet
- **THEN** interpretiert das System jede dieser Zuordnungen als `accessScope = all`
- **AND** es schreibt konsistente `role_permissions` ohne Scope-Verlust

#### Scenario: Own-Scope verlangt IAM-Ownership
- **WHEN** eine Authorize-Anfrage fuer ein scope-faehiges Datensatzrecht auf eine Permission mit `accessScope = own` trifft
- **THEN** erlaubt das System den Zugriff nur bei passendem `ownerUserId` beziehungsweise technischer `owner_user_id`
- **AND** `createdByAccountId` oder `creator_account_id` allein begruendet keinen Own-Zugriff
- **AND** fehlende oder fremde Ownership-Bezuege fuehren fail-closed zu keinem Match

#### Scenario: Organization-Scope folgt IAM-Ownership und aktiver Session-Organisation
- **WHEN** eine Authorize-Anfrage fuer ein scope-faehiges Datensatzrecht auf eine Permission mit `accessScope = organization` trifft
- **THEN** erlaubt das System den Zugriff fuer Datensaetze mit passendem `ownerUserId` oder passender `ownerOrganizationId` zur aktiven Session-Organisation
- **AND** Datensaetze ausserhalb dieses Kontexts matchen nicht
- **AND** ohne aktive Session-Organisation faellt dieser Scope fuer inhaltsartige Datensaetze auf `own` zurueck
