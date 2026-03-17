## ADDED Requirements

### Requirement: Revisionssicherer Einzel- und Sammelnachweis für Rechtstext-Akzeptanzen

Das System SHALL für Rechtstext-Akzeptanzen exportierbare Einzel- und Sammelnachweise bereitstellen, die konsistent zur Auditspur bleiben.

#### Scenario: Einzel-Nachweis einer Akzeptanz

- **WHEN** ein Administrator den Nachweis einer konkreten Rechtstext-Akzeptanz anfordert
- **THEN** enthält der Nachweis mindestens Benutzerkontext, `legal_text_id`, Version, Zeitpunkt, Ergebnis, `request_id` und `trace_id`
- **AND** der Nachweis bleibt konsistent zu den gespeicherten Audit- und Akzeptanzdaten

#### Scenario: Sammel-Export für Auditprüfung

- **WHEN** ein Administrator einen Zeitraum oder Filter für Rechtstext-Akzeptanzen exportiert
- **THEN** enthält der Export alle passenden Akzeptanz- und Widerrufsereignisse vollständig
- **AND** es entsteht kein Informationsverlust zwischen UI-Sicht, API-Export und Auditspur
