## ADDED Requirements
### Requirement: App-Layer bleibt auf Komposition begrenzt

Das System SHALL `apps/sva-studio-react` als Host-App fuer Shell-, Routing- und Framework-Komposition nutzen, aber wiederverwendbare Studio-UI, owning Domain-Helper und fachliche Serververtraege in passende Workspace-Packages verlagern.

#### Scenario: Wiederverwendbare Studio-UI wird im Package gehalten

- **WHEN** eine Tabelle, ein Listen-Template, ein Formular-Primitive oder ein vergleichbarer Studio-Baustein von mehreren Routen, Plugins oder Hosts genutzt werden kann
- **THEN** liegt seine kanonische Implementierung in einem Zielpackage wie `@sva/studio-ui-react`
- **AND** `apps/sva-studio-react` fuehrt dafuer keine zweite kanonische Implementierung

#### Scenario: Domain-Helper mit bestehender Ownership bleiben im owning Package

- **WHEN** ein fachlicher Helper wie ein Legal-Text-Sanitizer bereits ein owning Package besitzt
- **THEN** konsumiert die App diesen Helper aus dem owning Package
- **AND** die App pflegt keine parallele Fachimplementierung mit eigener Regelbasis

#### Scenario: App-seitige Kompatibilitaetsschichten bleiben nicht selbst Owner

- **WHEN** die App aus Migrationsgruenden noch einen lokalen Wrapper oder eine lokale Serverfunktion fuer einen bereits zentralisierten Fachvertrag behaelt
- **THEN** delegiert diese Schicht an die kanonische Ownership oder eine lokal gemeinsam genutzte Regelbasis
- **AND** sie fuehrt keine zweite, inline duplizierte Fachentscheidung als konkurrierende Owner-Logik weiter

#### Scenario: Host-spezifische Komposition bleibt in der App

- **WHEN** Routing-Bindings, Shell-Zusammensetzung oder host-spezifische Resource-Assemblierung konfiguriert werden
- **THEN** duerfen diese in `apps/sva-studio-react` verbleiben
- **AND** Beispiele wie `appRouteBindings`, `appAdminResources` oder gleichartige Shell-Assemblierung bleiben App-Komposition
- **AND** sie werden nicht nur aus Abstraktionsgruenden in ein generisches Package verschoben
