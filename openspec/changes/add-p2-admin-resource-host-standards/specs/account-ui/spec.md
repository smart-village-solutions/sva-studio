## ADDED Requirements

### Requirement: Admin-Ressourcen nutzen hostgeführte Listen- und Detailstandards

Das System SHALL für Admin-Ressourcen hostgeführte Standards für Suche, Filter, Bulk-Aktionen, Historie und Revisionen bereitstellen.

#### Scenario: Ressource konfiguriert Such- und Filterverhalten

- **WHEN** eine Admin-Ressource Suche oder Filter benötigt
- **THEN** beschreibt sie diese Fähigkeiten deklarativ
- **AND** das zugrunde liegende UI- und Interaktionsmuster wird vom Host bereitgestellt

#### Scenario: Ressource nutzt hostgeführte Bulk-Aktionen

- **WHEN** eine Ressource Bulk-Aktionen anbietet
- **THEN** erfolgen Auswahlmuster, Bestätigung und Ergebnisdarstellung nach einem kanonischen Host-Standard
- **AND** die Ressource liefert nur die fachliche Konfiguration der Aktion
