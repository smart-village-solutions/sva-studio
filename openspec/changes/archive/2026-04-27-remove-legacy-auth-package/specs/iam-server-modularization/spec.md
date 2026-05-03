## MODIFIED Requirements

### Requirement: IAM-Server-Hard-Cut in Zielpackages

Der IAM-Server MUST von einer internen Modulstruktur in getrennte Zielpackages überführt werden. Authentifizierung, zentrale Autorisierung, IAM-Administration, IAM-Governance und Instanz-Control-Plane MUST getrennte Package-Verantwortlichkeiten erhalten.

#### Scenario: Authentifizierungslogik wird migriert

- **WHEN** Login, Logout, OIDC, Cookies, Session oder Auth-Middleware geändert werden
- **THEN** liegt die Implementierung in `@sva/auth-runtime`
- **AND** sie importiert keine IAM-Admin-, Governance- oder Instanz-Implementierungsdetails
- **AND** sie wird nicht über das historische Package `@sva/auth` veröffentlicht

#### Scenario: IAM-Admin-Logik wird migriert

- **WHEN** Benutzer, Rollen, Gruppen, Organisationen oder Reconcile-Logik geändert werden
- **THEN** liegt die Implementierung in `@sva/iam-admin`
- **AND** Autorisierungsentscheidungen werden über `@sva/iam-core` konsumiert

#### Scenario: Governance- oder DSR-Logik wird migriert

- **WHEN** DSR, Legal Texts, Audit-nahe IAM-Fälle oder Governance-Flows geändert werden
- **THEN** liegt die Implementierung in `@sva/iam-governance`
- **AND** PII-Verarbeitung ist dort explizit klassifiziert und getestet

#### Scenario: Instanz-Control-Plane wird migriert

- **WHEN** Instanzmodell, Host-Klassifikation, Registry, Provisioning oder Platform-Keycloak-Control-Plane geändert werden
- **THEN** liegt die Implementierung in `@sva/instance-registry`
- **AND** sie wird nicht als Unterfunktion von `@sva/auth-runtime` oder `@sva/iam-admin` umgesetzt

#### Scenario: Legacy-Auth wird entfernt

- **WHEN** `@sva/auth-runtime` und die IAM-Zielpackages die aktiven Runtime- und Fachverträge bereitstellen
- **THEN** existiert kein aktives Workspace-Package `@sva/auth` mehr
- **AND** neue IAM- oder Auth-Änderungen müssen einem Zielpackage zugeordnet werden
