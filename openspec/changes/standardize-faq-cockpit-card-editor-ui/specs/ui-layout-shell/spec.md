## ADDED Requirements

### Requirement: Gemeinsame Editor-Primitives übernehmen bewährtes Verhalten ohne Plugin-Duplikate

Das Studio MUST gemeinsame Editor-Primitives aus nachgewiesenen Verhaltensmustern mehrerer produktiver Content-Plugins ableiten. Die Vereinheitlichung MUST allgemeine Layout- und Interaktionsverantwortung in `studio-ui-react` bündeln und pluginlokale Basisimplementierungen entfernen oder auf fachliche Zusammensetzung reduzieren.

#### Scenario: Gemeinsames Primitive wird aus realen Nutzungsmustern abgeleitet

- **GIVEN** News, Events, POIs, GenericItems, FAQ oder Kacheln besitzen ein vergleichbares Editor-Muster
- **WHEN** das Studio dafür ein gemeinsames Primitive einführt oder erweitert
- **THEN** ist dessen Verhalten gegen mindestens zwei reale Nutzungsmuster geprüft
- **AND** bleiben fachliche Feldmodelle, Mapper und Validierungen in den jeweiligen Plugins

#### Scenario: Referenzplugin besitzt eine lokale Basisimplementierung

- **WHEN** ein Referenzplugin Tabs, Section-Cards, Pagination oder Löschbestätigung lokal nachbildet
- **THEN** übernimmt die Vereinheitlichung das bewährte Verhalten, aber nicht automatisch die lokale Ownership-Struktur
- **AND** führt sie keine weitere parallele Basisimplementierung in FAQ, Kacheln oder GenericItems ein

#### Scenario: Abstraktion besitzt keine nachgewiesene Mehrfachnutzung

- **WHEN** eine vorgeschlagene Factory, ein Wrapper oder eine Konfigurationsschicht nur einen einzigen Editor bedienen würde
- **THEN** bleibt die fachliche Zusammensetzung lokal und direkt
- **AND** führt das Studio keine spekulative gemeinsame Abstraktion ein

### Requirement: Fachliche Content-Editoren verwenden den gemeinsamen Studio-Detail-Workspace

Das Studio MUST FAQ, Kacheln und offene GenericItems über die gemeinsamen Detailseiten-, Tab-, Panel-, Formularstatus- und Dialog-Primitives darstellen. Die Fachplugins MUST ihre fachlichen Felder und Validierungen selbst besitzen, dürfen aber keine parallelen Basisimplementierungen für dieselben Studio-Interaktionen einführen.

#### Scenario: Detail-Workspace wird auf Desktop dargestellt

- **WHEN** ein Benutzer FAQ, Kacheln oder GenericItems erstellt oder bearbeitet
- **THEN** verwendet der Editor das gemeinsame Detailseiten-Template und die gemeinsame Bereichsnavigation
- **AND** erklärt eine fachliche Seitenbeschreibung Zweck und Umfang des Editors
- **AND** Tab-Header, Panel-Flächen, Beschreibungen, Abstände und Aktionen folgen denselben semantischen Studio-Tokens
- **AND** pluginlokale Komponenten beschränken sich auf die Zusammensetzung fachlicher Felder

#### Scenario: Primäraktion erstellt einen neuen Fachinhalt

- **WHEN** ein Benutzer einen neuen Fachinhalt erstellt
- **THEN** benennt die Primäraktion das Erstellen eindeutig
- **AND** bleibt die Aktion bis zum Mutationsstart verfügbar und ist während der laufenden Mutation gesperrt

#### Scenario: Primäraktion aktualisiert einen bestehenden Fachinhalt

- **WHEN** ein Benutzer einen bestehenden Fachinhalt bearbeitet
- **THEN** benennt die Primäraktion das Aktualisieren eindeutig
- **AND** bleibt die Aktion bis zum Mutationsstart verfügbar und ist während der laufenden Mutation gesperrt

#### Scenario: Detail-Workspace wird mobil dargestellt

- **WHEN** ein Benutzer denselben Editor auf einem kleinen Viewport öffnet
- **THEN** bietet der gemeinsame Detail-Workspace eine sichtbare und beschriftete mobile Bereichsauswahl
- **AND** alle fachlichen Bereiche bleiben ohne horizontales Layout-Breaking erreichbar

#### Scenario: Formularzustand bleibt beim Bereichswechsel erhalten

- **GIVEN** ein Benutzer hat Werte, wiederholbare Einträge oder Validierungsfehler in einem Formularbereich
- **WHEN** er mehrfach zwischen Editorbereichen wechselt
- **THEN** bleiben Werte, Reihenfolge, Dirty-State und Fehler erhalten
- **AND** ein noch nicht besuchter History-Bereich darf weiterhin erst beim ersten Öffnen geladen werden

### Requirement: Studio-Formulare zeigen Status und Fehler einheitlich und feldbezogen

Das Studio MUST Speicherstatus, API-Fehler und Validierungsfehler in Content-Editoren über die gemeinsamen Form-Summary-Primitives darstellen. Feldbezogene Fehler MUST eine stabile Zuordnung zum betroffenen Feld und dessen Editorbereich besitzen.

#### Scenario: Fehler befindet sich im aktiven Bereich

- **WHEN** eine Formularvalidierung im sichtbaren Editorbereich fehlschlägt
- **THEN** zeigt das Studio den Fehler in der gemeinsamen Zusammenfassung und bei Bedarf inline am Feld
- **AND** ein Fehlerverweis fokussiert das eindeutig zugeordnete Feld

#### Scenario: Fehler befindet sich in einem anderen Bereich

- **WHEN** ein Fehlerverweis auf ein Feld in einem inaktiven Editorbereich zeigt
- **THEN** aktiviert das Studio zuerst den zugehörigen Bereich
- **AND** fokussiert anschließend das betroffene Feld
- **AND** verwirft keine bereits erfassten Formulardaten

#### Scenario: Mutation schlägt fehl

- **WHEN** Speichern oder Löschen serverseitig fehlschlägt
- **THEN** zeigt das Studio einen zugänglichen Fehlerstatus mit einer korrigierbaren nächsten Handlung
- **AND** bestehende Formularwerte bleiben erhalten

### Requirement: Destruktive Content-Aktionen verlangen eine gemeinsame Bestätigung

Das Studio MUST für das Löschen von FAQ, Kacheln und GenericItems denselben zugänglichen Bestätigungsdialog verwenden. Ohne ausdrückliche Bestätigung darf keine Löschmutation ausgeführt werden.

#### Scenario: Benutzer bricht das Löschen ab

- **WHEN** ein Benutzer den Löschdialog abbricht
- **THEN** führt das Studio keine Mutation und keine Navigation aus
- **AND** gibt den Fokus an die auslösende Aktion zurück

#### Scenario: Benutzer bestätigt das Löschen

- **WHEN** ein Benutzer das Löschen ausdrücklich bestätigt
- **THEN** sperrt das Studio weitere Lösch- und Bestätigungsaktionen bis zum Abschluss
- **AND** führt genau eine Löschmutation aus
- **AND** navigiert nach Erfolg zur kanonischen Inhaltsübersicht

#### Scenario: Bestätigte Löschung schlägt fehl

- **WHEN** die bestätigte Löschmutation fehlschlägt
- **THEN** bleibt der Dialog mit einem sichtbaren Fehlerzustand bedienbar
- **AND** der Benutzer kann abbrechen oder einen kontrollierten erneuten Versuch auslösen
