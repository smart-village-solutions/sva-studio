## MODIFIED Requirements

### Requirement: Per-User-Delegation an den SVA-Mainserver

Das System SHALL Zugriffe auf den externen SVA-Mainserver serverseitig und per Benutzer delegieren. API-Key und Secret werden aus Keycloak-User-Attributen des aktuellen Benutzers gelesen und nicht im Browser, in Sessions oder in der Studio-Datenbank gespiegelt.

#### Scenario: Serverseitiger Mainserver-Aufruf mit aktuellen Keycloak-Attributen

- **WHEN** eine serverseitige Studio-Funktion einen Mainserver-Aufruf für einen authentifizierten Benutzer ausführt
- **THEN** liest das System bevorzugt `mainserverUserApplicationId` und `mainserverUserApplicationSecret` aus den Keycloak-User-Attributen dieses Benutzers
- **AND** fordert serverseitig ein OAuth2-Access-Token an
- **AND** sendet den GraphQL-Aufruf mit `Authorization: Bearer <token>` an den SVA-Mainserver
- **AND** exponiert weder Credentials noch Access-Token an Browser-Code

#### Scenario: Legacy-Attribute bleiben übergangsweise lauffähig

- **WHEN** die aktuellen Attribute `mainserverUserApplicationId` und `mainserverUserApplicationSecret` für einen Benutzer nicht gesetzt sind
- **AND** die Legacy-Attribute `sva_mainserver_api_key` und `sva_mainserver_api_secret` vorhanden sind
- **THEN** verwendet das System die Legacy-Attribute als Fallback
- **AND** der Mainserver-Aufruf bleibt für Bestandsbenutzer funktionsfähig

#### Scenario: Fehlende Mainserver-Credentials im Benutzerprofil

- **WHEN** für den aktuellen Benutzer weder die aktuellen noch die Legacy-Attribute vollständig in Keycloak vorhanden sind
- **THEN** wird kein Upstream-Aufruf gestartet
- **AND** das System liefert einen stabilen Fehlerzustand `missing_credentials`
