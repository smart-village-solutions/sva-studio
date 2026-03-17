## ADDED Requirements

### Requirement: Komplexitätssensitive Coverage-Floors für kritische Module
Das System SHALL Mindest-Coverage-Anforderungen für kritische Module auch bei wachsender Komplexität aufrechterhalten und bei Bedarf verschärfen.

#### Scenario: Kritisches Modul wird komplexer
- **GIVEN** ein Modul ist als kritisch klassifiziert und unterliegt einem Coverage-Floor
- **WHEN** seine strukturelle Komplexität ansteigt oder definierte Hotspot-Schwellen erreicht
- **THEN** wird der bestehende Coverage-Floor nicht abgesenkt
- **AND** die Policy kann einen höheren oder feiner granularen Floor für dieses Modul verlangen

#### Scenario: Hotspot erhält feinere Coverage-Regeln
- **GIVEN** innerhalb eines kritischen Moduls ist ein Pfad oder eine Datei auffällig komplex
- **WHEN** die Coverage-Policy überprüft oder angepasst wird
- **THEN** kann der Floor für diesen Hotspot auf Paket-, Pfad- oder Dateiebene präzisiert werden
- **AND** Reviewer können nachvollziehen, warum dort strengere Testanforderungen gelten

#### Scenario: Komplexität darf keine Absenkung rechtfertigen
- **WHEN** Maintainer eine Anpassung der Coverage-Policy für ein kritisches Modul vorschlagen
- **THEN** ist steigende oder hohe Komplexität kein zulässiger Grund zur Senkung des Mindest-Floors
- **AND** etwaige Anpassungen müssen Stabilisierung oder Verschärfung der Absicherung begründen
