## ADDED Requirements

### Requirement: Mainserver-Identitätsreconciliation ist vollständig und geheimnisfrei auditierbar

Das System SHALL Konfliktprüfung, Antrag, Bestätigung, Ausführung, Verifikation, Ablehnung und Nacharbeitszustand einer Mainserver-Identitätsreconciliation mit Actor, Zielinstanz, Zielaccount, Operationsreferenz, Statusübergang, redigierter Grundklasse, Ergebnis, `request_id` und `trace_id` auditieren. Das Audit SHALL keine Credentials, Tokens, vollständigen E-Mail-Adressen, Rohantworten oder fremden Keycloak-Subjects enthalten.

#### Scenario: Erfolgreicher Rebind wird auditiert

- **GIVEN** ein Rebind wurde durch den Mainserver bestätigt und nachgelagert verifiziert
- **WHEN** Studio den Vorgang finalisiert
- **THEN** entsteht ein Audit-Ereignis mit unterschiedlichen Antragsteller- und Bestätigerreferenzen, Operationsreferenz und Ergebnis `success`
- **AND** enthält das Ereignis keine Geheimnisse

#### Scenario: Teilfehler benötigt Nacharbeit

- **GIVEN** der Mainserver-Rebind wurde bestätigt, aber Keycloak-Persistenz oder Bindungsprüfung schlägt fehl
- **WHEN** Studio den Vorgang finalisiert
- **THEN** wird `reconciliation_required` mit redigierter Fehlerklasse auditiert
- **AND** wird kein Erfolg protokolliert
