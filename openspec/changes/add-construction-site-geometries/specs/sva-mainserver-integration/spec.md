## ADDED Requirements

### Requirement: Baustellengeometrie im bestehenden GenericItem-Payload speichern

Die Integration SHALL Geometrien unter `payload.constructionSiteGeometry` als GeoJSON-FeatureCollection mit `version: 1` speichern. Standortrelationen und unberührte Payload-Felder SHALL erhalten bleiben. Im Studio-Input SHALL ein ausgelassenes Geometriefeld Erhalt, ein gültiges Objekt vollständigen Ersatz und explizites `null` die Entfernung ausschließlich des reservierten Schlüssels bedeuten. Bestehende Authentifizierung, Instanzbindung, Berechtigungen, Fingerprint-Prüfung und Recovery SHALL auch für diese Änderung gelten.

#### Scenario: Geometrie hinzufügen und unabhängig zurücklesen

- **WHEN** ein berechtigter Client zu einer bestehenden Baustelle eine gültige Geometrie speichert
- **THEN** werden Standortpunkte und unbekannte Payload-Felder erhalten
- **AND** wird Erfolg erst nach unabhängigem Readback der erwarteten Geometrie bestätigt

#### Scenario: Geometrie ausdrücklich löschen

- **WHEN** ein berechtigter Client `geometry: null` speichert
- **THEN** wird nur der reservierte Schlüssel entfernt
- **AND** bestätigt der Readback dessen tatsächliches Fehlen statt lediglich eine Teilmenge des Payloads zu vergleichen

### Requirement: Bestehenden Mainserver ohne Erweiterung verwenden

Der Studio-Adapter SHALL das vollständige, aus dem aktuellen Snapshot aufgebaute Payload über die bestehende ersetzende GenericItem-Mutation schreiben. Bei `geometry: null` SHALL der Adapter den reservierten Schlüssel aus diesem Payload entfernen, statt einen neuen Mainserver-Löschvertrag vorauszusetzen. Bei ausgelassenem Studio-Input SHALL der gespeicherte Schlüssel erhalten bleiben. Client und Studio-Server SHALL die Geometrie unabhängig validieren. Eine Mainserver-Änderung oder Legacy-CMS-Kompatibilität SHALL keine Voraussetzung dieser Erweiterung sein; das alte CMS wird nach Nutzerfestlegung nicht mehr für Baustellen verwendet.

#### Scenario: Studio-Client lässt das Geometriefeld aus

- **WHEN** ein Studio-Client eine bestehende Baustelle ohne das Input-Feld `geometry` aktualisiert
- **THEN** übernimmt der Adapter deren vorhandene Geometrie aus dem aktuellen vollständigen Snapshot in das Payload
- **AND** bestätigt der Readback den unveränderten Geometriestand

#### Scenario: Letzte Form über unveränderten Mainserver entfernen

- **WHEN** ein berechtigter Client die letzte Form mit `geometry: null` entfernt
- **THEN** enthält das vollständige Mutation-Payload den reservierten Schlüssel nicht mehr
- **AND** entfernt die bestehende Payload-Ersetzung die Geometrie ohne Mainserver-Anpassung
- **AND** bleiben alle übrigen Payload-Felder und Standortrelationen erhalten

### Requirement: Baustellenliste ohne vollständige Geometrie laden

Die Baustellenintegration SHALL für Listen eine eigene begrenzte GraphQL-Projektion und einen passenden Listentyp verwenden. Geometrie-Payloads SHALL weder im Kandidatenscan noch in der Listenantwort geladen werden. Detail-, Prewrite- und Recovery-Reads SHALL weiterhin den vollständigen zur Erhaltung und Konfliktprüfung benötigten Datensatz lesen. Bestehende Filter-, Zugriffs-, Sortier- und Paginationssemantik SHALL erhalten bleiben.

#### Scenario: Übersicht über Baustellen mit großen Geometrien

- **WHEN** die Liste Baustellen mit gespeicherten Linien und Flächen abfragt
- **THEN** enthält die GraphQL-Listenauswahl kein Payload
- **AND** entsprechen sichtbare Ergebnisse, Filter und Berechtigungen weiterhin dem bestehenden Listenvertrag
