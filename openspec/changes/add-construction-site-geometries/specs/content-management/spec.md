## ADDED Requirements

### Requirement: Baustellengeometrien im Studio bearbeiten

Das Studio SHALL beim Erstellen und Bearbeiten einer Baustelle zusätzlich zu vorhandenen Standortpunkten mehrere Strecken als LineStrings und gesperrte Flächen als Polygone erfassen, auswählen, ändern und löschen können. Geometrien SHALL im gemeinsamen Formular-Draft geführt und ausschließlich durch den bestehenden Speichervorgang persistiert werden. Unfertige Formen SHALL vor Speichern abgeschlossen oder ausdrücklich verworfen werden.

#### Scenario: Strecke und Fläche gemeinsam bearbeiten

- **WHEN** ein berechtigter Redakteur eine Strecke und eine Fläche zur Baustelle hinzufügt und einen Eckpunkt ändert
- **THEN** enthält derselbe Formular-Draft beide gültigen Formen
- **AND** bleiben vorhandene Standortpunkte eigenständige Angaben
- **AND** erfolgt vor dem ausdrücklichen Speichern kein Server-Write

#### Scenario: Unfertige Form vor Speichern

- **WHEN** eine Zeichnung noch nicht abgeschlossen ist und der Redakteur speichern möchte
- **THEN** verhindert das Studio den Write mit verständlicher Meldung
- **AND** kann die Zeichnung abgeschlossen oder ohne Verlust anderer Draft-Änderungen verworfen werden

### Requirement: Zugängliche und robuste Geometriebedienung

Das Studio SHALL Geometriekoordinaten über beschriftete Eingaben und tastaturbedienbare Aktionen zum Hinzufügen, Entfernen und Umordnen bearbeiten lassen. Zeichnen und Standortverschiebung SHALL durch eindeutige Werkzeugzustände getrennt sein. Rückgängig/Wiederholen SHALL Änderungen vor dem Speichern unterstützen. Kartenfehler und deaktivierte Kartendienste SHALL vorhandene Geometrien erhalten; Read-only SHALL keine Geometrieänderung auslösen.

#### Scenario: Bearbeitung ohne nutzbare Karte

- **WHEN** die Karte nicht verfügbar ist
- **THEN** bleiben gespeicherte Geometrien im Draft erhalten und Koordinaten bearbeitbar
- **AND** wird weder ein leerer Ersatz noch ein Löschauftrag aus dem Kartenfehler abgeleitet

#### Scenario: Eindeutiger Werkzeugwechsel

- **WHEN** der Redakteur mit dem Streckenwerkzeug auf die Karte klickt
- **THEN** verändert der Klick ausschließlich die aktuelle Zeichnung und keinen Standortpunkt

### Requirement: Begrenzte und validierte Baustellengeometrien

Client und Server SHALL unabhängig das versionierte GeoJSON-Format mit ausschließlich zweidimensionalen LineStrings und Polygonen ohne Löcher validieren. Version 1 SHALL höchstens zehn Features, 500 Positionen je Feature und insgesamt 1.000 Positionen sowie 48 KiB serialisierte Geometrie enthalten. Ein neuer oder geänderter Geometrieinhalt SHALL nur gespeichert werden, wenn das vollständig zusammengeführte Payload höchstens 60 KiB UTF-8 umfasst. Nach Normalisierung auf sechs Nachkommastellen SHALL die Geometrie weiterhin gültig sein; degenerierte oder selbstüberschneidende Polygone SHALL abgewiesen werden.

#### Scenario: Ungültige oder zu große Fläche

- **WHEN** eine Fläche sich selbst schneidet oder eine Vertragsgrenze überschritten wird
- **THEN** wird der Write verhindert und ein übersetzter Fehler angezeigt
- **AND** erfolgt keine stille Vereinfachung oder Kürzung

#### Scenario: Nicht unterstützte gespeicherte Version

- **WHEN** eine Baustelle eine unbekannte Geometrieversion oder unlesbare Geometrie enthält
- **THEN** bleibt der gespeicherte Inhalt erhalten und der bestehende Schreibschutz meldet die fehlende Bearbeitbarkeit
- **AND** wird kein vermeintlich leerer Geometrie-Draft zurückgeschrieben
