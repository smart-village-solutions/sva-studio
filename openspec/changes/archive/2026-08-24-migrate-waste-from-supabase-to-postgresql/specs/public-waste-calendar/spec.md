## MODIFIED Requirements

### Requirement: Öffentliche App kapselt Datenquelle serverseitig

Das System SHALL die Konfiguration und den Zugriff auf die Waste-Datenquelle für die öffentliche App vollständig serverseitig kapseln.

#### Scenario: Browser erhält keine direkten Waste-Zugangsdaten

- **WHEN** die öffentliche App Kalenderdaten, Standortoptionen oder Exportinformationen lädt
- **THEN** spricht der Browser ausschließlich öffentliche Read-Verträge der App an
- **AND** die lokale JSON-Konfiguration wird nur serverseitig geladen
- **AND** Datenbank-Credentials oder vergleichbare Geheimnisse werden nicht an den Browser ausgeliefert

#### Scenario: Öffentliche App nutzt dieselbe PostgreSQL-Waste-Datenbank wie die Admin-Pflege

- **WHEN** die öffentliche App Daten für Standortauflösung oder Kalenderanzeige liest
- **THEN** greift sie auf dieselbe PostgreSQL-Waste-Datenbank zu wie das administrative Waste-Management
- **AND** die öffentliche Capability führt keine zweite fachliche Primärquelle für dieselben Kalenderdaten ein
- **AND** die öffentliche Runtime benötigt keine Supabase-API oder Supabase-Credentials
