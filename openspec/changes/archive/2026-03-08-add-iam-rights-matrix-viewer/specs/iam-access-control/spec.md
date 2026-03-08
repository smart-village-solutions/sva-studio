## MODIFIED Requirements

### Requirement: Permissions-Übersicht pro aktivem Kontext

Das System SHALL eine kontextbezogene Permissions-Übersicht für den aktuell angemeldeten Benutzer bereitstellen und optional einen impersonierten Zielkontext auswerten.

#### Scenario: Laden der effektiven Berechtigungen (Self)

- **WHEN** `GET /iam/me/permissions` ohne `actingAsUserId` im aktiven Instanzkontext aufgerufen wird
- **THEN** werden die effektiven RBAC-Berechtigungen für den aktuellen Benutzer zurückgegeben
- **AND** die Antwort enthält ein `subject`-Objekt mit `actorUserId == effectiveUserId` und `isImpersonating=false`

#### Scenario: Laden der effektiven Berechtigungen (Impersonation aktiv)

- **WHEN** `GET /iam/me/permissions` mit `actingAsUserId` aufgerufen wird
- **AND** eine aktive, gültige Impersonation-Session zwischen Actor und Target existiert
- **THEN** werden die effektiven RBAC-Berechtigungen des Target-Subjekts zurückgegeben
- **AND** die Antwort enthält `subject.actorUserId`, `subject.effectiveUserId` und `subject.isImpersonating=true`

#### Scenario: Keine aktive Impersonation für Target

- **WHEN** `GET /iam/me/permissions` mit `actingAsUserId` aufgerufen wird
- **AND** keine aktive Impersonation-Session existiert
- **THEN** wird die Anfrage mit Fehlercode `impersonation_not_active` abgewiesen

#### Scenario: Impersonation ist abgelaufen

- **WHEN** `GET /iam/me/permissions` mit `actingAsUserId` aufgerufen wird
- **AND** die zugehörige Impersonation-Session abgelaufen ist
- **THEN** wird die Anfrage mit Fehlercode `impersonation_expired` abgewiesen
