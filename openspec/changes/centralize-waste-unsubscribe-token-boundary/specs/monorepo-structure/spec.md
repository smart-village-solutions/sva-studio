## ADDED Requirements

### Requirement: Anwendungen teilen keine Quellmodule über App-Grenzen

Das System SHALL wiederverwendbare fachliche oder technische Logik, die von mehreren Anwendungen benötigt wird, über ein owning Workspace-Package bereitstellen. Eine Anwendung SHALL keine Quellmodule aus dem Verzeichnis einer anderen Anwendung importieren oder re-exportieren.

#### Scenario: Gemeinsamer serverseitiger Fachvertrag liegt im owning Package

- **GIVEN** Studio und Public-Waste-App benötigen denselben serverseitigen Waste-Abmeldetokenvertrag
- **WHEN** beide Anwendungen Token erzeugen, lesen oder verifizieren
- **THEN** konsumieren sie den kanonischen Vertrag aus `@sva/waste-management-contracts/unsubscribe-token`
- **AND** keine Anwendung importiert dafür Quellcode aus der jeweils anderen Anwendung
- **AND** Node-spezifische Kryptografie gelangt nicht in einen Browser-Export

#### Scenario: Cross-App-Quellimport wird automatisch abgelehnt

- **WHEN** ein statischer Import, dynamischer Import oder Re-Export aus `apps/<source-app>/**` auf ein Quellmodul unter `apps/<target-app>/**` mit einem anderen App-Namen zeigt
- **THEN** lehnt ein verbindlicher Repository-Check die Änderung ab
- **AND** der Befund nennt Quell- und Zielanwendung nachvollziehbar

#### Scenario: Gemeinsames Package erzeugt gerichtete App-Abhängigkeiten

- **WHEN** mehrere Anwendungen denselben Vertrag aus einem Workspace-Package konsumieren
- **THEN** zeigt der Nx-Projektgraph gerichtete Kanten von den Anwendungen zum Package
- **AND** er erzeugt keine direkte Abhängigkeitskante zwischen den Anwendungen

#### Scenario: App-interne Module und Package-Imports bleiben zulässig

- **WHEN** eine Anwendung ein Modul innerhalb ihres eigenen App-Verzeichnisses oder den öffentlichen Export eines zulässigen Workspace-Packages importiert
- **THEN** akzeptiert der Cross-App-Boundary-Check diesen Import
- **AND** bestehende strengere Package- und Schichtregeln bleiben davon unberührt
