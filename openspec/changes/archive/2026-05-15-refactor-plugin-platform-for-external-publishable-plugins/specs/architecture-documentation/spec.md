## MODIFIED Requirements

### Requirement: Package-Zielarchitektur als verbindlicher Architekturvertrag

Die Architekturdokumentation MUST die Package-Zielarchitektur als verbindlichen Architekturvertrag führen. OpenSpec-Changes mit Package-, IAM-, Daten-, Plugin-, Routing- oder Runtime-Wirkung MUST erklären, welche Zielpackages betroffen sind und ob der Change mit den Zielgrenzen vereinbar ist.

#### Scenario: Plugin-Plattform-v2 wird als Zielarchitektur dokumentiert

- **WHEN** ein Change die Plugin-Plattform von statischer Workspace-Registrierung auf ein Modell mit Manifest, Katalog und Loader erweitert
- **THEN** referenziert er `docs/architecture/package-zielarchitektur.md`
- **AND** benennt die Zielrollen für `@sva/plugin-sdk`, Manifest-, Loader- und Runtime-Bausteine
- **AND** dokumentiert, welche bisherigen Verantwortungen aus App oder SDK in diese Zielbausteine wandern

### Requirement: Nachvollziehbare Architekturentscheidungen

Das System SHALL Architekturentscheidungen mit Kontext, Begründung und Auswirkungen dokumentieren.

#### Scenario: Plugin-Plattform verändert Entwicklungs-, Deployment- und Runtime-Grenzen

- **WHEN** ein Change lokale Plugin-Entwicklung ohne Core-Anpassung, veröffentlichte Plugin-Distribution oder hostseitige Loader-Runtime einführt
- **THEN** referenziert der Change mindestens Bausteinsicht, Laufzeitsicht, Verteilungssicht, Querschnittskonzepte, Architekturentscheidungen, Qualitätsanforderungen und Risiken
- **AND** dokumentiert, ob ADR-034 fortgeschrieben oder durch eine neue ADR ergänzt wird

## ADDED Requirements

### Requirement: Entwicklungsdokumentation beschreibt Studio-Plugin-Nutzung

Die Entwicklungsdokumentation SHALL Regeln, Beispiele und Review-Kriterien für die Nutzung der öffentlichen Plugin-Plattform enthalten.

#### Scenario: Externer Plugin-Entwickler sucht lokalen und publizierten Workflow

- **WHEN** ein Entwickler den Plugin-Guide liest
- **THEN** findet er Regeln für Authoring, lokalen Dev-Load, Manifest, Publish, Install und Aktivierung
- **AND** findet er die erlaubten öffentlichen Imports und Host-Entry-Points
- **AND** findet er die verbotenen Direktimporte in App-, Runtime-, IAM- oder Secret-Interna
