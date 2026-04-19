## ADDED Requirements
### Requirement: Mandantenisolation von Medien-Assets zur Laufzeit

Das System SHALL Media Assets strikt anhand ihrer `instanceId` isolieren.

#### Scenario: Zugriff auf Asset einer fremden Instanz wird verhindert

- **WHEN** ein Benutzer oder Dienst ein Media Asset anfragt
- **THEN** prüft das System, ob das Asset zur aktiven Instanz des Aufrufers gehört
- **AND** ein Asset einer anderen Instanz wird nicht zurückgegeben, auch wenn die Asset-ID bekannt ist

### Requirement: Referenzintegrität beim Löschen von Assets

Das System SHALL sicherstellen, dass ein Media Asset nicht gelöscht werden kann, solange aktive `MediaReference`-Einträge darauf verweisen.

#### Scenario: Löschversuch bei aktivem Referenzbestand schlägt kontrolliert fehl

- **WHEN** ein Benutzer ein Asset löschen will und mindestens eine aktive `MediaReference` auf dieses Asset verweist
- **THEN** lehnt das System die Löschung fail-closed ab
- **AND** die Ablehnung ist auditierbar und für den Benutzer nachvollziehbar

### Requirement: Autorisierungspflicht für alle geschützten Auslieferungspfade

Das System SHALL sicherstellen, dass geschützte Medien ausschließlich über autorisierte Pfade erreichbar sind.

#### Scenario: Direktaufruf eines geschützten Mediums ohne gültigen Berechtigungsnachweis schlägt fehl

- **WHEN** ein Zugriff auf ein als geschützt markiertes Medium ohne gültigen Berechtigungsnachweis erfolgt
- **THEN** verweigert das System den Zugriff unabhängig davon, ob der Storage-Pfad bekannt ist
- **AND** es werden keine Metadaten oder Vorschaudaten des Mediums offengelegt
