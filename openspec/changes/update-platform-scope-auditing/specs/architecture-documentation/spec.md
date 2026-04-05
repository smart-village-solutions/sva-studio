## MODIFIED Requirements
### Requirement: Nachvollziehbare Architekturentscheidungen

Das System SHALL Architekturentscheidungen mit Kontext, Begründung und Auswirkungen dokumentieren.

#### Scenario: Scope-Grenzen mit Architekturwirkung

- **WHEN** ein Change die Grenze zwischen Root-Host-Control-Plane und Tenant-Instanzen verändert
- **THEN** dokumentiert die Architektur die Trennung `platform` vs. `instance` explizit in Bausteinsicht, Laufzeitsicht, Querschnittskonzepten und Risiken
- **AND** eine ADR beschreibt die Auswirkungen auf Audit, Logging und Error-Handling
