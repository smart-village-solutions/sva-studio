## ADDED Requirements
### Requirement: Revisionssichere Auditspur für Medienereignisse

Das System SHALL für sicherheits- und fachrelevante Medienoperationen unveränderbare Audit-Events erzeugen.

#### Scenario: Upload oder Asset-Anlage wird protokolliert

- **WHEN** ein Medium hochgeladen oder als Asset registriert wird
- **THEN** erzeugt das System ein Audit-Event mit Zeitpunkt, pseudonymisierter Actor-Referenz, Scope, Zielobjekt und Ergebnis
- **AND** Klartext-PII oder geheime Zugangsartefakte werden nicht im Event gespeichert

#### Scenario: Metadaten oder Sichtbarkeit eines Assets werden geändert

- **WHEN** redaktionelle Metadaten, Sichtbarkeit oder fachliche Einordnung eines Assets geändert werden
- **THEN** erzeugt das System ein Audit-Event mit Änderungsart und Ergebnis
- **AND** das Event bleibt exportierbar und unveränderbar

#### Scenario: Lösch- oder Ersetzungsentscheidung wird protokolliert

- **WHEN** ein Asset gelöscht, archiviert oder durch ein neues Original ersetzt werden soll
- **THEN** erzeugt das System ein Audit-Event mit Aktion, Ergebnis und referenzbezogenem Kontext
- **AND** eine Blockierung wegen aktiver Nutzung bleibt ebenso nachvollziehbar auditierbar

#### Scenario: Variantenverarbeitung bleibt nachvollziehbar

- **WHEN** das System Varianten generiert, erneut erzeugt oder verwirft
- **THEN** entstehen dafür nachvollziehbare Medienereignisse mit Ergebnis und technischem Status
- **AND** operative Fehlerpfade bleiben redigiert und korrelierbar
