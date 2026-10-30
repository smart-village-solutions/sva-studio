## ADDED Requirements

### Requirement: Öffentliche Fraktionsdaten verwenden die relationale Tour-Zuordnung

Das System SHALL Kalender- und Erinnerungsdaten aus derselben relationalen Tour-Fraktions-Zuordnung wie die administrative Waste-Pflege lesen, ohne eine zweite fachliche Primärquelle anzulegen.

#### Scenario: Eine Tour mit mehreren Fraktionen wird öffentlich gelesen

- **WHEN** Kalender, Fraktionsfilter, iCal-/PDF-Ausgaben oder Erinnerungsdaten für einen Standort ermittelt werden
- **THEN** bleiben die fachlichen Tour-/Fraktions- und Terminzuordnungen gegenüber einem gültigen Bestand vor der Migration unverändert
- **AND** erzeugt die relationale Abfrage keine zusätzlichen doppelten Termine oder Fraktionen
- **AND** bleiben bestehende Standort-, Veröffentlichungs-, Reminder- und Berechtigungsregeln erhalten

#### Scenario: Die gemeinsame Datenbank wird kompatibel erweitert und später bereinigt

- **WHEN** zuerst Expand und anschließend der öffentliche Verbraucherwechsel ausgeführt werden
- **THEN** können alte Leser vorübergehend die Arrayspalte und neue Leser die relationale Zuordnung verwenden, ohne widersprüchliche Fachbestände
- **AND** erfolgt Contract erst nach ausdrücklich bestätigtem Wechsel sämtlicher öffentlicher Prozesse und Hintergrundverbraucher
- **AND** sind Schema-/Rechteprüfung und fachlicher Smoke Voraussetzung der Betriebsfreigabe
