## MODIFIED Requirements

### Requirement: Zentrale Authorize-Schnittstelle (RBAC v1)

Das System SHALL eine zentrale Autorisierungsschnittstelle bereitstellen, die pro Anfrage eine deterministische Entscheidung mit Begründung liefert.

#### Scenario: Autorisierungsentscheidung mit Begründung

- **WHEN** ein Modul `POST /iam/authorize` mit `instanceId`, `action` und `resource` aufruft
- **THEN** liefert das System eine Antwort mit `allowed` und `reason`
- **AND** die Entscheidung ist bei identischem Kontext reproduzierbar

#### Scenario: Request-Input wird schema-validiert

- **WHEN** ein `POST /iam/authorize`-Request eingeht
- **THEN** wird der Request-Body gegen ein Zod-Schema validiert
- **AND** bei ungültigem Input wird ein strukturierter 400-Fehler zurückgegeben

#### Scenario: Keine `any`-Casts in Auth-Infrastruktur

- **WHEN** Auth-Server-Code kompiliert wird
- **THEN** enthält kein Modul in `packages/auth/src/` einen `any`-Cast ohne dokumentierten TODO-Kommentar mit Begründung und Scope
- **AND** Redis-Optionen werden über typisierte Interfaces konfiguriert

#### Scenario: Duplizierte Validierungs-Helfer konsolidiert

- **WHEN** Input-Validierung in IAM-Endpoints benötigt wird
- **THEN** werden zentrale Utilities aus `packages/auth/src/shared/` verwendet
- **AND** keine Dateien in `packages/auth/src/` definieren lokale Duplikate von `readString`, `isUuid`, `buildLogContext` oder `isTokenErrorLike`
