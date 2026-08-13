## MODIFIED Requirements

### Requirement: Delegation an den SVA-Mainserver im aktiven Organisationskontext

Das System SHALL Zugriffe auf den externen SVA-Mainserver serverseitig delegieren. Organisationsgebundene Credentials werden aus der Studio-Datenbank für `instanceId + activeOrganizationId` gelesen; Benutzer-Credentials bleiben in Keycloak-User-Attributen des aktuellen Benutzers. Credentials und Access-Tokens werden weder im Browser noch in Sessions exponiert.

Studio-initiierte Content-Mutationen SHALL die Credential-Quelle ausschließlich aus dem expliziten `actingPrincipalType` auflösen und SHALL nicht still auf die andere Quelle zurückfallen. `contentAuthorPolicy` SHALL beim Create die zulässigen Eigentümer-Principals bestimmen. Bei bestehenden eigenen oder organisatorischen Inhalten SHALL die konfliktfreie DataProvider-Bindung zusammen mit der serverautoritativen Ressourcen-Capability den Principal bestimmen; die Autorenrichtlinie SHALL keinen freien Principal-Wechsel erlauben.

Reine Reads und nicht kausal an eine Mutation gebundene Reconciliation SHALL unabhängig von `contentAuthorPolicy` die durch den IAM-Scope erlaubte Menge bereitstellen: `own` umfasst den persönlichen Principal, `organization` umfasst den persönlichen Principal und die aktive Organisation. Persönliche Inhalte anderer Mitglieder SHALL nur mit einer ausdrücklich vergebenen `all`- oder Moderationsberechtigung sichtbar sein. Studio SHALL durch reale Contract-Tests bestimmen, welche Mainserver-Credential-Sichten für diese Menge erforderlich sind. Mehrere erforderliche Read-Sichten SHALL in Cache, Sync-State und Projection isoliert und anschließend dedupliziert vereinigt werden. Kausal an eine Mutation gebundene Reads und Reconciliation SHALL denselben `MutationPrincipalContext` wiederverwenden.

#### Scenario: `org_only` erzwingt beim Create Organisations-Credentials

- **WHEN** ein Content-Create im aktiven Organisationskontext läuft
- **AND** `contentAuthorPolicy = org_only` gilt
- **THEN** ist ausschließlich `actingPrincipalType = organization` zulässig
- **AND** verwendet das System nur die Credentials dieser aktiven Organisation
- **AND** es fällt nicht auf Benutzer-Credentials zurück

#### Scenario: `org_or_personal` verlangt explizite Auswahl beim Create

- **WHEN** ein Content-Create im aktiven Organisationskontext läuft
- **AND** `contentAuthorPolicy = org_or_personal` gilt
- **THEN** muss die Mutation `actingPrincipalType = organization` oder `user` explizit binden
- **AND** verwendet der Server ausschließlich die gewählte Quelle
- **AND** fehlende Credentials lösen keinen Fallback auf die andere Quelle aus

#### Scenario: Organisationsscope liefert eigene und organisatorische Inhalte

- **WHEN** ein reiner Mainserver-Read nicht an eine Mutation gebunden ist
- **AND** der Benutzer besitzt eine passende Read-Permission mit `accessScope = organization`
- **THEN** liefert das System unabhängig von `contentAuthorPolicy` die Inhalte des persönlichen Principals und der aktiven Organisation
- **AND** führt ein in mehreren erforderlichen Credential-Sichten enthaltenes Mainserver-Objekt nur einmal
- **AND** schließt es persönliche Inhalte anderer Organisationsmitglieder aus

#### Scenario: Organisationsadmin erhält keinen impliziten Zugriff auf persönliche Inhalte

- **GIVEN** ein Organisationsadmin besitzt keine ausdrückliche `all`- oder Moderationsberechtigung für den Content-Typ
- **WHEN** er Inhalte im aktiven Organisationskontext liest
- **THEN** sieht er seine eigenen und die Inhalte der aktiven Organisation
- **AND** sieht er keine persönlichen Inhalte anderer Mitglieder allein aufgrund seiner Administrationsrolle

#### Scenario: Eine Read-Sicht ist vorübergehend nicht verfügbar

- **GIVEN** die reale Mainserver-Contract-Matrix verlangt mehrere Credential-Sichten für die autorisierte Ergebnismenge
- **AND** für genau einen erforderlichen Principal-Scope liegt ein aktueller oder letzter erfolgreicher Snapshot vor
- **WHEN** der andere Principal-Scope nicht synchronisiert werden kann
- **THEN** liefert das System die verfügbare autorisierte Sicht
- **AND** kennzeichnet das Ergebnis und dessen Gesamtzahl ausdrücklich als unvollständig
- **AND** zeigt die Oberfläche unabhängig von vorhandenen alten Snapshots einen sichtbaren Hinweis zur unvollständigen Liste
- **AND** blockiert es Mutationen über den nicht verfügbaren Principal
- **AND** fällt es für diese Mutation nicht still auf den anderen Principal zurück

#### Scenario: Persönlicher Bestandsinhalt bleibt unter `org_only` persönlich bearbeitbar

- **GIVEN** ein Inhalt gehört dauerhaft dem persönlichen Principal des aktuellen Benutzers
- **AND** die aktive Organisation hat `contentAuthorPolicy = org_only`
- **WHEN** der Benutzer den bestehenden Inhalt mit passender Action und `own`-Scope bearbeitet
- **THEN** verwendet Studio `actingPrincipalType = user`
- **AND** überträgt oder sperrt die Autorenrichtlinie den Bestandsinhalt nicht

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
- **AND** ruft kein Schritt den allgemeinen Resolver erneut auf
