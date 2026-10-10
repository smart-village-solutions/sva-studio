## ADDED Requirements

### Requirement: Persönliche Mainserver-Konfiguration

Der lokale Studio-MCP SHALL für ausdrücklich konfigurierte persönliche Tenant-Kontexte GET und POST `api/v1/interfaces/mainserver` erlauben. Studio SHALL beide Methoden mit der bestehenden persönlichen Bearer- oder Browser-Authentifizierung sowie `integration.manage` schützen und die Tenant-Instanz aus dem hostgebundenen Actor bestimmen. POST SHALL ausschließlich die öffentlichen Konfigurationsfelder `graphqlBaseUrl`, `oauthTokenUrl` und `enabled` an den bestehenden Mainserver-Speicherpfad übergeben.

#### Scenario: Aktuelle Konfiguration lesen
- **WHEN** ein berechtigter Tenant-Actor die Mainserver-Konfiguration liest
- **THEN** erhält er ausschließlich deren öffentliche Konfigurationsfelder oder `null`, falls keine Konfiguration besteht
- **AND** die Anfrage führt keine Provider-Mutation aus

#### Scenario: Konfiguration speichern
- **WHEN** ein berechtigter Tenant-Actor gültige Mainserver-Einstellungen speichert
- **THEN** verwendet Studio die vorhandene URL-/SSRF-Validierung und Upsert-Persistenz
- **AND** Browser-Sitzungen benötigen den bestehenden CSRF-Nachweis
- **AND** der Save behauptet keine erfolgreich geprüfte Provider-Verbindung

#### Scenario: Unerlaubte Eingabe oder Identität
- **WHEN** die Anfrage fremde Instanz-IDs, Secrets, zusätzliche Felder, Query-Parameter oder andere Methoden enthält oder persönliche Authentifizierung beziehungsweise `integration.manage` fehlt
- **THEN** wird die Aktion ohne fachliche Mutation abgelehnt
- **AND** ein ungültiger Bearer fällt nicht auf eine vorhandene Browser-Sitzung zurück
