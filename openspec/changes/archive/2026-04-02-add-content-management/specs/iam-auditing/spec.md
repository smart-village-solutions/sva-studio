## ADDED Requirements

### Requirement: Revisionssichere Auditspur für Inhaltsänderungen

Das System SHALL für Inhaltsanlage, Inhaltsbearbeitung und Statuswechsel unveränderbare Audit-Events erzeugen.

#### Scenario: Inhalt wird angelegt oder bearbeitet

- **WHEN** ein Inhalt erstellt oder aktualisiert wird
- **THEN** erzeugt das System ein Audit-Event mit Zeitpunkt, pseudonymisierter Actor-Referenz, Zielobjekt und Ergebnis
- **AND** Klartext-PII wird nicht im Audit-Event gespeichert

#### Scenario: Status eines Inhalts wird geändert

- **WHEN** ein berechtigter Benutzer den Status eines Inhalts ändert
- **THEN** erzeugt das System ein Audit-Event mit altem Status, neuem Status und Ergebnis
- **AND** das Event bleibt exportierbar und unveränderbar

### Requirement: UI-Historie basiert auf auditierbaren Änderungsereignissen

Das System SHALL die Inhalts-Historie aus auditierbaren Änderungsereignissen ableiten.

#### Scenario: Historie in der UI entspricht Auditspur

- **WHEN** die Historie eines Inhalts in der UI angezeigt wird
- **THEN** basiert sie auf den zugehörigen auditierbaren Änderungsereignissen
- **AND** die dargestellten Einträge sind konsistent zur revisionssicheren Auditspur

