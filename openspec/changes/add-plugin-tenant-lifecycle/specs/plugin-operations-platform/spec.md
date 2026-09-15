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

#### Scenario: Privilegierter Lifecycle-Job bleibt von der Default-Queue unabhängig

- **GIVEN** ein Default-Job hält seine deklarierte serielle Queue durch Ausführung oder Retry belegt
- **AND** ein privilegierter Lifecycle-Job deklariert eine davon getrennte Queue
- **WHEN** der Host beide Jobs an die zuständigen Worker-Lanes übergibt
- **THEN** verwendet jede Ausführung die hostvalidierte Queue ihrer Jobdefinition
- **AND** erreicht der privilegierte Lifecycle-Job seinen nächsten Verarbeitungsversuch innerhalb der zugesagten Konvergenzzeit ohne HTTP-Request oder manuellen Neustart

#### Scenario: Persistierter Lifecycle-Job übernimmt eine geänderte Queue-Zuordnung

- **GIVEN** ein nicht terminaler Lifecycle-Job wurde vor einer Änderung seiner hostvalidierten Queue-Zuordnung persistiert
- **WHEN** der persistente Recovery-Pfad den Job erneut einreiht
- **THEN** verwendet der Execution-Wake-up die aktuell registrierte Queue und Worker-Lane
- **AND** bleibt der Job nicht auf der früheren seriellen Queue blockiert
