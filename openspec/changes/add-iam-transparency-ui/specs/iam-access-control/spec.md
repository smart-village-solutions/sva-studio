## MODIFIED Requirements

### Requirement: Permissions-Übersicht pro aktivem Kontext

Das System SHALL eine kontextbezogene Permissions-Übersicht für den aktuell angemeldeten Benutzer bereitstellen, optional einen impersonierten Zielkontext auswerten und dabei alle für Transparenz- und Diagnose-UI erforderlichen strukturierten Felder liefern.

#### Scenario: Laden der effektiven Berechtigungen (Self)

- **WHEN** `GET /iam/me/permissions` ohne `actingAsUserId` im aktiven Instanzkontext aufgerufen wird
- **THEN** werden die effektiven RBAC-Berechtigungen für den aktuellen Benutzer zurückgegeben
- **AND** die Antwort enthält ein `subject`-Objekt mit `actorUserId == effectiveUserId` und `isImpersonating=false`

#### Scenario: Laden der effektiven Berechtigungen (Impersonation aktiv)

- **WHEN** `GET /iam/me/permissions` mit `actingAsUserId` aufgerufen wird
- **AND** eine aktive, gültige Impersonation-Session zwischen Actor und Target existiert
- **THEN** werden die effektiven RBAC-Berechtigungen des Target-Subjekts zurückgegeben
- **AND** die Antwort enthält `subject.actorUserId`, `subject.effectiveUserId` und `subject.isImpersonating=true`

#### Scenario: Impersonation nur im zulässigen Policy-Kontext

- **WHEN** `GET /iam/me/permissions` mit `actingAsUserId` aufgerufen wird
- **AND** Actor und Target nicht im zulässigen Instanz-/Organisationskontext liegen
- **THEN** wird die Anfrage mit einem strukturierten Deny-Fehler abgewiesen
- **AND** es werden keine Detaildaten des Target-Subjekts offengelegt

#### Scenario: Strukturierte Permission-Felder sind UI-verfügbar

- **WHEN** die Permissions-Übersicht zurückgegeben wird
- **THEN** enthält jeder Permission-Eintrag mindestens `action`, `resourceType`, optionale `resourceId`, optionale `organizationId`, optionale `effect`, optionale `scope` und `sourceRoleIds`
- **AND** diese Felder können ohne zusätzliche Server-Interpretation in einer Admin-UI gerendert werden

#### Scenario: Keine aktive Impersonation für Target

- **WHEN** `GET /iam/me/permissions` mit `actingAsUserId` aufgerufen wird
- **AND** keine aktive Impersonation-Session existiert
- **THEN** wird die Anfrage mit Fehlercode `impersonation_not_active` abgewiesen

#### Scenario: Impersonation ist abgelaufen

- **WHEN** `GET /iam/me/permissions` mit `actingAsUserId` aufgerufen wird
- **AND** die zugehörige Impersonation-Session abgelaufen ist
- **THEN** wird die Anfrage mit Fehlercode `impersonation_expired` abgewiesen

### Requirement: Zentrale Authorize-Schnittstelle (RBAC v1)

Das System SHALL eine zentrale Autorisierungsschnittstelle bereitstellen, die pro Anfrage eine deterministische Entscheidung mit Begründung liefert und Diagnoseinformationen für Admin-Transparenz bereitstellen kann.

#### Scenario: Autorisierungsentscheidung mit Begründung

- **WHEN** ein Modul `POST /iam/authorize` mit `instanceId`, `action` und `resource` aufruft
- **THEN** liefert das System eine Antwort mit `allowed` und `reason`
- **AND** die Entscheidung ist bei identischem Kontext reproduzierbar

#### Scenario: Request-Input wird schema-validiert

- **WHEN** ein `POST /iam/authorize`-Request eingeht
- **THEN** wird der Request-Body gegen ein Zod-Schema validiert
- **AND** bei ungültigem Input wird ein strukturierter 400-Fehler zurückgegeben

#### Scenario: Diagnosefelder sind für Admin-UI auswertbar

- **WHEN** eine Autorisierungsentscheidung zusätzliche technische Einordnung benötigt
- **THEN** enthält die Antwort ausschließlich allowlist-basierte Diagnosefelder mit konflikt-, Hierarchie-, Scope- oder Impersonation-Hinweisen
- **AND** interne Rohdaten, Stacktraces oder nicht spezifizierte Diagnosefelder werden nicht ausgegeben
- **AND** diese Diagnoseinformationen sind stabil genug, um in einer Admin-Oberfläche verständlich dargestellt zu werden

#### Scenario: Keine `any`-Casts in Auth-Infrastruktur

- **WHEN** Auth-Server-Code kompiliert wird
- **THEN** enthält kein Modul in `packages/auth/src/` einen `any`-Cast ohne dokumentierten TODO-Kommentar mit Begründung und Scope
- **AND** Redis-Optionen werden über typisierte Interfaces konfiguriert

#### Scenario: Duplizierte Validierungs-Helfer konsolidiert

- **WHEN** Input-Validierung in IAM-Endpoints benötigt wird
- **THEN** werden zentrale Utilities aus `packages/auth/src/shared/` verwendet
- **AND** keine Dateien in `packages/auth/src/` definieren lokale Duplikate von `readString`, `isUuid`, `buildLogContext` oder `isTokenErrorLike`
