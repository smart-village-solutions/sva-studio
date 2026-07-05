## ADDED Requirements

### Requirement: Serverseitige Mutationsorchestrierung bleibt außerhalb des App-Layers

Das Monorepo MUST serverseitige Mutationsorchestrierung in Zielpackages halten und `apps/sva-studio-react` auf Host-Komposition, Routing-Bindings und framework-spezifische Entry-Points begrenzen.

#### Scenario: App importiert einen internen Mutationspfad

- **WHEN** die App einen internen `src`-Pfad oder einen package-spezifischen Mutations-Transporthandler direkt importiert
- **THEN** schlagen die statischen Boundary-Gates fehl
- **AND** die App muss stattdessen über öffentliche Package-Verträge oder Routing-Kontrakte integrieren

### Requirement: Fester Mutation-Workflow ist Boundary-übergreifend konsistent

Das Monorepo SHALL für serverseitige Mutationen einen festen Ablauf aus Prepare, CSRF, Authorize, Idempotency, Parse, Execute, Error-Mapping und Response-Mapping wiederverwenden.

#### Scenario: Ein Zielpackage baut eine neue Mutation

- **GIVEN** ein Zielpackage führt einen neuen serverseitigen Mutationshandler ein
- **WHEN** der Handler Request-Guards, Parsing, Fachausführung und Response-Mapping kombiniert
- **THEN** delegiert er diese Schrittfolge an einen gemeinsamen Workflow-Kern
- **AND** paketlokale Unterschiede bleiben auf kleine Adapter für Autorisierung, Input-Building, Execute und Fehlermapping begrenzt
