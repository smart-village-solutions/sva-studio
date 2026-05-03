## ADDED Requirements
### Requirement: Arc42 dokumentiert Waste-Management als Plugin- und Server-Capability

Das System SHALL die Waste-Management-Integration in den betroffenen Arc42-Abschnitten nachvollziehbar dokumentieren.

#### Scenario: Plugin-, Runtime- und Sicherheitsgrenzen werden fortgeschrieben

- **WHEN** der Change `add-waste-management-plugin` umgesetzt wird
- **THEN** dokumentieren die betroffenen Arc42-Abschnitte die Plugin-Boundary, die freie Route `/plugins/waste-management`, die hostgefuehrte Studio-Fassade und die Datenzugriffsgrenzen gegen Supabase/Postgres
- **AND** die Doku beschreibt, dass `Newcms` nur fachliche Referenz bleibt
- **AND** die Doku beschreibt die Portierungsgrenze zwischen zulaessiger UX-Anlehnung und unzulaessiger Architekturuebernahme explizit

### Requirement: Arc42 dokumentiert Instanzisierung und Hochrisiko-Operationen

Das System SHALL die instanzbezogene Waste-Datenhaltung sowie Seed- und Reset-Schutzmechanismen architektonisch verankern.

#### Scenario: Architektur beschreibt Instanzisolierung und Reset-Risiko

- **WHEN** ein Teammitglied die Arc42-Dokumentation fuer Waste-Management nachschlaegt
- **THEN** sind Instanzscoping, Migrationsrichtung des `waste_*`-Schemas, Auditverhalten und Hochrisiko-Schutz fuer Reset nachvollziehbar beschrieben
- **AND** die Dokumentation benennt die betroffenen Qualitäts- und Risikoaspekte explizit
