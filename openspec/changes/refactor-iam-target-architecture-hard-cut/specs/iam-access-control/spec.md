## MODIFIED Requirements

### Requirement: Zentrale Authorize-Schnittstelle (RBAC v1)
Das System SHALL eine zentrale Allow-only-Autorisierungsschnittstelle bereitstellen, die pro Anfrage eine deterministische Entscheidung mit Begründung liefert und Diagnoseinformationen für Admin-Transparenz bereitstellen kann. Die reine Entscheidung MUST über `@sva/iam-core` laufen; Runtime-nahe Snapshot-, Redis- und DB-Recompute-Pfade MAY in `@sva/auth-runtime` bleiben.

#### Scenario: Autorisierungsentscheidung mit Begründung
- **WHEN** ein Modul `POST /iam/authorize` mit `instanceId`, `action` und `resource` aufruft
- **THEN** liefert das System eine Antwort mit `allowed` und `reason`
- **AND** die Entscheidung ist bei identischem Kontext reproduzierbar
- **AND** fehlende Allow-Grants führen zu einer Deny-Entscheidung
- **AND** explizite `deny`-Permissions werden nicht als fachliches Modell unterstützt

#### Scenario: Request-Input wird schema-validiert
- **WHEN** ein `POST /iam/authorize`-Request eingeht
- **THEN** wird der Request-Body gegen ein Zod-Schema validiert
- **AND** bei ungültigem Input wird ein strukturierter 400-Fehler zurückgegeben

#### Scenario: Diagnosefelder sind für Admin-UI auswertbar
- **WHEN** eine Autorisierungsentscheidung zusätzliche technische Einordnung benötigt
- **THEN** enthält die Antwort ausschließlich allowlist-basierte Diagnosefelder mit konflikt-, Hierarchie-, Scope- oder Impersonation-Hinweisen
- **AND** interne Rohdaten, Stacktraces oder nicht spezifizierte Diagnosefelder werden nicht ausgegeben
- **AND** diese Diagnoseinformationen sind stabil genug, um in einer Admin-Oberfläche verständlich dargestellt zu werden

#### Scenario: Keine `any`-Casts in IAM- und Auth-Runtime-Infrastruktur
- **WHEN** Auth-Server-Code kompiliert wird
- **THEN** enthalten die Zielpackages `packages/auth-runtime/src/`, `packages/iam-admin/src/`, `packages/iam-governance/src/` und `packages/instance-registry/src/` keinen `any`-Cast ohne dokumentierten TODO-Kommentar mit Begründung und Scope
- **AND** Redis-Optionen werden über typisierte Interfaces konfiguriert

#### Scenario: Duplizierte Validierungs-Helfer konsolidiert
- **WHEN** Input-Validierung in IAM-Endpoints benötigt wird
- **THEN** werden zentrale Utilities aus dem zuständigen Zielpackage verwendet
- **AND** keine Dateien in den IAM- und Auth-Runtime-Zielpackages definieren lokale Duplikate von `readString`, `isUuid`, `buildLogContext` oder `isTokenErrorLike`

#### Scenario: Strukturierte Permission-Felder sind UI-verfügbar
- **WHEN** die Permissions-Übersicht zurückgegeben wird
- **THEN** enthält jeder Permission-Eintrag mindestens `action`, `resourceType`, optionale `resourceId`, optionale `organizationId`, optionale `scope` und `sourceRoleIds`
- **AND** diese Felder können ohne zusätzliche Server-Interpretation in einer Admin-UI gerendert werden
- **AND** die Antwort enthält keine fachliche `effect`-Unterscheidung zwischen Allow und Deny

#### Scenario: Authorize-Hot-Path bleibt performant
- **WHEN** die Authorize-Engine nach `@sva/iam-core` migriert wurde
- **THEN** verursacht die Migration keine zusätzlichen DB- oder Redis-Roundtrips im Cache-Hit-Pfad
- **AND** bestehende Cache-Hit-SLOs und Performance-Baselines bleiben maßgeblich
