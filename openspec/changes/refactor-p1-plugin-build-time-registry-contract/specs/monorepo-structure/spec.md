## ADDED Requirements

### Requirement: Kanonischer Build-time-Registry-Vertrag fuer Package-Beitraege

Das Monorepo SHALL einen gemeinsamen Build-time-Registry-Vertrag bereitstellen, ueber den der Host statische Package-Beitraege fuer Plugins und Admin-Ressourcen deterministisch materialisiert.

#### Scenario: Host erzeugt einen einzigen Registry-Snapshot

- **WHEN** die Host-App ihre statischen Package-Beitraege initialisiert
- **THEN** verwendet sie einen gemeinsamen Build-time-Registry-Snapshot statt separater Merge-Schritte fuer Routen, Navigation, Content-Typen, Uebersetzungen und Admin-Ressourcen
- **AND** der Snapshot bleibt build-time und hostkontrolliert

#### Scenario: Registry validiert Konflikte vor der Materialisierung

- **WHEN** statische Package-Beitraege doppelte Plugin-IDs oder kollidierende Admin-Ressourcen deklarieren
- **THEN** bricht die Registry-Erzeugung deterministisch mit einem Fehler ab
- **AND** der Host publiziert keinen teilweise inkonsistenten Build-time-Zustand
