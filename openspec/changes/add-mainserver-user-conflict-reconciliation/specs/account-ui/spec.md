## ADDED Requirements

### Requirement: Benutzer-Detailansicht macht Mainserver-Identitätskonflikte handhabbar

Das System SHALL einem berechtigten `system_admin` in der Benutzer-Detailansicht einen redigierten Mainserver-Identitätskonfliktstatus, eine Read-only-Prüfaktion und den Status eines zugehörigen Reconciliation-Vorgangs anzeigen. Die Ansicht SHALL keine Credentials, Tokens, vollständigen Upstream-Antworten oder unmaskierten fremden Identitätsdaten anzeigen.

#### Scenario: Konflikt wird geprüft

- **WHEN** ein berechtigter `system_admin` eine Konfliktprüfung für einen Benutzer der aktiven Instanz ausführt
- **THEN** zeigt die Detailansicht den redigierten Befund und den Status `inspection_ready`
- **AND** bietet sie keinen automatischen Rebind an

#### Scenario: Unberechtigter Benutzer öffnet die Detailansicht

- **WHEN** ein Benutzer ohne berechtigten `system_admin`-Kontext einen Konfliktstatus aufrufen möchte
- **THEN** erhält er keine Konfliktdetails und keine Reconciliation-Aktionen

### Requirement: Reconciliation-UI erzwingt getrennte Beantragung und Bestätigung

Das System SHALL Antrag und Bestätigung eines Mainserver-Identitätsrebinds getrennt darstellen und SHALL denselben Account nicht beide Schritte abschließen lassen.

#### Scenario: Zweiter System-Admin bestätigt einen Antrag

- **GIVEN** ein `system_admin` hat einen begründeten Antrag für einen unveränderten Konflikt gestellt
- **WHEN** ein anderer `system_admin` derselben Instanz ihn bestätigt
- **THEN** zeigt die UI die erwartete Wirkung und startet erst nach expliziter Bestätigung die Ausführung

#### Scenario: Antragsteller versucht Selbstbestätigung

- **WHEN** der antragstellende Account den eigenen Rebind bestätigen möchte
- **THEN** blockiert die UI die Aktion und erklärt die Vier-Augen-Regel
