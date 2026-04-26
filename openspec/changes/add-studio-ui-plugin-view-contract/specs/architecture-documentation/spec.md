## ADDED Requirements

### Requirement: Architektur dokumentiert Studio-UI-React-Boundary
Die Architekturdokumentation SHALL `@sva/studio-ui-react` als öffentliches React/UI-Zielpackage für Host und Plugin-Custom-Views dokumentieren.

#### Scenario: Package-Zielarchitektur enthält Studio UI
- **WHEN** ein Teammitglied `docs/architecture/package-zielarchitektur.md` liest
- **THEN** ist `@sva/studio-ui-react` als UI-only Zielpackage beschrieben
- **AND** die erlaubten Importkanten zu App und Plugins sind benannt
- **AND** die Abgrenzung zu `@sva/plugin-sdk`, `@sva/core` und App-internen Komponenten ist erklärt

#### Scenario: arc42 beschreibt Plugin-Custom-Views
- **WHEN** ein Teammitglied die arc42-Abschnitte zu Bausteinen und Querschnittskonzepten liest
- **THEN** ist nachvollziehbar, dass Plugin-Custom-Views gemeinsame Studio-UI über `@sva/studio-ui-react` nutzen
- **AND** host-rendered Admin-Ressourcen weiterhin der Standardfall bleiben

### Requirement: Entwicklungsdokumentation beschreibt Studio-UI-Nutzung
Die Entwicklungsdokumentation SHALL Regeln, Beispiele und Review-Kriterien für die Nutzung von `@sva/studio-ui-react` in Host und Plugins enthalten.

#### Scenario: Plugin-Entwickler sucht UI-Regeln
- **WHEN** ein Plugin-Entwickler den Plugin-Entwicklungsleitfaden liest
- **THEN** findet er erlaubte Imports aus `@sva/plugin-sdk` und `@sva/studio-ui-react`
- **AND** findet er Beispiele fuer Overview-, Detail-, Formular-, Action- und State-Kompositionen
- **AND** findet er die verbotenen App-Importe und Basis-Control-Duplikate

#### Scenario: Reviewer prüft UI-Konsistenz
- **WHEN** ein PR eine neue Host- oder Plugin-View enthält
- **THEN** kann der Reviewer anhand der Dokumentation prüfen, ob Studio-Templates, Controls, States, i18n und Accessibility-Konventionen eingehalten sind

