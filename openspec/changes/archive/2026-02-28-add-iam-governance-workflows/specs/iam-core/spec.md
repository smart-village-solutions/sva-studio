# IAM Core Specification Delta (Governance Workflows)

## ADDED Requirements

### Requirement: Governance-Funktionen nur für berechtigte Identitäten

Das System SHALL Governance-Aktionen ausschließlich für authentifizierte und explizit berechtigte Identitäten im aktiven Instanzkontext zulassen.

#### Scenario: Unberechtigter Zugriff auf Governance-Aktion

- **WHEN** ein Benutzer ohne Governance-Berechtigung eine Workflow-Aktion ausführt
- **THEN** wird die Aktion abgewiesen
- **AND** ein Sicherheitsereignis wird protokolliert

### Requirement: Sichtbarer Identitätswechsel bei Impersonation

Das System SHALL bei aktiver Impersonation den effektiven Benutzerkontext eindeutig kennzeichnen.

#### Scenario: Anfrage während Impersonation

- **WHEN** eine Anfrage in einer aktiven Impersonation-Sitzung gestellt wird
- **THEN** enthält der Kontext sowohl Ursprung als auch impersonierte Identität
- **AND** die Anfrage bleibt auf die freigegebene Dauer und `instanceId` begrenzt

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
