## MODIFIED Requirements

### Requirement: Effektive Credential-Auflösung und Delegation an den SVA-Mainserver

Das System SHALL Zugriffe auf den externen SVA-Mainserver serverseitig delegieren und die effektiven Mainserver-Credentials anhand der `contentAuthorPolicy` der aktiven Organisation auflösen. Organisationsgebundene Credentials werden aus der Studio-Datenbank für `instanceId + activeOrganizationId` gelesen; Benutzer-Credentials bleiben in Keycloak-User-Attributen des aktuellen Benutzers. Credentials und Access-Tokens werden weder im Browser noch in Sessions exponiert.

#### Scenario: `org_only` erzwingt Organisations-Credentials

- **WHEN** eine serverseitige Studio-Funktion einen Mainserver-Aufruf im aktiven Organisationskontext ausführt
- **AND** für die aktive Organisation gilt `contentAuthorPolicy = org_only`
- **THEN** verwendet das System ausschließlich die Mainserver-Credentials dieser aktiven Organisation
- **AND** es fällt nicht auf Benutzer-Credentials zurück

#### Scenario: `org_or_personal` nutzt zuerst die aktive Organisation

- **WHEN** eine serverseitige Studio-Funktion einen Mainserver-Aufruf im aktiven Organisationskontext ausführt
- **AND** für die aktive Organisation gilt `contentAuthorPolicy = org_or_personal`
- **THEN** prüft das System zuerst vollständige Organisations-Credentials der aktiven Organisation
- **AND** verwendet nur bei unvollständiger Organisationskonfiguration die Keycloak-basierten Benutzer-Credentials des aktuellen Benutzers

#### Scenario: Ohne `activeOrganizationId` erfolgt kein organisationsbezogener Lookup

- **WHEN** eine serverseitige Studio-Funktion einen Mainserver-Aufruf ohne `activeOrganizationId` in der Session ausführt
- **THEN** führt das System keinen organisationsbezogenen Credential-Lookup aus
- **AND** es sucht nicht implizit über andere Organisationsmitgliedschaften, Hierarchien oder frühere Kontexte nach Organisations-Credentials

#### Scenario: `org_only` bleibt ohne `activeOrganizationId` fail-closed

- **WHEN** eine serverseitige Studio-Funktion einen Mainserver-Aufruf ohne `activeOrganizationId` in der Session ausführt
- **AND** der organisationsgebundene Pfad `org_only` für die Credential-Auflösung maßgeblich ist
- **THEN** wird kein Upstream-Aufruf gestartet
- **AND** der gemeinsame Resolver-Vertrag liefert den stabilen Fehlercode `organization_mainserver_credentials_missing`

#### Scenario: Benutzerpfad bleibt für Bestandsbenutzer kompatibel

- **WHEN** der Resolver im Benutzerpfad arbeitet
- **AND** die aktuellen Attribute `mainserverUserApplicationId` und `mainserverUserApplicationSecret` für den aktuellen Benutzer nicht vollständig gesetzt sind
- **THEN** verwendet das System übergangsweise die Legacy-Attribute `sva_mainserver_api_key` und `sva_mainserver_api_secret`, falls diese vollständig vorhanden sind
- **AND** der Benutzerpfad bleibt für Bestandsbenutzer funktionsfähig

#### Scenario: Fehlende effektive Credentials liefern deterministische Fehler

- **WHEN** `contentAuthorPolicy = org_only`
- **AND** die aktive Organisation keine vollständigen Mainserver-Credentials hat
- **THEN** wird kein Upstream-Aufruf gestartet
- **AND** der gemeinsame Resolver-Vertrag liefert den stabilen Fehlercode `organization_mainserver_credentials_missing`

#### Scenario: Weder Organisation noch Benutzer liefern vollständige Credentials

- **WHEN** `contentAuthorPolicy = org_or_personal`
- **AND** die aktive Organisation keine vollständigen Mainserver-Credentials hat
- **AND** für den aktuellen Benutzer weder aktuelle noch Legacy-Credentials vollständig vorhanden sind
- **THEN** wird kein Upstream-Aufruf gestartet
- **AND** der gemeinsame Resolver-Vertrag liefert den stabilen Fehlercode `missing_credentials`
