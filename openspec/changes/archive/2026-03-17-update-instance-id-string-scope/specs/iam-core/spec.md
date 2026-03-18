## MODIFIED Requirements
### Requirement: Token Validation & User Identity

Das System MUST von Keycloak ausgestellte JWT-Tokens validieren und Identity-Claims für nachgelagerte Autorisierungsentscheidungen extrahieren.

#### Scenario: User context extraction

- **WHEN** ein Token gültig ist
- **THEN** extrahiert das System die Claims `sub` (Benutzer-ID), `email`, `name` und `instanceId`
- **AND** `instanceId` wird als normaler, nicht-leerer String in den User-Kontext übernommen
- **AND** das System führt keine UUID-spezifische Normalisierung oder Validierung für `instanceId` aus

### Requirement: SDK Logger for IAM Server Modules

Das System MUST den SDK Logger (`createSdkLogger` aus `@sva/sdk`) für alle operativen Logs in IAM-Servermodulen verwenden, gemäß ADR-006 und Observability Best Practices. `console.log`/`console.error` DÜRFEN im IAM-Servercode NICHT verwendet werden.

#### Scenario: Structured logging with mandatory fields

- **WHEN** ein IAM-Servermodul einen Log-Eintrag erzeugt
- **THEN** enthält der Eintrag mindestens: `workspace_id` (= `instanceId` als String), `component` (z. B. `iam-auth`), `environment`, `level`
- **AND** PII-Redaktion wird automatisch durch den SDK Logger angewendet
- **AND** es erscheinen keine Klartext-Tokens, Session-IDs oder E-Mail-Adressen in Logs
