## ADDED Requirements

### Requirement: Verhaltensgleiche Delegationsentscheidungen

Die Erstellung einer Governance-Delegation SHALL Payload-Normalisierung und reine Policy-Entscheidungen von instanzgebundener Account-Auflösung, Persistenz und Audit-Wiring trennen, ohne Fehlerpriorität, Reason Codes, Zeitgrenzen, Instanzfilter, SQL-Parameter oder Auditfelder zu verändern.

#### Scenario: Ungültige Delegation wird vor I/O abgelehnt

- **WHEN** ein Pflichtfeld, die Rollen-UUID, der Ticketzustand oder das Zeitfenster ungültig ist
- **THEN** liefert die Delegationsentscheidung denselben bestehenden Reason Code
- **AND** es findet keine Account-Auflösung oder Persistenz statt

#### Scenario: Account- und Self-Approval-Prüfung bleibt fail-closed

- **WHEN** Delegator, Delegatee oder Approver in der Actor-Instanz nicht aufgelöst werden kann
- **THEN** wird die Delegation mit `unauthorized` abgelehnt
- **AND** bei identischem Delegator- und Approver-Account wird `DENY_SELF_APPROVAL` geliefert
- **AND** vor der Entscheidung werden alle drei Account-Auflösungen in bestehender Reihenfolge ausgeführt

#### Scenario: Gültige Delegation bewahrt Persistenz und Audit

- **WHEN** eine gültige Delegation erstellt wird
- **THEN** bleiben Statusgrenze, SQL-Reihenfolge und SQL-Parameter unverändert
- **AND** das Audit-Dual-Write enthält dieselben Event-, Actor-, Target-, Ticket-, Request- und Trace-Felder
- **AND** Queryfehler werden weiterhin ohne neue Catch- oder Transaktionsgrenze propagiert
