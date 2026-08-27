## ADDED Requirements

### Requirement: Direkter Mainserver-Identitätsrebind ist geheimnisfrei auditierbar

Das System SHALL Konfliktprüfung, Ausführung und Ergebnis einer Mainserver-Identitätsreconciliation mit Actor, Zielinstanz, Zielaccount, Operationsreferenz, redigierter Grundklasse, Ergebnis, `request_id` und `trace_id` über das bestehende IAM-Audit erfassen. Das Audit SHALL keine Credentials, Tokens, vollständigen E-Mail-Adressen, Rohantworten oder fremden Keycloak-Subjects enthalten.

#### Scenario: Erfolgreicher Rebind wird auditiert

- **GIVEN** der Mainserver-Rebind wurde bestätigt und nachgelagert verifiziert
- **WHEN** Studio den direkten Vorgang abschließt
- **THEN** entsteht ein Audit-Ereignis mit Actor, Operationsreferenz und Ergebnis `success`
- **AND** enthält das Ereignis keine Geheimnisse

#### Scenario: Teilfehler benötigt Nacharbeit

- **GIVEN** der Mainserver-Rebind wurde bestätigt, aber Keycloak-Persistenz oder Bindungsprüfung schlägt fehl
- **WHEN** Studio den Vorgang abschließt
- **THEN** wird `reconciliation_required` mit redigierter Fehlerklasse auditiert
- **AND** wird kein Erfolg protokolliert
