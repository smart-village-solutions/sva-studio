## ADDED Requirements

### Requirement: Plugin-Tenant-Lifecycle verwendet die zentrale Operations-Plattform

Das System SHALL tenantbezogene Plugin-Lifecycle-Läufe als zentral persistente, namespaced Plugin-Operations-Jobs ausführen. Fortschritt, Ergebnis, Fehler, Abbruch, Korrelation und Artefakte MUST denselben Hostvertrag wie andere Plugin-Operations verwenden.

#### Scenario: Lifecycle-Job erscheint in der generischen Jobansicht

- **GIVEN** ein Plugin-Provisionierungs- oder Reconcile-Job wurde gestartet
- **WHEN** ein berechtigter Benutzer die zentrale Plugin-Operations-Ansicht öffnet
- **THEN** erscheint der Lauf mit Plugin, Instanz, Phase, Status und Korrelationsbezug
- **AND** benötigt die Ansicht keine pluginId-spezifische Jobdarstellung

#### Scenario: Plugin-Handler erhält nur deklarierte Hostfähigkeiten

- **GIVEN** ein Lifecycle-Job wird ausgeführt
- **WHEN** der Host den Execution-Context erzeugt
- **THEN** enthält er ausschließlich die für den Beitrag freigegebenen Fähigkeiten
- **AND** erhält das Plugin keinen direkten Zugriff auf Host-Runner-, Registry- oder fremde Secret-Interna
