## ADDED Requirements
### Requirement: Tenant-Auth liefert strukturierte Diagnose-Events
Das System SHALL fuer tenant-spezifische Login- und Callback-Pfade strukturierte Diagnose-Events mit stabilen Feldern schreiben.

#### Scenario: Login-Aufloesung schreibt Tenant-Auth-Summary
- **WHEN** ein Request auf `/auth/login` oder einen anderen tenant-spezifischen Auth-Pfad ausgewertet wird
- **THEN** schreibt das System ein `tenant_auth_resolution_summary`
- **AND** das Ereignis enthaelt mindestens Host, Request-Origin, `instance_id`, Realm, Client-ID, Redirect-URI und die Secret-Quelle

#### Scenario: Callback schreibt OIDC-Ergebnis ohne Secret-Leak
- **WHEN** der OIDC-Callback erfolgreich ist oder fehlschlaegt
- **THEN** schreibt das System ein `tenant_auth_callback_result`
- **AND** das Ereignis enthaelt OIDC-Fehlercode, Beschreibung, Retry-Information und Tenant-Kontext
- **AND** enthaelt niemals Tokens, Authorization-Codes oder Secret-Klartexte

### Requirement: Keycloak-Status zeigt Secret-Alignment ohne Klartext
Das System SHALL im Keycloak-Status pro Instanz den Alignment-Zustand zwischen Registry, Runtime und Keycloak-Client-Secret ohne Offenlegung des Secretwertes bereitstellen.

#### Scenario: Status meldet Secret-Alignment
- **WHEN** ein Plattform-Admin den Keycloak-Status einer Instanz abfragt
- **THEN** enthaelt die Antwort maschinenlesbare Felder dazu, ob das tenant-spezifische Secret konfiguriert, lesbar und mit dem Keycloak-Client abgeglichen ist
- **AND** enthaelt niemals den Secret-Klartext
