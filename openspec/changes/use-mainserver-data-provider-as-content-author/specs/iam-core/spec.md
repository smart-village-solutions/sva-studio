## MODIFIED Requirements

### Requirement: Delegation an den SVA-Mainserver im aktiven Organisationskontext

Das System SHALL Zugriffe auf den externen SVA-Mainserver serverseitig delegieren. Organisationsgebundene Credentials werden aus der Studio-Datenbank für `instanceId + activeOrganizationId` gelesen; Benutzer-Credentials bleiben in Keycloak-User-Attributen des aktuellen Benutzers. Credentials und Access-Tokens werden weder im Browser noch in Sessions exponiert.

Studio-initiierte Content-Mutationen SHALL die Credential-Quelle ausschließlich aus dem expliziten `actingPrincipalType` auflösen und SHALL nicht still auf die andere Quelle zurückfallen. Reine Reads und nicht kausal an eine Mutation gebundene Reconciliation dürfen den bestehenden `contentAuthorPolicy`-gesteuerten Organization-first-Resolver verwenden, müssen die tatsächlich verwendete Quelle jedoch zurückgeben und in Cache und Projection isolieren. Kausal an eine Mutation gebundene Reads und Reconciliation SHALL denselben `MutationPrincipalContext` wiederverwenden.

#### Scenario: `org_only` erzwingt Organisations-Credentials

- **WHEN** eine Content-Mutation im aktiven Organisationskontext läuft
- **AND** `contentAuthorPolicy = org_only` gilt
- **THEN** ist ausschließlich `actingPrincipalType = organization` zulässig
- **AND** verwendet das System nur die Credentials dieser aktiven Organisation
- **AND** es fällt nicht auf Benutzer-Credentials zurück

#### Scenario: `org_or_personal` verlangt explizite Auswahl bei Mutation

- **WHEN** eine Content-Mutation im aktiven Organisationskontext läuft
- **AND** `contentAuthorPolicy = org_or_personal` gilt
- **THEN** muss die Mutation `actingPrincipalType = organization` oder `user` explizit binden
- **AND** verwendet der Server ausschließlich die gewählte Quelle
- **AND** fehlende Credentials lösen keinen Fallback auf die andere Quelle aus

#### Scenario: Reiner Read nutzt weiterhin Organization-first-Auflösung

- **WHEN** ein reiner Mainserver-Read nicht an eine Mutation gebunden ist
- **AND** `contentAuthorPolicy = org_or_personal` gilt
- **THEN** darf der Resolver vollständige Organisations-Credentials bevorzugen
- **AND** nur bei unvollständiger Organisationskonfiguration auf Benutzer-Credentials zurückfallen
- **AND** gibt er die tatsächlich verwendete Credential-Quelle zurück

#### Scenario: Ohne `activeOrganizationId` erfolgt kein organisationsbezogener Lookup

- **WHEN** eine serverseitige Studio-Funktion ohne `activeOrganizationId` ausgeführt wird
- **THEN** führt das System keinen organisationsbezogenen Credential-Lookup aus
- **AND** sucht nicht über andere Memberships, Hierarchien oder frühere Kontexte

#### Scenario: Explizite Organisationsmutation bleibt ohne aktive Organisation fail-closed

- **WHEN** eine Mutation `actingPrincipalType = organization` verwendet
- **AND** keine aktive Organisation validiert ist
- **THEN** wird kein Upstream-Aufruf gestartet
- **AND** der Resolver liefert `organization_mainserver_credentials_missing`

#### Scenario: Benutzerpfad bleibt für Bestandsbenutzer kompatibel

- **WHEN** der Resolver ausdrücklich im Benutzerpfad arbeitet
- **AND** die aktuellen Benutzerattribute nicht vollständig gesetzt sind
- **THEN** verwendet das System übergangsweise vollständige Legacy-Benutzerattribute
- **AND** wechselt nicht zu Organisations-Credentials

#### Scenario: Fehlende explizite Organisations-Credentials liefern deterministischen Fehler

- **WHEN** eine Mutation `actingPrincipalType = organization` verwendet
- **AND** die aktive Organisation keine vollständigen Credentials hat
- **THEN** wird kein Upstream-Aufruf gestartet
- **AND** der Resolver liefert `organization_mainserver_credentials_missing`

#### Scenario: Fehlende explizite Benutzer-Credentials liefern deterministischen Fehler

- **WHEN** eine Mutation `actingPrincipalType = user` verwendet
- **AND** weder aktuelle noch Legacy-Benutzer-Credentials vollständig vorhanden sind
- **THEN** wird kein Upstream-Aufruf gestartet
- **AND** der Resolver liefert `missing_credentials`

#### Scenario: Kausale Reads verwenden den gebundenen Kontext

- **GIVEN** eine Mutation besitzt bereits einen `MutationPrincipalContext`
- **WHEN** Pre-Read, Read-Merge-Write, Post-Read oder Reconciliation erfolgt
- **THEN** verwendet jeder Schritt denselben Credential-Fingerprint
- **AND** ruft kein Schritt den allgemeinen Organization-first-Resolver erneut auf
