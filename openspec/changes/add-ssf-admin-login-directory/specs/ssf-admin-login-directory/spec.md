## ADDED Requirements

### Requirement: Aktives installationsweites Mandantenverzeichnis

Studio SHALL unter `GET /internal/plugins/ssf/v1/admin-login-tenants` alle
aktiven und vollständig loginbereiten Einträge seiner lokalen Mandanten-Registry mit `contractVersion: "1.0"`,
einer SHA-256-`directoryRevision` und ausschließlich den Mandantenfeldern
`{id, displayName, realm}` liefern. Die Sortierung SHALL nach deutschem
`displayName`, bei Gleichstand nach `id` erfolgen. Die Revision SHALL aus der
kanonisch sortierten `tenants`-Darstellung gebildet werden, bei unverändertem
öffentlichen Inhalt stabil bleiben und sich bei dessen Änderung ändern. Studio SHALL vor Veröffentlichung den gemeinsamen SSF-Readiness-Pfad prüfen.
Dieser MUST den bereiten Lifecycle, den Tenant-Grunddatensatz, beide Client-Verträge
und die bestätigte IAM-Revision verlangen. Die Erstprovisionierung MUST diese
Voraussetzungen vor `ready` herstellen; Directory-Reads bleiben schreibfrei.

#### Scenario: Aktive und inaktive Einträge

- **GIVEN** lokale Registry-Einträge mit unterschiedlichen Statuswerten
- **WHEN** SSF das Verzeichnis autorisiert abruft
- **THEN** enthält die Antwort nur aktive, loginbereite Einträge mit ID, Bezeichnung und Auth-Realm
- **AND** enthält sie keine Credentials oder anderen Registry-Felder

#### Scenario: Leeres Verzeichnis

- **WHEN** kein aktiver Registry-Eintrag existiert
- **THEN** liefert Studio `200` mit Vertragsversion, Revision und leerem `tenants`-Array

### Requirement: Interner Service-Zugriff ohne Tenant-Bindung

Studio SHALL die bestehende SSF-Service-Identität und separat die Rolle
`ssf.admin-login-directory.read` vor jedem Registry-Lesen prüfen. Der Endpoint
SHALL ohne Tenant-Header funktionieren und den bestehenden internen
Ingress-Schutz beibehalten. Fehler SHALL `401`, `403` oder `503` unterscheiden.

#### Scenario: Fehlende Directory-Rolle

- **GIVEN** ein gültiges Service-Token ausschließlich mit Runtime-Leserolle
- **WHEN** der Directory-Endpoint aufgerufen wird
- **THEN** antwortet Studio mit `403`, ohne die Registry zu lesen

#### Scenario: Ungültige Identität oder ausgefallene Registry

- **WHEN** ein Service-Token fehlt oder ungültig ist
- **THEN** antwortet Studio mit `401`
- **WHEN** die Registry nach erfolgreicher Autorisierung ausfällt
- **THEN** antwortet Studio mit `503` und keiner leeren Erfolgsliste

#### Scenario: Öffentlicher Ingress

- **WHEN** der Request Forwarding-Header des öffentlichen Ingress trägt
- **THEN** antwortet Studio vor dem Directory-Dispatch mit `404`

### Requirement: SSF besitzt den Login-Flow

SSF SHALL den Login-Einstieg anhand des gelieferten Realms selbst erzeugen und
die OIDC-Werte pro Anmeldung erstellen. Studio SHALL hierfür keinen neuen
Login-Handler oder gespeicherte Keycloak-Authorization-URLs bereitstellen.

#### Scenario: Realm für die SSF-Login-Auswahl

- **WHEN** SSF einen Directory-Eintrag erhält
- **THEN** kann es Bezeichnung und Realm für seinen eigenen Login-Einstieg nutzen
- **AND** bleiben Service-Credentials ausschließlich serverseitig

#### Scenario: Teilprovisionierung oder Client-Drift

- **GIVEN** ein aktiver Mandant besitzt keine vollständige SSF-Login-Baseline
- **WHEN** der Directory-Endpoint seine Readiness prüft
- **THEN** bleibt dieser Mandant unveröffentlicht
- **AND** führt der GET-Endpoint keine Provisionierungs-Writes aus
- **WHEN** der Lifecycle alle Voraussetzungen idempotent hergestellt und verifiziert hat
- **THEN** darf der Mandant nach erfolgreichem Lifecycle-Abschluss veröffentlicht werden
