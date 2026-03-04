# IAM Auditing Specification Delta

## ADDED Requirements

### Requirement: Unveränderbare Governance-Audit-Events

Das System SHALL für alle Governance-Aktionen unveränderbare Audit-Events erzeugen und revisionssicher speichern.

#### Scenario: Rechteänderung wird protokolliert

- **WHEN** eine Rollen- oder Rechteänderung beantragt, genehmigt oder abgelehnt wird
- **THEN** erzeugt das System ein Audit-Event mit Zeitstempel, pseudonymisierter Actor-ID, Zielobjekt und Ergebnis
- **AND** das Event kann nachträglich nicht verändert werden
- **AND** Klartext-PII (E-Mail, volle IP-Adresse) wird nicht im Event gespeichert

### Requirement: Exportfähige Compliance-Nachweise

Das System SHALL Audit- und Compliance-Nachweise in den Formaten CSV, JSON und SIEM-kompatibel bereitstellen.

#### Scenario: Export für Auditprüfung

- **WHEN** eine Compliance-Prüfung einen Zeitraum anfordert
- **THEN** kann das System die relevanten Governance-Events exportieren
- **AND** die Exportdaten sind konsistent zu den gespeicherten Audit-Events

### Requirement: Nachweisbare Legal-Text-Akzeptanzen

Das System SHALL Versionen von Rechtstexten und deren Akzeptanz durch Benutzer nachvollziehbar speichern.

#### Scenario: Prüfung einer Akzeptanzhistorie

- **WHEN** die Akzeptanz eines Rechtstextes nachgewiesen werden muss
- **THEN** kann das System Version, Zeitpunkt und zugehörigen Benutzerkontext bereitstellen
- **AND** die Nachweise sind exportierbar

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
