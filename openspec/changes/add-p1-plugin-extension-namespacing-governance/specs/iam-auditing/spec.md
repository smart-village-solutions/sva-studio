## ADDED Requirements

### Requirement: Plugin-Audit-Ereignisse sind namespace-pflichtig

Das IAM-Auditing MUST plugin-beigestellte Audit-Event-Typen in einem fully-qualified Format `<namespace>.<eventName>` behandeln.

#### Scenario: Plugin emittiert namespacetes Audit-Ereignis

- **WHEN** ein Plugin mit Namespace `news` ein Audit-Ereignis fuer eine redaktionelle Aktion registriert oder emittiert
- **THEN** verwendet der Event-Typ das Format `news.<eventName>`
- **AND** das Audit-System kann den Owner-Namespace aus dem Event-Typ deterministisch ableiten

#### Scenario: Plugin emittiert unqualifiziertes Audit-Ereignis

- **WHEN** ein Plugin ein Audit-Ereignis wie `published` ohne Namespace registriert oder emittiert
- **THEN** wird der Beitrag mit einem Validierungsfehler abgewiesen
- **AND** das Audit-System fuehrt kein implizites Prefix-Mapping durch

#### Scenario: Plugin emittiert Audit-Ereignis in fremdem Namespace

- **WHEN** ein Plugin mit Namespace `news` ein Audit-Ereignis wie `events.published` registriert oder emittiert
- **THEN** wird der Beitrag mit einem Ownership-Fehler abgewiesen
- **AND** die Auditspur bleibt dadurch namespace-sicher einem Owner zuordenbar
