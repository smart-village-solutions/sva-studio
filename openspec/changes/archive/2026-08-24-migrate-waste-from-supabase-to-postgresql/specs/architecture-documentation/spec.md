## ADDED Requirements

### Requirement: Arc42 dokumentiert die PostgreSQL-Zielarchitektur für Waste

Das System SHALL die Entkopplung der Waste-Capabilities von Supabase und die getrennte PostgreSQL-Fachdatenbank in den betroffenen Arc42-Abschnitten dokumentieren.

#### Scenario: Architektur beschreibt Datenbank- und Runtime-Grenzen

- **WHEN** der Change `migrate-waste-from-supabase-to-postgresql` umgesetzt wird
- **THEN** dokumentieren Kontext-, Baustein-, Verteilungs- und Querschnittssicht die getrennte Waste-Datenbank, ihre Runtime-Rollen und die gemeinsame Nutzung durch Studio-Waste und Public-Waste
- **AND** bleibt die Studio-Governance-Datenbank als getrennte führende Persistenz erkennbar
- **AND** wird Supabase nicht mehr als Waste-Laufzeitabhängigkeit dargestellt

#### Scenario: Architektur dokumentiert Migration und Betriebsrisiken

- **WHEN** ein Teammitglied den einmaligen Waste-Cutover nachvollzieht
- **THEN** beschreibt die Architekturdokumentation den vollständigen Betriebsstopp im angekündigten Sonntagsfenster, Dump/Restore, Pflichtverifikation, das Rollback-Gate vor neuen Zielschreibzugriffen, die 14-tägige schreibgeschützte Aufbewahrung und die Backup-Verantwortung
- **AND** führt die Risikosicht Datenverlust, Berechtigungsdrift, unvollständige Schemaobjekte und Konfigurationsdrift mit Gegenmaßnahmen auf
