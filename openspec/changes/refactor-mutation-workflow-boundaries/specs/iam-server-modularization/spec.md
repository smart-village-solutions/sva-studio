## ADDED Requirements

### Requirement: IAM-Mutationen verwenden einen neutralen Runtime-Workflow-Kern

Das System SHALL IAM-nahe Mutationen ueber einen neutralen Workflow-Kern in `@sva/server-runtime` orchestrieren, waehrend `@sva/auth-runtime` und `@sva/iam-admin` nur domaeinenspezifische Adapter und Fachlogik liefern.

#### Scenario: Auth-Runtime oder IAM-Admin fuehrt eine Mutation aus

- **WHEN** ein IAM-Mutationspfad Guards, Berechtigungspruefung, CSRF, Idempotency, Request-Parsing und Fachausfuehrung kombiniert
- **THEN** liegt die generische Orchestrierung im Runtime-Kern
- **AND** die IAM-Pakete halten nur noch fachliche Adapter und Handler-spezifische Fehlerabbildungen
