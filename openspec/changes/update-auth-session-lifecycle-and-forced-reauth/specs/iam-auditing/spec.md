## ADDED Requirements

### Requirement: Auditspur für Session-Recovery und Forced Reauth
Das System SHALL Forced-Reauth- und Silent-Session-Recovery-Vorgänge revisionsfähig protokollieren.

#### Scenario: Forced Reauth wird auditiert

- **WHEN** ein Benutzer per Systementscheidung zum Re-Login gezwungen wird
- **THEN** erzeugt das System ein Audit-Event `forced_reauth`
- **AND** das Event enthält Ergebnis, pseudonymisierte Actor-Referenz und keinen Klartext von Tokens oder Session-IDs

#### Scenario: Silent Reauth-Erfolg wird auditiert

- **WHEN** ein stiller Reauth-Versuch erfolgreich eine neue App-Session herstellt
- **THEN** erzeugt das System ein Audit-Event `silent_reauth_success`
- **AND** das Event bleibt frei von Tokenwerten, Session-IDs und Klartext-PII

#### Scenario: Silent Reauth-Fehlschlag wird auditiert

- **WHEN** ein stiller Reauth-Versuch fehlschlägt
- **THEN** erzeugt das System ein Audit-Event `silent_reauth_failed`
- **AND** das Ereignis ist von einem normalen Logout oder Login-Fehler unterscheidbar
