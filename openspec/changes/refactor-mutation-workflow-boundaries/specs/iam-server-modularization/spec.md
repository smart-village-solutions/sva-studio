## ADDED Requirements

### Requirement: IAM-Mutationen verwenden einen neutralen Runtime-Workflow-Kern

Das System SHALL IAM-nahe Mutationen über einen neutralen Workflow-Kern in `@sva/server-runtime` orchestrieren, während `@sva/auth-runtime` und `@sva/iam-admin` nur domänenspezifische Adapter und Fachlogik liefern.

#### Scenario: Auth-Runtime oder IAM-Admin führt eine Mutation aus

- **WHEN** ein IAM-Mutationspfad Guards, Berechtigungsprüfung, CSRF, Idempotency, Request-Parsing und Fachausführung kombiniert
- **THEN** liegt die generische Orchestrierung im Runtime-Kern
- **AND** die IAM-Pakete halten nur noch fachliche Adapter und Handler-spezifische Fehlerabbildungen
