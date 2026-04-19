## ADDED Requirements

### Requirement: Fachliche Content- und Verwaltungsbereiche nutzen denselben Admin-Ressourcen-Vertrag

Das System SHALL für neue fachliche Content- und Verwaltungsbereiche denselben deklarativen Admin-Ressourcen-Vertrag verwenden.

#### Scenario: Content-nahe Fachfläche wird als Admin-Ressource beschrieben

- **WHEN** ein Package eine fachliche Verwaltungs- oder Inhaltsfläche ergänzt
- **THEN** registriert es diese Fläche als Admin-Ressource statt als lose Einzelroute
- **AND** der Host behandelt sie wie andere kanonische Admin-Bausteine

#### Scenario: Content-Kern bleibt mit Admin-Ressourcen kompatibel

- **WHEN** eine Admin-Ressource Inhalte oder Inhaltsmetadaten darstellt
- **THEN** bleibt der kanonische Content-Kern unverändert gültig
- **AND** die Ressource ergänzt nur UI- und Navigationsanbindung
