## ADDED Requirements

### Requirement: Mainserver-Integration bleibt Adapter über öffentliche Server-Verträge

Das System MUST `@sva/sva-mainserver` als Integrationsgrenze halten, die Auth-, Runtime- und Mainserver-Fachlogik nur über öffentliche Package-Verträge verbindet.

#### Scenario: Mainserver-Code greift auf interne Fachimplementierungen zu

- **WHEN** `@sva/sva-mainserver` einen internen `src`-Pfad aus `@sva/auth-runtime`, `@sva/iam-admin` oder `@sva/instance-registry` importiert
- **THEN** schlagen die statischen Boundary-Gates fehl
- **AND** die Integration muss über öffentliche Adapter, Server-Verträge oder neutrale Runtime-Helfer erfolgen
