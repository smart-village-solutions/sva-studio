## ADDED Requirements

### Requirement: Verbindlicher OIDC-Client- und Token-Vertrag für Milestone 1

Das System SHALL für CMS, App und IAM-Service einen verbindlichen Keycloak-Client- und Token-Vertrag verwenden, damit Authentifizierung, Session-Aufbau und Identity-Auflösung konsistent bleiben.

#### Scenario: CMS und App verwenden denselben Identitätskontext

- **WHEN** ein Benutzer sich im CMS oder in der App über Keycloak authentifiziert
- **THEN** enthalten die verwendeten Tokens mindestens `sub` und den kanonischen Mandantenkontext `instanceId`
- **AND** Rollenclaims bleiben für systemische Sofortentscheidungen verfügbar
- **AND** die serverseitige IAM-Auflösung behandelt beide Clients als dieselbe fachliche Identität

#### Scenario: Service-Client bleibt auf Admin- und Sync-Aufgaben begrenzt

- **WHEN** der IAM-Service den Keycloak-Service-Account verwendet
- **THEN** dient dieser ausschließlich für Admin-API-, Sync- und Reconcile-Aufrufe
- **AND** interaktive Browser-Logins verwenden keinen Service-Client

### Requirement: Einheitlicher Login für CMS und App

Das System SHALL einen einheitlichen Login bereitstellen, bei dem CMS und App eine gemeinsame IdP-Sitzung nutzen können, ohne voneinander abweichende Identitätskontexte aufzubauen.

#### Scenario: Bereits angemeldeter Benutzer öffnet das CMS

- **WHEN** für einen Benutzer bereits eine gültige Keycloak-Sitzung aus der App oder dem CMS existiert
- **THEN** kann das zweite Frontend ohne erneute Passwortabfrage einen konsistenten Login abschließen
- **AND** die resultierende Session referenziert denselben `sub`- und `instanceId`-Kontext

### Requirement: Lifecycle-Modell für interne und externe Accounts

Das System SHALL Accounts mindestens als `internal` oder `external` klassifizieren und diese Unterscheidung in Onboarding-, Berechtigungs- und Review-Flows auswertbar machen.

#### Scenario: Externer Datenlieferant wird angelegt

- **WHEN** ein Administrator einen externen Datenlieferanten anlegt oder importiert
- **THEN** wird der Account-Typ als `external` gespeichert
- **AND** nachgelagerte UI-, Governance- und Review-Funktionen können interne und externe Konten unterscheiden

### Requirement: Standardisiertes Onboarding für eingeladene Benutzer

Das System SHALL einen standardisierten Onboarding-Workflow für neue Accounts bereitstellen.

#### Scenario: Eingeladener Benutzer bestätigt sein Onboarding

- **WHEN** ein neuer Benutzer eingeladen wird
- **THEN** wird ein nachvollziehbarer Onboarding-Status erzeugt
- **AND** erforderliche Schritte wie Erstlogin und optionale Schulungsbestätigung bleiben prüfbar
- **AND** produktive Rechte können bis zum Abschluss definierter Mindestschritte eingeschränkt bleiben

### Requirement: Deterministisches Offboarding

Das System SHALL Accounts kontrolliert außer Betrieb nehmen können, ohne Restzugriffe offenzulassen.

#### Scenario: Mitarbeiter verlässt die Organisation

- **WHEN** ein Account offboarded wird
- **THEN** werden aktive Rollen, Gruppen, Delegationen und Sessions für den fachlich definierten Scope entzogen oder deaktiviert
- **AND** der Offboarding-Vorgang wird auditierbar protokolliert
- **AND** nachfolgende Autorisierungsanfragen verarbeiten den Account fail-closed
