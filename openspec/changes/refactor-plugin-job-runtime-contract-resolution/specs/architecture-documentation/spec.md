## MODIFIED Requirements

### Requirement: Nachvollziehbare Architekturentscheidungen

Das System SHALL Architekturentscheidungen mit Kontext, Begründung und Auswirkungen dokumentieren.

#### Scenario: Plugin-Plattform verändert Entwicklungs-, Deployment- und Runtime-Grenzen

- **WHEN** ein Change lokale Plugin-Entwicklung ohne Core-Anpassung, veröffentlichte Plugin-Distribution oder hostseitige Loader-Runtime einführt
- **THEN** referenziert der Change mindestens Bausteinsicht, Laufzeitsicht, Verteilungssicht, Querschnittskonzepte, Architekturentscheidungen, Qualitätsanforderungen und Risiken
- **AND** dokumentiert, ob ADR-034 fortgeschrieben oder durch eine neue ADR ergänzt wird

#### Scenario: Job-Runtime-Vertrag reduziert manuelle Host-Kopplung

- **GIVEN** die Plugin-Plattform nutzt deklarative Runtime-Anforderungen für Job-Entry-Points
- **WHEN** die Architekturdokumentation Risiken und technische Schulden beschreibt
- **THEN** benennt sie die generische host-owned Runtime-Auflösung über Contract-IDs als gültiges Zielbild für `jobs`
- **AND** grenzt verbleibende Folgearbeit für `server`- und `integrations`-Beiträge explizit ab
