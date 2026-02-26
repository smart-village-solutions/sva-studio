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

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
