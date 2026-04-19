## ADDED Requirements

### Requirement: Host erzwingt Autorisierung für Plugin-Beiträge

Das System SHALL Autorisierungsentscheidungen für pluginbezogene Routen, Aktionen und Ressourcen ausschließlich hostseitig erzwingen.

#### Scenario: Plugin deklariert Guard-Bedarf, Host entscheidet

- **WHEN** ein Plugin für eine Route oder Ressource eine Guard-Anforderung beschreibt
- **THEN** interpretiert der Host diese Anforderung und erzwingt die finale Autorisierungsentscheidung
- **AND** das Plugin trifft keine eigenständige verbindliche Allow-/Deny-Entscheidung

#### Scenario: Plugin darf Autorisierung nicht bypassen

- **WHEN** ein Plugin versucht, Host-Guards oder Permission-Prüfungen zu umgehen
- **THEN** gilt dies als Vertragsverletzung
- **AND** der Host-Vertrag betrachtet solche Pfade nicht als zulässige Erweiterung
