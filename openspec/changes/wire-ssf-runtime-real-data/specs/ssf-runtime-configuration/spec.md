## MODIFIED Requirements

### Requirement: Produktive Host-Integration bleibt fail-closed und revisionsgebunden

Der produktive Host SHALL Datenbankbereitschaft und `authorizationRevision`
aus der konfigurierten SSF-Plugin-Datenbank lesen. Handler und Host-Gates MUST
denselben prozesslokalen Pool verwenden. Die Tenant-Zeitzone MUST aus dem
bereits hostvalidierten generischen Instanzprofil stammen.

#### Scenario: Echte Runtime-Daten sind bereit

- **GIVEN** Instanz und Plugin sind aktiv, der SSF-Tenant ist vorbereitet und seine Projektion ist bestätigt
- **WHEN** der authentisierte SSF-Service die Runtime-Konfiguration abruft
- **THEN** bindet der Host Anzeigename und Zeitzone aus der Instanz-Registry
- **AND** bindet er Datenbankbereitschaft und Autorisierungsrevision aus der SSF-Plugin-Datenbank
- **AND** führt erst danach den Plugin-Handler aus

#### Scenario: SSF-Datenbank fehlt oder ist nicht erreichbar

- **GIVEN** die SSF-Datenbank ist nicht konfiguriert oder nicht erreichbar
- **WHEN** der SSF-Service die Runtime-Konfiguration abruft
- **THEN** liefert der Host keine Runtime-Konfiguration
- **AND** bleibt der Fehler retrybar und fail-closed
