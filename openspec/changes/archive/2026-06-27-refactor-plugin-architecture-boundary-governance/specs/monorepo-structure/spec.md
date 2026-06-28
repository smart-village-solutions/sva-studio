## ADDED Requirements

### Requirement: Plugin-Packages konsumieren nur oeffentliche Host-Vertraege

The monorepo SHALL treat every `packages/plugin-*` package as a plugin boundary that may consume host capabilities only through documented public plugin contracts.

#### Scenario: Plugin folgt dem Standard Path

- **GIVEN** ein Plugin-Package nutzt nur `@sva/plugin-sdk` und optional `@sva/studio-ui-react`
- **WHEN** die Workspace-Dependencies und Source-Imports validiert werden
- **THEN** gilt das Package als Standard-Path-konform
- **AND** interne und externe Plugins werden nach derselben Regel bewertet

#### Scenario: Plugin importiert internes Host-Package

- **GIVEN** ein Plugin-Package deklariert oder importiert `@sva/core`, `@sva/auth-runtime`, `@sva/routing`, `@sva/studio-module-iam` oder ein gleichwertiges internes Host-Package
- **WHEN** der Architektur-Gate laeuft
- **THEN** faellt das Plugin als Boundary-Verstoss durch
- **AND** ein guenstiges Nx-Tag oder eine gemischte Package-Rolle zaehlt nicht als Freigabe

#### Scenario: Bestehender Altverstoss ist dokumentiert

- **GIVEN** ein bestehender Plugin-Verstoss ist mit Package, Regel, Subject, Owner, Begruendung und Folgechange in der Baseline dokumentiert
- **WHEN** der Architektur-Gate laeuft
- **THEN** bleibt genau dieser Altfall toleriert
- **AND** jede neue oder veraenderte Abweichung blockiert weiterhin den Lauf
