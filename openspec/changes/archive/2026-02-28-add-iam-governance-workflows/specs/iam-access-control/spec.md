# IAM Access Control Specification Delta (Governance)

## ADDED Requirements

### Requirement: Governance-Workflows mit Vier-Augen-Prinzip

Das System SHALL kritische Rechteänderungen über einen Workflow mit Vier-Augen-Freigabe steuern.

#### Scenario: Kritische Änderung ohne Freigabe

- **WHEN** eine kritische Rechteänderung beantragt wurde
- **AND** keine zweite berechtigte Freigabe vorliegt
- **THEN** wird die Änderung nicht wirksam
- **AND** der Status bleibt nicht-aktiv

### Requirement: Instanzisolierte Governance-Aktionen

Das System SHALL alle Governance-Aktionen strikt auf die aktive `instanceId` begrenzen.

#### Scenario: Governance-Aktion über Instanzgrenze

- **WHEN** eine Workflow-Aktion auf Ressourcen einer anderen Instanz abzielt
- **THEN** wird die Aktion abgewiesen
- **AND** ein entsprechender Denial-/Audit-Eintrag wird erzeugt

### Requirement: Sicheres Impersonation-Modell

Das System SHALL Impersonation nur unter definierten Sicherheitsbedingungen erlauben (Ticketpflicht, Zeitlimit, Sichtbarkeit).

#### Scenario: Ablauf einer Impersonation-Sitzung

- **WHEN** die erlaubte Dauer einer Impersonation-Sitzung abläuft
- **THEN** wird die Sitzung beendet
- **AND** nachfolgende Aktionen im Namen des Zielbenutzers sind nicht mehr zulässig

### Requirement: Verbindliche Definition kritischer Rechteänderungen

Das System SHALL kritische Rechteänderungen als approval-pflichtige Governance-Aktionen behandeln.

#### Scenario: Privilegierte Rollenänderung ohne Approval

- **WHEN** eine Rolle mit privilegierten IAM-/Security-Permissions vergeben oder entzogen werden soll
- **AND** keine gültige Freigabe vorliegt
- **THEN** wird die Änderung nicht angewendet
- **AND** ein Denial mit `reason_code` wird erzeugt

### Requirement: Ticket-Validierung für kritische Governance-Aktionen

Das System SHALL kritische Governance-Aktionen nur mit gültiger Ticketreferenz und zulässigem Ticketstatus ausführen.

#### Scenario: Ticketstatus ungültig

- **WHEN** eine kritische Aktion mit `ticket_state=closed` beantragt wird
- **THEN** wird die Aktion abgewiesen
- **AND** der Denial-Code lautet `DENY_TICKET_STATE_INVALID`

### Requirement: Harte Zeitgrenzen für Delegation und Impersonation

Das System SHALL harte Maximaldauern für Delegation und Impersonation erzwingen.

#### Scenario: Impersonation überschreitet Obergrenze

- **WHEN** eine Impersonation mit einer Dauer größer als der globalen Obergrenze angelegt wird
- **THEN** wird die Aktion abgewiesen
- **AND** der Denial-Code lautet `DENY_IMPERSONATION_DURATION_EXCEEDED`

### Requirement: Kein Self-Approval bei kritischen Aktionen

Das System SHALL Self-Approval für kritische Governance-Aktionen verhindern.

#### Scenario: Antragsteller versucht Selbstfreigabe

- **WHEN** `requester` und `approver` identisch sind
- **THEN** wird die Freigabe abgewiesen
- **AND** der Denial-Code lautet `DENY_SELF_APPROVAL`

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
