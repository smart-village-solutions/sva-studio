## ADDED Requirements

### Requirement: Aktives installationsweites Mandantenverzeichnis

Studio SHALL unter `GET /internal/plugins/ssf/v1/admin-login-tenants` alle
aktiven Einträge seiner lokalen Mandanten-Registry mit `contractVersion: "1.0"`,
einer SHA-256-`directoryRevision` und ausschließlich den Mandantenfeldern
`{id, displayName, realm}` liefern. Die Sortierung SHALL nach deutschem
`displayName`, bei Gleichstand nach `id` erfolgen. Die Revision SHALL aus der
kanonisch sortierten `tenants`-Darstellung gebildet werden, bei unverändertem
öffentlichen Inhalt stabil bleiben und sich bei dessen Änderung ändern. Studio SHALL keine
zusätzlichen Plugin-, Readiness- oder Freigabelistenprüfungen ausführen.

#### Scenario: Aktive und inaktive Einträge

- **GIVEN** lokale Registry-Einträge mit unterschiedlichen Statuswerten
- **WHEN** SSF das Verzeichnis autorisiert abruft
- **THEN** enthält die Antwort nur aktive Einträge mit ID, Bezeichnung und Auth-Realm
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
