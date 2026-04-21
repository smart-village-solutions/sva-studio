## ADDED Requirements

### Requirement: Routing konsumiert den Build-time-Registry-Snapshot des Hosts

Das Routing-System SHALL Plugin-Routen und registrierte Admin-Ressourcen aus einem kanonischen Build-time-Registry-Snapshot des Hosts beziehen statt aus voneinander getrennten Listen und Merge-Pfaden.

#### Scenario: Host uebergibt normalisierte Build-time-Beitraege an das Routing

- **WHEN** die Frontend-App ihren Router erzeugt
- **THEN** uebergibt sie dem Routing die normalisierten Plugin- und Admin-Ressourcen-Beitraege aus einem gemeinsamen Build-time-Registry-Snapshot
- **AND** das Routing muss diese Beitraege nicht erneut aus mehreren hostseitigen Hilfsregistries zusammensuchen

#### Scenario: Routing materialisiert weiterhin nur hostkontrollierte Routen

- **WHEN** der Build-time-Registry-Snapshot Plugin-Routen und Admin-Ressourcen enthaelt
- **THEN** materialisiert das Routing daraus nur die vom Host unterstuetzten Pfade und Guards
- **AND** nicht vom Routing unterstuetzte oder nicht freigegebene Laufzeitbeitraege bleiben weiterhin ausgeschlossen
