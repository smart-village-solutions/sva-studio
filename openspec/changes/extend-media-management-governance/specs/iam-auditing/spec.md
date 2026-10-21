## ADDED Requirements

### Requirement: Bestehendes Medienaudit für Tags und Scanentscheidungen

Das System SHALL Tag-Änderungen und Scan-Freigabeentscheidungen über die bestehenden instanzbezogenen Metadaten-/Medien-Auditpfade erfassen, ohne ein weiteres Audit-Subsystem einzuführen.

#### Scenario: Tags eines Assets werden geändert

- **WHEN** ein berechtigter Benutzer die Tag-Liste eines Assets ändert
- **THEN** erfasst der bestehende Metadaten-Auditpfad Aktion, Ergebnis, Instanz, pseudonymisierten Actor und Asset-Zielreferenz
- **AND** enthält das Ereignis keine Tagwerte, Klartext-PII oder instanzfremden Asset-Daten

#### Scenario: Scan erlaubt oder verhindert die Freigabe

- **WHEN** ein Scan die weitere Verarbeitung erlaubt oder wegen Fund beziehungsweise technischer Prüfungsschwierigkeiten verhindert
- **THEN** erfasst das Medienaudit Ergebnis und normierten Reason-Code mit Instanz, Asset-/Job-Bezug und vorhandener Request-/Trace-Korrelation
- **AND** ist die Ausführung einem pseudonymisierten Actor beziehungsweise Systemakteur zugeordnet
- **AND** enthält das Ereignis keine Dateiinhalte, rohen Scanner-Antworten, Signaturnamen, Storage-Keys, Secrets oder Klartext-PII
