## ADDED Requirements

### Requirement: FAQ- und Kachel-Editoren bleiben fachlich reduziert und verwenden gemeinsame Studio-Flächen

Das System MUST FAQ und Kacheln weiterhin ausschließlich über ihre jeweiligen begrenzten Fachmodelle bearbeiten und MUST ihre Editorflächen zugleich auf den gemeinsamen Studio-Detail-Workspace vereinheitlichen. Die Layoutmigration darf keine fachlichen Felder, Persistenzpfade oder direkten Plugin-Abhängigkeiten ergänzen.

#### Scenario: FAQ wird im standardisierten Editor bearbeitet

- **WHEN** ein Benutzer eine FAQ erstellt oder bearbeitet
- **THEN** zeigt der Editor die Bereiche `Basis`, `Inhalt`, `Einstellungen` und bei gespeicherten FAQ `Historie` über den gemeinsamen Studio-Detail-Workspace
- **AND** bleiben ausschließlich Frage, Nur-Text-Antwort, Sprachcode, Sortiergewicht, Sichtbarkeit und Veröffentlichungszeitpunkt bearbeitbar
- **AND** bleiben bestehende Mapper, Payload-Erhaltung und Mainserver-Verträge unverändert

#### Scenario: Kachel wird im standardisierten Editor bearbeitet

- **WHEN** ein Benutzer eine Kachel erstellt oder bearbeitet
- **THEN** zeigt der Editor die Bereiche `Basis`, `Inhalt`, `Einstellungen` und bei gespeicherten Kacheln `Historie` über den gemeinsamen Studio-Detail-Workspace
- **AND** gliedert der Inhaltsbereich Text, Bilder und Link in getrennte fachliche Detailkarten
- **AND** bleiben Medienauswahl, Alternativtext, Feldpfade, Mapper, `externalId` und unbekannte technische Payload-Daten unverändert erhalten

#### Scenario: Kachel-Bilder überstehen Bereichswechsel

- **GIVEN** ein Benutzer hat mehrere Kachel-Bilder ausgewählt, sortiert oder mit Alternativtext versehen
- **WHEN** er zwischen `Inhalt`, `Basis` und `Einstellungen` wechselt
- **THEN** bleiben Bilder, Reihenfolge und Alternativtexte unverändert im Formular erhalten
- **AND** der Editor erzeugt keine doppelten Medienreferenzen

### Requirement: FAQ-Sprachfilter wirkt vor der fachlichen Pagination

Das System MUST den FAQ-Sprachfilter als optionalen URL-Search-Parameter behandeln und auf die vollständige nach `genericType` gleich `FAQ` abgegrenzte Datenmenge anwenden, bevor Sortierung, Gesamtzahl und Pagination berechnet werden. Eine browserseitige Filterung ausschließlich der bereits geladenen Seite ist unzulässig.

#### Scenario: Sprache wird aus der URL gefiltert

- **GIVEN** FAQ mehrerer Sprachcodes liegen über mehrere Mainserver-Seiten verteilt vor
- **WHEN** ein Benutzer die FAQ-Fachliste mit einem Sprachfilter öffnet
- **THEN** filtert der Host die vollständige FAQ-Teilmenge nach dem normalisierten Sprachcode
- **AND** sortiert und paginiert erst das gefilterte Ergebnis
- **AND** zeigt die UI den aktiven Filter aus dem URL-State an

#### Scenario: Gefilterte Seite enthält keine Treffer

- **WHEN** für den gewählten Sprachcode keine FAQ vorhanden ist
- **THEN** zeigt die Fachliste einen regulären gefilterten Leerzustand
- **AND** behauptet sie nicht aufgrund einer nur lokal gefilterten Einzelseite, dass keine Treffer in der Gesamtmenge existieren

#### Scenario: Filter wird geändert oder entfernt

- **WHEN** ein Benutzer den Sprachfilter ändert oder entfernt
- **THEN** setzt die Liste die Seitennummer auf einen gültigen Ausgangswert zurück
- **AND** schreibt den neuen Zustand in die URL
- **AND** bleiben unabhängige Search-Parameter erhalten

### Requirement: FAQ- und Kachel-Fachlisten bieten vollständige URL-gesteuerte Pagination

Das System MUST in FAQ- und Kachel-Fachlisten den normalisierten Seitenzustand aus der URL lesen und sichtbare Vor-/Zurück-Navigation anhand der hostseitigen Pagination bereitstellen.

#### Scenario: Benutzer wechselt die Kachel-Seite

- **WHEN** ein Benutzer in der Kachel-Fachliste vor- oder zurücknavigiert
- **THEN** aktualisiert das Studio `page` und `pageSize` in der URL
- **AND** lädt ausschließlich die angeforderte, hostseitig berechnete Kachel-Seite
- **AND** deaktiviert Navigation über die erste oder letzte bekannte Seite hinaus

#### Scenario: Benutzer navigiert in der FAQ-Fachliste

- **WHEN** ein Benutzer bei aktivem oder inaktivem Sprachfilter die FAQ-Seite wechselt
- **THEN** bleiben Filter und andere unabhängige Search-Parameter erhalten
- **AND** beziehen sich Seitenangabe und Navigationszustand auf die vollständige fachlich gefilterte FAQ-Menge

#### Scenario: URL enthält ungültige Listenparameter

- **WHEN** `page` oder `pageSize` fehlt oder einen nicht unterstützten Wert enthält
- **THEN** normalisiert das Studio den Zustand auf definierte Standardwerte
- **AND** lädt keine negative, nicht ganzzahlige oder anderweitig ungültige Seite

### Requirement: FAQ- und Kachel-Fachlisten verwenden das vollständige Studio-Übersichtsmuster

Das System MUST FAQ- und Kachel-Fachlisten mit dem gemeinsamen Studio-Übersichtstemplate, einer fachlichen Seitenbeschreibung, der gemeinsamen Datentabelle und konsistenten Lade-, Fehler- und Leerzuständen darstellen.

#### Scenario: FAQ-Fachliste wird dargestellt

- **WHEN** ein Benutzer die FAQ-Fachliste öffnet
- **THEN** zeigt das Studio Titel, fachliche Beschreibung, Erstellen-Aktion, Sprachfilter und Datentabelle im gemeinsamen Übersichtslayout
- **AND** verwendet der Sprachfilter bestehende Studio-/shadcn-Formularprimitives

#### Scenario: Kachel-Fachliste wird dargestellt

- **WHEN** ein Benutzer die Kachel-Fachliste öffnet
- **THEN** zeigt das Studio Titel, fachliche Beschreibung, Erstellen-Aktion, Datentabelle und Pagination im gemeinsamen Übersichtslayout
- **AND** bleiben Lade-, Fehler- und Leerzustände visuell und semantisch konsistent

### Requirement: FAQ- und Kachel-Historien folgen einem gemeinsamen lesbaren Muster

Das System MUST die hostgeführte Historie von FAQ und Kacheln mit derselben semantischen Tabellenstruktur sowie konsistenten Lade-, Fehler- und Leerzuständen darstellen.

#### Scenario: Historie enthält Einträge

- **WHEN** ein Benutzer den History-Bereich einer gespeicherten FAQ oder Kachel öffnet
- **THEN** zeigt das Studio Zeitpunkt, lokalisierte Aktion, Actor und Änderungszusammenfassung in einer responsiv nutzbaren semantischen Tabelle
- **AND** sortiert die Einträge deterministisch nach dem neuesten Zeitpunkt zuerst

#### Scenario: Historie ist leer oder nicht verfügbar

- **WHEN** keine History-Einträge vorhanden sind oder das Laden fehlschlägt
- **THEN** zeigt das Studio den gemeinsamen Leer- beziehungsweise Fehlerzustand
- **AND** bleiben die übrigen Editorbereiche und vorhandenen Formulardaten nutzbar
