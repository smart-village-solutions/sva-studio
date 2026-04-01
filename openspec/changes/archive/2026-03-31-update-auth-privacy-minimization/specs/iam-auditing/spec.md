## MODIFIED Requirements

### Requirement: Immutable Logging für Identity-Basisereignisse
Das System MUST sicherheitsrelevante Identity-Ereignisse aus Child A unveraenderbar protokollieren und Audit- von operativen Logging-Pfaden strikt trennen.

#### Scenario: Login/Logout wird protokolliert

- **WHEN** ein Benutzer sich erfolgreich anmeldet oder abmeldet
- **THEN** wird ein unveraenderbares Audit-Event mit Zeitpunkt, pseudonymisierter Actor-Referenz und Ergebnis erzeugt
- **AND** Klartext-PII wird nicht gespeichert
- **AND** tokenhaltige Redirect- oder Logout-URLs werden weder im Audit- noch im operativen Log als Klartext gespeichert

#### Scenario: Token-Validierungsfehler wird protokolliert

- **WHEN** Token-Validierung fehlschlaegt (z. B. `invalid`, `expired`, `issuer_mismatch`, `audience_mismatch`)
- **THEN** wird ein `warn`-faehiges Sicherheitsereignis mit Fehlerklasse erzeugt
- **AND** Tokenwerte, tokenhaltige URLs, Session-IDs und Klartext-PII werden nicht geloggt
