## ADDED Requirements

### Requirement: Mainserver-Vertrag für redaktionelles Audio

Das System SHALL Hörbeiträge als `contentType: "audio"` mit `sourceUrl.url` und den vorhandenen Medienmetadaten über den Mainserver abbilden.

#### Scenario: Audio wird im Inhaltstyp richtig gespeichert

- **WHEN** ein Hörbeitrag gespeichert wird
- **THEN** verwendet der Mainserver `mediaContents` bei Tour, Station und Ort und `contentBlocks[].mediaContents` bei Nachrichten
- **AND** bleibt eine reine Änderung der Audio-URL nach dem erneuten Lesen sichtbar

#### Scenario: Ein Stationshörbeitrag ändert sich verlustfrei

- **GIVEN** eine Tour mit mindestens drei geordneten Stationen einschließlich einer Station mit POI-Verweis
- **WHEN** die Redaktion über den vorhandenen revisionierten `createTour`-Pfad nur den Hörbeitrag einer Station ändert
- **THEN** sind nach erneuter Abfrage die Änderung und die Medienherkunft sichtbar
- **AND** bleiben alle Stations-IDs, die Reihenfolge, Koordinaten, übrigen Medien und Payload-Daten erhalten
- **AND** verwendet die öffentliche Abfrage eigenes Stationsaudio, sofern eines gesetzt ist, und erhält das bisherige Verhalten der Bildmedien

#### Scenario: Stationsaudio fehlt oder wird entfernt

- **WHEN** eine Station keine eigene Audioquelle hat oder ein Schreibaufruf sie mit einer leeren Audioliste entfernt
- **THEN** verwendet die öffentliche Abfrage Audio eines verknüpften POI nur bei dessen wirksamer öffentlicher Lesbarkeit im aktuellen Mandantenkontext
- **AND** bleibt ein schreibender Request ohne Audiofeld beim bisherigen eigenen Stationsaudio

#### Scenario: Der bisherige Tourenvertrag bleibt gültig

- **WHEN** ein bestehender Studio-Client einen Touren-Read oder revisionierten Touren-Write ohne Audiofelder ausführt
- **THEN** verarbeitet der Mainserver den bestehenden Vertrag weiter und bewahrt vorhandenes Audio bei der Bearbeitung
