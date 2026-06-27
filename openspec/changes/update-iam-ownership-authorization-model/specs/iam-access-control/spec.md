## MODIFIED Requirements

### Requirement: Persistente RBAC-Basisdaten

Das System SHALL die für Autorisierung erforderlichen RBAC-Basisdaten (`roles`, `permissions`, Rollen-Zuordnungen und Gruppen-Zuordnungen) konsistent und instanzgebunden persistieren. Permissions werden ausschließlich Rollen zugewiesen; Accounts erhalten Permissions nur indirekt über direkte Rollen oder Gruppenrollen.

#### Scenario: Rollenauflösung im Instanzkontext

- **WHEN** Rollen- und Permission-Zuordnungen für einen Benutzer abgefragt werden
- **THEN** werden ausschließlich Zuordnungen der aktiven `instanceId` berücksichtigt
- **AND** organisationsfremde Zuordnungen bleiben wirkungslos
- **AND** direkte Account-Permissions werden nicht als fachliche Berechtigungsquelle ausgewertet

### Requirement: Zentrale Authorize-Schnittstelle (RBAC v1)

Das System SHALL eine zentrale Allow-only-Autorisierungsschnittstelle bereitstellen, die pro Anfrage eine deterministische Entscheidung mit Begründung liefert und Diagnoseinformationen für Admin-Transparenz bereitstellen kann.

#### Scenario: Autorisierungsentscheidung mit Begründung

- **WHEN** ein Modul `POST /iam/authorize` mit `instanceId`, `action` und `resource` aufruft
- **THEN** liefert das System eine Antwort mit `allowed` und `reason`
- **AND** die Entscheidung ist bei identischem Kontext reproduzierbar
- **AND** fehlende Allow-Grants führen zu einer Deny-Entscheidung
- **AND** explizite `deny`-Permissions werden nicht als fachliches Modell unterstützt

#### Scenario: Strukturierte Permission-Felder sind UI-verfügbar

- **WHEN** die Permissions-Übersicht zurückgegeben wird
- **THEN** enthält jeder Permission-Eintrag mindestens `action`, `resourceType`, optionale `resourceId`, optionale `organizationId`, optionale `scope` und `sourceRoleIds`
- **AND** diese Felder können ohne zusätzliche Server-Interpretation in einer Admin-UI gerendert werden
- **AND** die Antwort enthält keine fachliche `effect`-Unterscheidung zwischen Allow und Deny

## ADDED Requirements

### Requirement: Owner-basierte Datensatz-Scopes

Das System SHALL gescopte Datensatz-Permissions gegen kanonische IAM-Ownership auswerten.

#### Scenario: Eigene Inhalte

- **WHEN** ein Benutzer eine Permission mit Scope `own` besitzt
- **AND** ein Inhalt `owner_user_id` gleich dem aktuellen Account besitzt
- **THEN** ist der Scope für diesen Inhalt erfüllt
- **AND** `creator_account_id` allein begründet keinen Own-Zugriff

#### Scenario: Aktive Organisation

- **WHEN** ein Benutzer eine Permission mit Scope `organization` besitzt
- **AND** eine aktive Organisation gesetzt ist
- **THEN** ist der Scope für Inhalte mit `owner_user_id` gleich dem aktuellen Account oder `owner_organization_id` gleich der aktiven Organisation erfüllt

#### Scenario: Keine aktive Organisation

- **WHEN** ein Benutzer eine Permission mit Scope `organization` besitzt
- **AND** keine aktive Organisation gesetzt ist
- **THEN** wirkt dieser Scope für inhaltsartige Datensätze wie `own`
- **AND** Inhalte anderer Accounts oder ownerlose Inhalte werden nicht sichtbar

### Requirement: Vollständige System-Admin-Permission-Synchronisierung

Das System SHALL die geschützte tenantlokale Rolle `system_admin` als normale Rolle mit vollständigen tenant-relevanten Permissions synchronisieren.

#### Scenario: Neue tenant-relevante Permission

- **WHEN** eine neue tenant-visible Permission registriert oder migriert wird
- **THEN** erhält `system_admin` diese Permission mit Scope `all`
- **AND** ein Test oder Gate verhindert, dass tenant-visible Permissions ohne `system_admin`-Grant bleiben
