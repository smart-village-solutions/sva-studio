## MODIFIED Requirements
### Requirement: Code-Route-Registry
Das System SHALL eine einzige öffentliche Routing-Schnittstelle in `@sva/routing` bereitstellen, die UI-, Auth- und Plugin-Routen zusammenführt und für pfadspezifische Handler-Mappings in Teilbereichen wie Auth-Routing als Single Source of Truth dient. App-lokale Parallel-Registrierungen DÜRFEN NICHT existieren.

#### Scenario: App bezieht alle produktiven Routen aus dem Routing-Package
- **WHEN** die Frontend-App ihren Router erzeugt
- **THEN** bezieht sie die Route-Factories ausschließlich aus `@sva/routing` oder `@sva/routing/server`
- **AND** die App liefert nur noch Root-Route, Context und Seiten-Bindings

#### Scenario: Produktive Seitenrouten sind code-based
- **WHEN** die Codebasis nach produktiven Seitenrouten durchsucht wird
- **THEN** liegen diese nicht in file-based Route-Dateien
- **AND** file-based Routing bleibt auf `__root.tsx` und notwendige TanStack-Integrationsartefakte reduziert

#### Scenario: Demo-Routen sind kein Teil des Produkt-Routings
- **WHEN** der produktive Route-Baum aufgebaut wird
- **THEN** enthält er keine `/demo`-Routen
- **AND** Demo- oder Sandbox-Routen benötigen einen separaten, expliziten Integrationseintrag
