## ADDED Requirements
### Requirement: Standardisierte Content-Plugins nutzen gemeinsame SDK-Helfer ohne Plugin-Kopplung

Das System SHALL wiederkehrende technische Muster für standardisierte Content-Plugins über `@sva/plugin-sdk` bereitstellen, ohne direkte Abhängigkeiten zwischen einzelnen Fachplugins einzuführen.

#### Scenario: Standard-CRUD-Metadaten kommen aus dem SDK

- **GIVEN** ein standardisiertes Content-Plugin wie News, Events oder POI
- **WHEN** das Plugin Navigation, Actions, Permissions, Module-IAM und host-owned `adminResources` registriert
- **THEN** kann es dafür gemeinsame SDK-Helfer verwenden
- **AND** die erzeugten Beiträge bleiben namespacet und host-kompatibel

#### Scenario: Mainserver-CRUD-Basis bleibt plugin-isoliert

- **GIVEN** mehrere Content-Plugins sprechen unterschiedliche hostgeführte Mainserver-Fassaden an
- **WHEN** sie gemeinsame HTTP-Basislogik benötigen
- **THEN** nutzen sie gemeinsame SDK-Helfer für Request-, Fehler- und CRUD-Mechanik
- **AND** kein Plugin importiert ein anderes Plugin für diesen Zweck

#### Scenario: Fachlogik bleibt im Plugin

- **GIVEN** ein Plugin besitzt eigene Feldmodelle, Validierung oder Editor-Spezialisierungen
- **WHEN** gemeinsame SDK-Helfer eingesetzt werden
- **THEN** bleiben fachliche Typen, Validierung, Übersetzungen und Editor-Mappings weiterhin im jeweiligen Plugin
- **AND** das SDK übernimmt nur technische Wiederverwendung
