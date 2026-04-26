## MODIFIED Requirements

### Requirement: Permission Decision Engine

The system SHALL evaluate user actions against role-based and resource-scoped permissions with deterministic allow/deny semantics, fail closed when required context is missing, and expose only allowlist-based diagnostics to callers.

#### Scenario: Deny overrides allow

- **WHEN** a user has both an allow and deny permission for the same action and resource scope
- **THEN** the authorization decision is denied
- **AND** the diagnostic reason identifies the deny precedence without exposing internal store details

#### Scenario: Resource-specific allow is evaluated

- **WHEN** a user requests an action on a scoped resource
- **AND** a matching permission exists for that action and resource scope
- **THEN** the authorization decision is allowed

#### Scenario: Fehlender Autorisierungskontext ist fail-closed

- **WHEN** eine serverseitige Mutation ohne gültigen Autorisierungskontext ausgeführt werden soll
- **THEN** wird die Aktion verweigert
- **AND** es wird keine Mutation ausgeführt

#### Scenario: Keine `any`-Casts in aktiver Auth- und IAM-Infrastruktur

- **WHEN** Auth- oder IAM-Server-Code kompiliert wird
- **THEN** enthält kein Modul in den aktiven Zielpackages `@sva/auth-runtime`, `@sva/iam-core`, `@sva/iam-admin`, `@sva/iam-governance` oder `@sva/instance-registry` einen `any`-Cast ohne dokumentierten TODO-Kommentar mit Begründung und Scope
- **AND** Redis-Optionen werden über typisierte Interfaces konfiguriert

#### Scenario: Duplizierte Validierungs-Helfer in Zielpackages konsolidiert

- **WHEN** Input-Validierung in IAM-Endpoints benötigt wird
- **THEN** werden zentrale Utilities aus dem zuständigen Zielpackage oder aus einem explizit dafür vorgesehenen Shared-Package verwendet
- **AND** aktive Auth- und IAM-Zielpackages definieren keine lokalen Duplikate von etablierten Request-, UUID-, Log-Kontext- oder Token-Error-Helfern
